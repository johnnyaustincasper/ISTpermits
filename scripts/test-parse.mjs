// Test the parser against real PDF text
import { existsSync, readFileSync } from 'fs';

// Simulate what the PDF actually looks like (from our earlier peek)
const sampleText = `
WEEKLYJOBSTARTS:3/22/26to3/28/26
NewOrdersWeekly
JURISDICTIONS-NEWHOUSESTHISREPORT(47)

BROKENARROW-NEWHOUSESTHISREPORT(15)TOTALYEAR-TO-DATE(148)
1)HOFFMANHOMESTULSAHOUSE-NEW8117EJACKSONCIR
(918)779-5568/(918)924-83712,845
$639,374
ANTLERFALLS
MultiJobs:1-2-4

2)HOFFMANHOMESTULSAHOUSE-NEW8006EJACKSONCT
(918)779-5568/(918)924-83712,667L20B5
$518,938
ANTLERFALLS

3)EXECUTIVEHOMESHOUSE-NEW2609WTWINOAKSST
(918)557-8148/(918)951-70092,547L1B7
TAYLORSOKOLOSKY$215,000

5)SIMMONSHOMESHOUSE-NEW3005SREDWOODPL
(918)274-0406/(918)376-65622,183L3B5
GREGSIMMONS$130,980

TULSA-NEWHOUSESTHISREPORT(10)
33)JONATHANPRIDEHOUSE-NEW609WSIXTHST
(918)555-1234/(918)555-56781,838L6"E"B24
JOHNSMITH$130,000
SUNRISE
`;

// The key insight from the real PDF:
// Each entry is: N)BUILDERNAMECITIEHOUSE-NEWADDRESS\nPHONES SQFT\nOWNER$VALUE\nSUBDIVISION
// Cities appear in ALL-CAPS jurisdiction headers: "BROKENARROW-NEWHOUSESTHISREPORT"

const KNOWN_CITY_MAP = {
  'BROKENARROW': 'Broken Arrow', 'TULSA': 'Tulsa', 'BIXBY': 'Bixby',
  'OWASSO': 'Owasso', 'JENKS': 'Jenks', 'CLAREMORE': 'Claremore',
  'WAGONER': 'Wagoner', 'SAPULPA': 'Sapulpa', 'GLENPOOL': 'Glenpool',
  'SKIATOOK': 'Skiatook', 'COWETA': 'Coweta', 'CATOOSA': 'Catoosa',
  'SANDSPRINGS': 'Sand Springs', 'COLLINSVILLE': 'Collinsville',
  'SPERRY': 'Sperry', 'VERDIGRIS': 'Verdigris', 'BARTLESVILLE': 'Bartlesville',
  'PORTER': 'Porter', 'INOLA': 'Inola',
};

const PRODUCTION = ['SIMMONSHOMES','DRHORTON','CAPITALHOMES','EXECUTIVEHOMES','RAUSCHCOLEMAN','IDEALHOMES','HOMESBYABER'];

function isProduction(b) { return PRODUCTION.some(p => b.toUpperCase().replace(/[\s-]/g,'').includes(p)); }

function parseStreetAddress(raw) {
  // raw like: "8117EJACKSONCIR" or "2609WTWINOAKSST"
  // Insert space after digits, before direction letter, before street type
  return raw
    .replace(/^(\d+)([NSEW]\d|[NSEW][A-Z]|\d)/g, '$1 $2') // "8117E" → "8117 E"
    .replace(/(\d)([A-Z])/g, '$1 $2')  // "117E" → "117 E"  
    .replace(/([A-Z]{3,})([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ').trim();
}

// Find city context from position in text
function getCityAtPosition(text, pos) {
  const before = text.substring(0, pos);
  let best = { pos: -1, city: 'Tulsa' };
  for (const [key, city] of Object.entries(KNOWN_CITY_MAP)) {
    // Look for "CITYNAME-NEWHOUSES" header pattern
    const pattern = key + '-NEW';
    const idx = before.lastIndexOf(pattern);
    if (idx > best.pos) best = { pos: idx, city };
    // Also just bare city name
    const idx2 = before.lastIndexOf('\n' + key + '\n');
    if (idx2 > best.pos) best = { pos: idx2, city };
  }
  return best.city;
}

const results = [];
// Match numbered entries: "1)..." through next number or end
const entryRe = /(\d+\))([\s\S]*?)(?=\d+\)|$)/g;
let m;
while ((m = entryRe.exec(sampleText)) !== null) {
  const block = m[2];
  if (!/HOUSE-NEW/i.test(block)) continue;
  
  // Split on HOUSE-NEW
  const parts = block.split(/HOUSE-NEW/i);
  const beforeHN = parts[0].trim();  // "HOFFMANHOMESTULSA" or "SIMMONSHOMES"
  const afterHN = parts[1] || '';    // "8117EJACKSONCIR\n(918)..."
  
  // Address = first "word" before phone number
  const addrRaw = afterHN.split(/\n/)[0].trim();  // "8117EJACKSONCIR"
  const address = parseStreetAddress(addrRaw);
  
  // Phone from second line
  const phoneMatch = afterHN.match(/\((\d{3})\)([\d\/\-]+)/);
  const phone = phoneMatch ? `(${phoneMatch[1]})${phoneMatch[2].split('/')[0]}` : '';
  
  // Sqft from digits after phone  
  const sqftMatch = afterHN.match(/\(\d{3}\)[\d\/\-]+([\d,]{3,6})/);
  const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g,'')) : 0;
  
  // Value
  const valMatch = afterHN.match(/\$([\d,]+)/);
  const value = valMatch ? parseInt(valMatch[1].replace(/,/g,'')) : 0;
  
  // Builder — strip city names from end of beforeHN
  let builder = beforeHN;
  for (const key of Object.keys(KNOWN_CITY_MAP)) {
    if (builder.toUpperCase().endsWith(key)) builder = builder.slice(0, -key.length).trim();
  }
  // Add spaces to compressed name
  builder = builder.replace(/([A-Z]{2,})([A-Z][a-z])/g,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2').trim();
  
  const city = getCityAtPosition(sampleText, m.index);
  
  results.push({ builder, address, city, sqft, value, phone });
}

results.forEach(r => console.log(JSON.stringify(r)));
