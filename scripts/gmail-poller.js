/**
 * gmail-poller.js
 * Watches Ivebeencelested@gmail.com for forwarded NOW Report emails,
 * downloads PDF attachments (Weekly Jobs only, skips "lien" files),
 * parses HOUSE-NEW permit entries, geocodes addresses, and pushes to Firestore.
 *
 * IMPORTANT: Gmail requires an "App Password" for IMAP access.
 * Regular Gmail passwords do NOT work with IMAP (Google blocks them).
 * To set up an App Password:
 *   1. Go to https://myaccount.google.com/security
 *   2. Enable 2-Step Verification if not already enabled
 *   3. Go to https://myaccount.google.com/apppasswords
 *   4. Create an App Password for "Mail" / "Other (Custom name)" → name it "IST Poller"
 *   5. Replace GMAIL_PASSWORD below (or set GMAIL_APP_PASSWORD env var) with the 16-char code
 *
 * Run: node gmail-poller.js
 * Env vars: NEXT_PUBLIC_MAPBOX_TOKEN, GMAIL_APP_PASSWORD (optional override)
 */

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEOCODE_CACHE_PATH = path.join(__dirname, 'geocode-cache.json');
const SERVICE_ACCOUNT_PATH = '/Users/celeste/.openclaw/workspace/.secrets/firebase-service-account.json';
const PROJECT_ID = 'insulation-services-da91a';

// ── Config ─────────────────────────────────────────────────────────────────
const GMAIL_USER = 'Ivebeencelested@gmail.com';
// NOTE: This is the regular password. Gmail IMAP requires an App Password.
// See instructions above. Set GMAIL_APP_PASSWORD env var to override.
const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD || '67676969Jc!';
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const PRODUCTION_BUILDERS = [
  'SIMMONS HOMES', 'D R HORTON', 'DR HORTON', 'CAPITAL HOMES',
  'EXECUTIVE HOMES', 'RAUSCH-COLEMAN', 'RAUSCH COLEMAN',
  'IDEAL HOMES', 'HOMES BY TABER'
];

function isProduction(builder) {
  const b = (builder || '').toUpperCase();
  return PRODUCTION_BUILDERS.some(p => b.includes(p));
}

// ── Geocode cache ───────────────────────────────────────────────────────────
function loadGeocodeCache() {
  if (existsSync(GEOCODE_CACHE_PATH)) {
    try { return JSON.parse(readFileSync(GEOCODE_CACHE_PATH, 'utf8')); } catch {}
  }
  return {};
}

