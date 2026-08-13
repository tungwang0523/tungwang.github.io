import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import exifr from 'exifr';

const minimumRequestInterval = 1100;
let geocodeQueue = Promise.resolve();
let lastRequestAt = 0;
let cacheWrite = Promise.resolve();

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const administrativeSuffix =
  /\s+(?:autonomous\s+(?:county|prefecture|region)|special\s+administrative\s+region|district|county|township|town|municipality|prefecture|province|city|village|borough)$/i;

const cleanPlaceName = (value) => {
  let name = typeof value === 'string' ? value.trim() : '';
  while (administrativeSuffix.test(name)) name = name.replace(administrativeSuffix, '').trim();
  return name;
};

const regionFromIso = (address = {}) => {
  const iso = address['ISO3166-2-lvl4'];
  return {
    'CN-BJ': 'Beijing',
    'CN-CQ': 'Chongqing',
    'CN-SH': 'Shanghai',
    'CN-TJ': 'Tianjin',
    'JP-13': 'Tokyo',
  }[iso];
};

const fullPlace = (address = {}) => {
  const locality =
    address.city_district ||
    address.borough ||
    address.county ||
    address.municipality ||
    address.town ||
    address.city ||
    address.village;
  const levels = [
    locality,
    address.city || address.municipality || address.state_district,
    address.province || address.state || regionFromIso(address),
    address.country,
  ]
    .map(cleanPlaceName)
    .filter(Boolean);
  return levels.filter((name, index) => levels.indexOf(name) === index).join(', ');
};

const readCache = async (path) => {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
};

const saveCache = (path, cache) => {
  cacheWrite = cacheWrite.then(async () => {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(cache, null, 2)}\n`);
    await rename(temporary, path);
  });
  return cacheWrite;
};

const sidecarCoordinates = async (path) => {
  const candidates = [`${path}.json`, join(dirname(path), `${basename(path, extname(path))}.json`)];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(await readFile(candidate, 'utf8'));
      const metadata = Array.isArray(parsed) ? parsed[0] : parsed;
      let latitude = Number(metadata?.['EXIF:GPSLatitude'] ?? metadata?.GPSLatitude);
      let longitude = Number(metadata?.['EXIF:GPSLongitude'] ?? metadata?.GPSLongitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const latitudeRef = metadata?.['EXIF:GPSLatitudeRef'] ?? metadata?.GPSLatitudeRef;
      const longitudeRef = metadata?.['EXIF:GPSLongitudeRef'] ?? metadata?.GPSLongitudeRef;
      if (latitudeRef === 'S') latitude = -Math.abs(latitude);
      if (longitudeRef === 'W') longitude = -Math.abs(longitude);
      return { latitude, longitude };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return undefined;
};

export const coordinatesFor = async (path) => {
  const gps = await exifr.gps(path).catch(() => undefined);
  if (Number.isFinite(gps?.latitude) && Number.isFinite(gps?.longitude)) {
    return { latitude: gps.latitude, longitude: gps.longitude };
  }
  return sidecarCoordinates(path);
};

export const createLocationResolver = async ({ cachePath, log = () => {} }) => {
  const cache = await readCache(cachePath);

  return async ({ latitude, longitude }) => {
    const key = `v3:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    if (Object.hasOwn(cache, key)) return cache[key] || undefined;

    const request = async () => {
      const wait = minimumRequestInterval - (Date.now() - lastRequestAt);
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();

      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.search = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        format: 'jsonv2',
        addressdetails: '1',
        zoom: '14',
        'accept-language': 'en',
      });
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TungWangGallery/1.0 (https://tung.mockingbird.team)',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Location service returned HTTP ${response.status}.`);
      const result = await response.json();
      const place = fullPlace(result?.address);
      cache[key] = place || null;
      await saveCache(cachePath, cache);
      if (place) log(`Location: ${place}`);
      return place || undefined;
    };

    const result = geocodeQueue.then(request, request);
    geocodeQueue = result.catch(() => undefined);
    return result;
  };
};
