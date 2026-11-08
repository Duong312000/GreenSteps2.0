const express = require('express');
const router = express.Router();
const { getCache, setCache, getCacheStats } = require('../services/maps-cache.service');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBlR9BgBQW4J-HoaA5hlS3Ov8TmPw6nebA';

/**
 * 0. Cache Statistics & Health Endpoint
 */
router.get('/cache/stats', async (req, res) => {
  const stats = await getCacheStats();
  return res.json({ success: true, ...stats });
});

/**
 * 1. Search Google Places (Places API New) with 7-Day MongoDB Cache
 */
router.get('/places/search', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'query is required' });
    }

    const cacheKey = `search:${query.toLowerCase().trim()}`;
    const cachedPlaces = await getCache(cacheKey);
    if (cachedPlaces) {
      return res.json({ success: true, places: cachedPlaces, cached: true });
    }

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.photos,places.currentOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.reviews,places.types,places.priceLevel'
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'vi'
      })
    });

    const data = await response.json();
    if (!data.places || data.places.length === 0) {
      return res.json({ success: true, places: [] });
    }

    const places = data.places.map(p => {
      const photoUrls = (p.photos || []).slice(0, 8).map(ph => 
        `https://places.googleapis.com/v1/${ph.name}/media?key=${GOOGLE_MAPS_API_KEY}&maxWidthPx=800`
      );

      const reviews = (p.reviews || []).slice(0, 5).map(r => ({
        author: r.authorAttribution?.displayName || 'Khách Google Maps',
        photo: r.authorAttribution?.photoUri || '',
        rating: r.rating || 5,
        time: r.relativePublishTimeDescription || 'Gần đây',
        text: r.originalText?.text || r.text?.text || 'Trải nghiệm du lịch xanh tuyệt vời.'
      }));

      return {
        id: p.id,
        title: p.displayName?.text || '',
        address: p.formattedAddress || '',
        rating: p.rating || 4.8,
        reviewsCount: p.userRatingCount || 0,
        lat: p.location?.latitude || null,
        lng: p.location?.longitude || null,
        photos: photoUrls,
        img: photoUrls.length > 0 ? photoUrls[0] : '',
        hours: p.currentOpeningHours ? (p.currentOpeningHours.openNow ? 'Đang mở cửa' : 'Đã đóng cửa') : 'Đang mở cửa',
        weekdayText: p.currentOpeningHours?.weekdayDescriptions || [],
        phone: p.nationalPhoneNumber || '',
        website: p.websiteUri || '',
        googleReviews: reviews,
        types: p.types || []
      };
    });

    // Save to MongoDB Cache for 7 days
    await setCache(cacheKey, places, 7);

    return res.json({ success: true, places, cached: false });
  } catch (error) {
    console.error('Google Places Search error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 2. Get Place Details by Google Place ID with 7-Day MongoDB Cache
 */
router.get('/places/details/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

    const cacheKey = `details:${placeId}`;
    const cachedPlace = await getCache(cacheKey);
    if (cachedPlace) {
      return res.json({ success: true, place: cachedPlace, cached: true });
    }

    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=vi`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,location,photos,currentOpeningHours,websiteUri,nationalPhoneNumber,reviews,types,priceLevel'
      }
    });

    const p = await response.json();
    if (!p || p.error) {
      return res.status(404).json({ success: false, message: p.error?.message || 'Place not found' });
    }

    const photoUrls = (p.photos || []).slice(0, 8).map(ph => 
      `https://places.googleapis.com/v1/${ph.name}/media?key=${GOOGLE_MAPS_API_KEY}&maxWidthPx=800`
    );

    const reviews = (p.reviews || []).slice(0, 5).map(r => ({
      author: r.authorAttribution?.displayName || 'Khách Google Maps',
      photo: r.authorAttribution?.photoUri || '',
      rating: r.rating || 5,
      time: r.relativePublishTimeDescription || 'Gần đây',
      text: r.originalText?.text || r.text?.text || 'Trải nghiệm rất tốt.'
    }));

    const result = {
      id: p.id,
      title: p.displayName?.text || '',
      address: p.formattedAddress || '',
      rating: p.rating || 4.8,
      reviewsCount: p.userRatingCount || 0,
      lat: p.location?.latitude || null,
      lng: p.location?.longitude || null,
      photos: photoUrls,
      img: photoUrls.length > 0 ? photoUrls[0] : '',
      hours: p.currentOpeningHours ? (p.currentOpeningHours.openNow ? 'Đang mở cửa' : 'Đã đóng cửa') : 'Đang mở cửa',
      weekdayText: p.currentOpeningHours?.weekdayDescriptions || [],
      phone: p.nationalPhoneNumber || '',
      website: p.websiteUri || '',
      googleReviews: reviews,
      types: p.types || []
    };

    // Save to MongoDB Cache for 7 days
    await setCache(cacheKey, result, 7);

    return res.json({ success: true, place: result, cached: false });
  } catch (error) {
    console.error('Google Place details error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 3. Compute Real Route with Google Routes API (v2) with 14-Day MongoDB Cache
 */
router.post('/routes', async (req, res) => {
  try {
    const { origin, destination, waypoints, travelMode } = req.body;
    if (!origin || !destination) {
      return res.status(400).json({ success: false, message: 'origin and destination required' });
    }

    const oLat = Number(origin.lat).toFixed(4);
    const oLng = Number(origin.lng).toFixed(4);
    const dLat = Number(destination.lat).toFixed(4);
    const dLng = Number(destination.lng).toFixed(4);
    const wpKey = Array.isArray(waypoints) 
      ? waypoints.map(w => `${Number(w.lat).toFixed(4)},${Number(w.lng).toFixed(4)}`).join('|') 
      : '';
    const cacheKey = `route:${oLat},${oLng}->${dLat},${dLng}:${travelMode || 'DRIVE'}:${wpKey}`;

    const cachedRoute = await getCache(cacheKey);
    if (cachedRoute) {
      return res.json({ ...cachedRoute, cached: true });
    }

    const safeMode = (travelMode === 'WALK' || travelMode === 'TWO_WHEELER') ? travelMode : 'DRIVE';
    const payload = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: safeMode,
      languageCode: 'vi'
    };

    if (Array.isArray(waypoints) && waypoints.length > 0) {
      payload.intermediates = waypoints.map(wp => ({
        location: { latLng: { latitude: wp.lat, longitude: wp.lng } }
      }));
    }

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ success: false, message: 'No route found' });
    }

    const route = data.routes[0];
    const distanceMeters = route.distanceMeters || 0;
    const durationSec = parseInt(route.duration?.replace('s', '') || '0', 10);

    const km = (distanceMeters / 1000).toFixed(1) + ' km';
    const mins = Math.max(1, Math.round(durationSec / 60)) + ' phút';

    // Parse turn-by-turn navigation steps
    const rawSteps = route.legs?.[0]?.steps || [];
    const steps = rawSteps.map(s => {
      const stepMeters = s.distanceMeters || 0;
      const stepDist = stepMeters >= 1000 ? (stepMeters / 1000).toFixed(1) + ' km' : stepMeters + ' m';
      const stepSec = parseInt(s.staticDuration?.replace('s', '') || '0', 10);
      const stepDur = stepSec >= 60 ? Math.round(stepSec / 60) + ' phút' : stepSec + ' giây';
      return {
        instruction: s.navigationInstruction?.instructions || 'Đi tiếp',
        maneuver: s.navigationInstruction?.maneuver || 'STRAIGHT',
        distance: stepDist,
        duration: stepDur,
        meters: stepMeters
      };
    });

    const result = {
      success: true,
      distance: km,
      duration: mins,
      distanceMeters,
      durationSeconds: durationSec,
      encodedPolyline: route.polyline?.encodedPolyline || '',
      steps,
      travelMode: safeMode
    };

    // Save to MongoDB Cache for 14 days
    await setCache(cacheKey, result, 14);

    return res.json({ ...result, cached: false });
  } catch (error) {
    console.error('Google Routes error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
