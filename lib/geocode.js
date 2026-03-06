// Geocodes permit addresses using Mapbox Geocoding API
// Caches results in localStorage so it only runs once per address

const CACHE_KEY = 'ist-geocode-cache-v1';

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// Geocode a single address via Mapbox
async function geocodeAddress(address, city, token) {
  const query = encodeURIComponent(`${address}, ${city}, Oklahoma`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=US&limit=1&types=address,place`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}

// Small delay to respect rate limits
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Geocode all permits, using cache where available
// Returns a map of permitId -> { lat, lng }
// onProgress callback: (completed, total) => void
export async function geocodePermits(permits, token, onProgress) {
  const cache = getCache();
  const results = {};
  let completed = 0;
  const total = permits.length;

  // Check which ones need geocoding
  const needsGeocode = [];
  permits.forEach(p => {
    const key = `${p.address}|${p.city}`;
    if (cache[key]) {
      results[p.id] = cache[key];
      completed++;
    } else {
      needsGeocode.push(p);
    }
  });

  if (onProgress) onProgress(completed, total);

  // Geocode the rest in batches
  for (const p of needsGeocode) {
    // Skip production builder cluster entries (they have vague addresses)
    if (p.address.includes('Multiple') || p.address.includes('(') || p.address.includes('subdivision')) {
      completed++;
      if (onProgress) onProgress(completed, total);
      continue;
    }

    const coords = await geocodeAddress(p.address, p.city, token);
    if (coords) {
      const key = `${p.address}|${p.city}`;
      cache[key] = coords;
      results[p.id] = coords;
    }
    completed++;
    if (onProgress) onProgress(completed, total);

    // Small delay between requests (Mapbox allows 600/min on free tier)
    await sleep(120);
  }

  saveCache(cache);
  return results;
}

// Apply geocoded coordinates to permits array
export function applyGeocodedCoords(permits, geocodedMap) {
  return permits.map(p => {
    if (geocodedMap[p.id]) {
      return { ...p, lat: geocodedMap[p.id].lat, lng: geocodedMap[p.id].lng };
    }
    return p;
  });
}

// Clear the geocode cache (useful if you want to re-geocode)
export function clearGeocodeCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}