function saveGeocodeCache(cache) {
  writeFileSync(GEOCODE_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function geocodeAddress(address, city, cache) {
  const key = `${address}, ${city}, OK`;
  if (cache[key]) return cache[key];

  if (!MAPBOX_TOKEN) {
    console.warn('  No NEXT_PUBLIC_MAPBOX_TOKEN set — skipping geocoding');
    return { lat: 0, lng: 0 };
  }

  await new Promise(r => setTimeout(r, 100)); // rate limit
  const query = encodeURIComponent(key);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=US&limit=1&types=address,place`;
  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(url);
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      cache[key] = { lat, lng };
      saveGeocodeCache(cache);
      return { lat, lng };
    }
  } catch (err) {
    console.warn(`  Geocode error for "${key}": ${err.message}`);
  }
  return { lat: 0, lng: 0 };
}

// ── PDF Parser ──────────────────────────────────────────────────────────────
function parseWeekFromText(text, filename) {
  // Try to find week range like "3/8-3/14" or "03/08-03/14" in text or filename
  const weekMatch = (text + ' ' + filename).match(/(\d{1,2}\/\d{1,2})-(\d{1,2}\/\d{1,2})/);
  if (weekMatch) return weekMatch[0];
  // Try "Week of Month Day" style
  const altMatch = text.match(/week\s+of\s+(\w+\s+\d+)/i);
  if (altMatch) return altMatch[1];
  return 'unknown';
}

function parsePermitsFromPDF(text, filename) {
  const week = parseWeekFromText(text, filename);
  const permits = [];

  // The NOW Report format — lines look like:
  // HOUSE-NEW  Builder Name  Address, City  SQFT  VALUE  Contact  Phone
  // We'll try multiple parsing strategies

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Strategy 1: Find lines starting with HOUSE-NEW and parse structured data
  // Each permit spans multiple lines typically
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Look for HOUSE-NEW marker
    if (/HOUSE-NEW/i.test(line)) {
      try {
        // Collect next several lines as part of this entry
        const block = [line];
        for (let j = 1; j <= 6 && i + j < lines.length; j++) {
          const next = lines[i + j];
          if (/HOUSE-NEW/i.test(next)) break; // new entry starts
          block.push(next);
        }
        const fullText = block.join(' ');

        // Extract phone number (pattern: (xxx)xxx-xxxx or xxx-xxx-xxxx)
        const phoneMatch = fullText.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
        const phone = phoneMatch ? phoneMatch[0].replace(/\s/g, '') : '';

        // Extract value (dollar amounts like $123,456 or 123456)
        const valueMatches = fullText.match(/\$[\d,]+|\b\d{3,7}\b/g) || [];
        const value = valueMatches.length > 0 ? parseInt(valueMatches[0].replace(/[$,]/g, '')) : 0;

        // Extract sqft (typically 4-5 digit number)
        const sqftMatch = fullText.match(/\b(\d{4,5})\b/);
        const sqft = sqftMatch ? parseInt(sqftMatch[1]) : 0;

        // Extract city — look for known cities
        const knownCities = ['Tulsa', 'Broken Arrow', 'Bixby', 'Owasso', 'Jenks', 'Claremore',
          'Wagoner', 'Sapulpa', 'Glenpool', 'Skiatook', 'Coweta', 'Catoosa',
          'Sand Springs', 'Inola', 'Oologah', 'Bartlesville', 'Stillwater'];
        let city = '';
        for (const c of knownCities) {
          if (fullText.includes(c)) { city = c; break; }
        }

        // Extract address — look for street patterns
        const addrMatch = fullText.match(/\d+\s+[NSEW]?\s*\d*\s*[A-Za-z][A-Za-z\s]+(?:St|Av|Ave|Rd|Dr|Ln|Blvd|Pl|Ct|Ter|Tr|Way|Pkwy|Hwy)\b/i);
        const address = addrMatch ? addrMatch[0].trim() : '';

        // Extract builder name (typically appears after HOUSE-NEW, before address)
        // Rough heuristic: text before the address
        let builder = '';
        if (address && fullText.includes(address)) {
          const beforeAddr = fullText.split(address)[0].replace(/HOUSE-NEW/i, '').trim();
          // Take the first meaningful chunk
          builder = beforeAddr.replace(/\s+/g, ' ').trim().split(/\s{2,}/)[0] || '';
          // Clean up
          builder = builder.replace(/[^A-Za-z0-9\s&'.-]/g, '').trim();
        }

        // Extract contact name (person name — typically Title Case words not matching address)
        const contactMatch = fullText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?=\s*\(?\d{3}\)?)/);
        const contact = contactMatch ? contactMatch[1] : '';

        if (address && city) {
          permits.push({
            builder: builder || 'Unknown',
            address,
            city,
            sqft,
            value,
            contact,
            phone,
            week,
            production: isProduction(builder),
          });
        }
      } catch (err) {
        // Skip malformed entry
      }
    }
    i++;
  }

  // If strategy 1 found nothing, try tabular parsing
  if (permits.length === 0) {
    console.log('  Strategy 1 found no permits, trying tabular parse...');
    // Look for tab/space-separated rows
    const houseNewLines = lines.filter(l => /HOUSE.?NEW/i.test(l));
    for (const line of houseNewLines) {
      const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 4) {
        const builder = parts[1] || '';
        const address = parts[2] || '';
        const city = parts[3] || '';
        const sqft = parseInt(parts[4]) || 0;
        const value = parseInt((parts[5] || '').replace(/[$,]/g, '')) || 0;
        const contact = parts[6] || '';
        const phone = parts[7] || '';
        if (address) {
          permits.push({ builder, address, city, sqft, value, contact, phone, week, production: isProduction(builder) });
        }
      }
    }
  }

  return permits;
}

// ── Firestore writer ─────────────────────────────────────────────────────────
async function getFirestore() {
  if (existsSync(SERVICE_ACCOUNT_PATH)) {
    const admin = (await import('firebase-admin')).default;
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID });
    }
    return { db: admin.firestore(), mode: 'admin' };
  } else {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getFirestore: getClientFirestore, doc, setDoc, getDoc, collection } = await import('firebase/firestore');
    const app = getApps().length ? getApps()[0] : initializeApp({
      apiKey: "AIzaSyBvL6M_2kPGt8XrcgpPHfL-bwU9BAH57Qk",
      projectId: PROJECT_ID,
      storageBucket: "insulation-services-da91a.firebasestorage.app",
      messagingSenderId: "761459419108",
      appId: "1:761459419108:web:25235ad8b067eddb96c9f1",
    });
    return { db: getClientFirestore(app), mode: 'client' };
  }
}

async function permitExists(db, mode, id) {
  if (mode === 'admin') {
    const snap = await db.collection('permits').doc(id).get();
    return snap.exists;
  } else {
    const { doc, getDoc, collection } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'permits', id));
    return snap.exists();
  }
}

async function savePermit(db, mode, id, data) {
  if (mode === 'admin') {
    await db.collection('permits').doc(id).set(data);
  } else {
    const { doc, setDoc, collection } = await import('firebase/firestore');
    await setDoc(doc(db, 'permits', id), data);
  }
}

// ── IMAP email fetcher ───────────────────────────────────────────────────────
function fetchUnreadEmails() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: GMAIL_USER,
      password: GMAIL_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) { imap.end(); return reject(err); }

        imap.search(['UNSEEN'], (err, results) => {
          if (err) { imap.end(); return reject(err); }
          if (!results || results.length === 0) {
            console.log('  No unread emails found.');
            imap.end();
            return resolve([]);
          }

          console.log(`  Found ${results.length} unread email(s)`);
          const fetch = imap.fetch(results, { bodies: '', markSeen: true });

          fetch.on('message', (msg, seqno) => {
            let rawEmail = '';
            msg.on('body', (stream) => {
              stream.on('data', chunk => rawEmail += chunk.toString());
              stream.once('end', () => {
                emails.push(rawEmail);
              });
            });
          });

          fetch.once('error', err => console.warn('  Fetch error:', err.message));
          fetch.once('end', () => {
            imap.end();
          });
        });
      });
    });

    imap.once('end', () => resolve(emails));
    imap.once('error', err => reject(err));
    imap.connect();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══ IST Gmail Poller ═══\n');

  let emailsChecked = 0;
  let pdfsFound = 0;
  let permitsParsed = 0;
  let permitsAdded = 0;
  let permitsSkipped = 0;

  // Connect to Firestore
  const { db, mode } = await getFirestore();
  console.log(`Firestore connected (${mode} mode)`);

  // Load geocode cache
  const geocodeCache = loadGeocodeCache();
  console.log(`Geocode cache: ${Object.keys(geocodeCache).length} entries\n`);

  // Fetch emails
  console.log('Connecting to Gmail IMAP...');
  let rawEmails;
  try {
    rawEmails = await fetchUnreadEmails();
  } catch (err) {
    console.error('IMAP connection failed:', err.message);
    console.error('\nIf you see an authentication error, Gmail requires an App Password.');
    console.error('See the instructions at the top of this file.');
    process.exit(1);
  }

  emailsChecked = rawEmails.length;
  console.log(`\nProcessing ${emailsChecked} email(s)...\n`);

  for (const raw of rawEmails) {
    let parsed;
    try {
      parsed = await simpleParser(raw);
    } catch (err) {
      console.warn('  Could not parse email:', err.message);
      continue;
    }

    const subject = parsed.subject || '';
    console.log(`Email: "${subject}"`);

    // Find PDF attachments
    const attachments = (parsed.attachments || []).filter(a => {
      const fn = (a.filename || '').toLowerCase();
      if (!fn.endsWith('.pdf')) return false;
      if (fn.includes('lien')) { console.log(`  Skipping lien file: ${a.filename}`); return false; }
      if (fn.includes('job') || fn.includes('weekly')) return true;
      // Also accept PDFs that don't match but are in a NOW report context
      if (subject.toLowerCase().includes('now') || subject.toLowerCase().includes('weekly') || subject.toLowerCase().includes('permit')) return true;
      return false;
    });

    if (attachments.length === 0) {
      console.log('  No matching PDF attachments\n');
      continue;
    }

    for (const attachment of attachments) {
      console.log(`  Processing PDF: ${attachment.filename}`);
      pdfsFound++;

      let pdfText;
      try {
        const data = await pdfParse(attachment.content);
        pdfText = data.text;
      } catch (err) {
        console.warn(`  PDF parse error: ${err.message}`);
        continue;
      }

      const newPermits = parsePermitsFromPDF(pdfText, attachment.filename);
      console.log(`  Parsed ${newPermits.length} HOUSE-NEW permits from PDF`);
      permitsParsed += newPermits.length;

      for (const permit of newPermits) {
        // Generate unique ID from address + week
        const idSource = `${permit.address}-${permit.week}`.toLowerCase().replace(/\s+/g, '-');
        const id = crypto.createHash('md5').update(idSource).digest('hex').slice(0, 16);

        // Geocode
        if (!permit.lat || !permit.lng) {
          const coords = await geocodeAddress(permit.address, permit.city, geocodeCache);
          permit.lat = coords.lat;
          permit.lng = coords.lng;
        }

        // Check for duplicates
        const exists = await permitExists(db, mode, id);
        if (exists) {
          console.log(`  Skip duplicate: ${permit.address}`);
          permitsSkipped++;
          continue;
        }

        // Save to Firestore
        try {
          await savePermit(db, mode, id, { id, ...permit });
          console.log(`  ✓ Added: ${permit.builder} @ ${permit.address}`);
          permitsAdded++;
        } catch (err) {
          console.error(`  ✗ Failed to save ${permit.address}: ${err.message}`);
        }
      }
    }
    console.log();
  }

  console.log('═══ Summary ═══');
  console.log(`Emails checked:   ${emailsChecked}`);
  console.log(`PDFs found:       ${pdfsFound}`);
  console.log(`Permits parsed:   ${permitsParsed}`);
  console.log(`Permits added:    ${permitsAdded}`);
  console.log(`Permits skipped:  ${permitsSkipped} (duplicates)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
