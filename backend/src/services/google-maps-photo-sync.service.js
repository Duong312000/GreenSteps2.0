const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { GreenService } = require('../models');

const TARGET_DIR = path.resolve(__dirname, '../../../my-app/public/image/places');

/**
 * Downloads a file from an HTTP/HTTPS URL, following up to maxRedirects redirects.
 */
function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download image. Status code: ${res.statusCode}`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => resolve(destPath));
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Search Google Places (New) by textQuery and retrieve place information & photos.
 */
function searchGooglePlace(query, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ textQuery: query });
    const options = {
      hostname: 'places.googleapis.com',
      path: '/v1/places:searchText',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.photos,places.rating'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.places && json.places.length > 0) {
            resolve(json.places[0]);
          } else {
            resolve(null);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Sync Google Maps photo for a single service.
 * @param {Object} service - GreenService instance or plain object
 * @returns {Promise<{ success: boolean, imageUrl?: string, error?: string }>}
 */
async function syncServicePhotoFromGoogle(service) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GOOGLE_MAPS_API_KEY is not configured' };
  }

  try {
    if (!fs.existsSync(TARGET_DIR)) {
      fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    const searchQuery = `${service.name_service} ${service.destination || ''} Việt Nam`.trim();
    console.log(`[GooglePhotoSync] Searching Google Places for: "${searchQuery}"`);

    const place = await searchGooglePlace(searchQuery, apiKey);
    if (!place) {
      console.log(`[GooglePhotoSync] No Google Place found for "${searchQuery}"`);
      return { success: false, error: 'No place found' };
    }

    if (!place.photos || place.photos.length === 0) {
      console.log(`[GooglePhotoSync] Place found ("${place.displayName?.text}") but has no photos.`);
      return { success: false, error: 'No photos available' };
    }

    const photoName = place.photos[0].name;
    const photoMediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}`;

    const safeFilename = `${service.id.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.jpg`;
    const destFilePath = path.join(TARGET_DIR, safeFilename);

    console.log(`[GooglePhotoSync] Downloading photo from Google Places to: ${destFilePath}`);
    await downloadFile(photoMediaUrl, destFilePath);

    const relativeImageUrl = `image/places/${safeFilename}`;

    // Update in MongoDB
    await GreenService.update(
      {
        image_url: relativeImageUrl,
        google_place_id: place.id,
        address: place.formattedAddress || service.address
      },
      { where: { id: service.id } }
    );

    console.log(`[GooglePhotoSync] Successfully saved & linked "${service.name_service}" -> ${relativeImageUrl}`);
    return { success: true, imageUrl: relativeImageUrl, placeId: place.id };
  } catch (err) {
    console.error(`[GooglePhotoSync] Error syncing photo for ${service.name_service}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sync all Google Maps services (is_partner: false) that need photos.
 */
async function syncAllGooglePlacesPhotos() {
  const services = await GreenService.findAll({
    where: { is_partner: false }
  });

  console.log(`[GooglePhotoSync] Found ${services.length} services to sync photos.`);
  const results = [];

  for (const s of services) {
    const res = await syncServicePhotoFromGoogle(s);
    results.push({ id: s.id, name: s.name_service, ...res });
    // Brief delay to be polite with rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  return results;
}

module.exports = {
  syncServicePhotoFromGoogle,
  syncAllGooglePlacesPhotos
};

