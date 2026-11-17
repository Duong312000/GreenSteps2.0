const express = require('express');
const { createMapsRateLimiter } = require('../middlewares/maps-rate-limit.middleware');

function createMapsRouter({ apiKey = process.env.GOOGLE_MAPS_API_KEY, fetchImpl = globalThis.fetch } = {}) {
  const router = express.Router();
  const configuredKey = typeof apiKey === 'string' ? apiKey.trim() : '';

const PRESEEDED_POPULAR_PLACES = [
  {
    id: "place_dalat_chodem",
    title: "Chợ Đêm Đà Lạt",
    address: "Đường Nguyễn Thị Minh Khai, Phường 1, Đà Lạt, Lâm Đồng",
    rating: 4.5,
    reviewsCount: 19350,
    lat: 11.9414015,
    lng: 108.4372912,
    photos: ["image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg"],
    img: "image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg",
    hours: "Đang mở cửa",
    destination: "Đà Lạt",
    types: ["market", "point_of_interest"]
  },
  {
    id: "place_dalat_hoxuanhuong",
    title: "Hồ Xuân Hương Đà Lạt",
    address: "Phường 1, Đà Lạt, Lâm Đồng",
    rating: 4.8,
    reviewsCount: 15420,
    lat: 11.940419,
    lng: 108.445213,
    photos: ["image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg"],
    img: "image/greensteps/da-lat/da-lat-ho-xuan-huong-01.jpg",
    hours: "Mở cả ngày",
    destination: "Đà Lạt",
    types: ["tourist_attraction", "natural_feature"]
  },
  {
    id: "place_dalat_lamvien",
    title: "Quảng trường Lâm Viên",
    address: "Đường Trần Quốc Toản, Phường 10, Đà Lạt, Lâm Đồng",
    rating: 4.6,
    reviewsCount: 22100,
    lat: 11.936056,
    lng: 108.445258,
    photos: ["image/greensteps/da-lat/da-lat-quang-truong-lam-vien-01.jpg"],
    img: "image/greensteps/da-lat/da-lat-quang-truong-lam-vien-01.jpg",
    hours: "Mở cả ngày",
    destination: "Đà Lạt",
    types: ["point_of_interest", "park"]
  },
  {
    id: "place_hoian_phoco",
    title: "Phố cổ Hội An",
    address: "Phường Minh An, Hội An, Quảng Nam",
    rating: 4.9,
    reviewsCount: 38900,
    lat: 15.877028,
    lng: 108.326233,
    photos: ["image/greensteps/da-nang-hoi-an/hoi-an-pho-co-01.jpg"],
    img: "image/greensteps/da-nang-hoi-an/hoi-an-pho-co-01.jpg",
    hours: "Mở cả ngày",
    destination: "Đà Nẵng - Hội An",
    types: ["historical_landmark", "tourist_attraction"]
  },
  {
    id: "place_hoian_chuacau",
    title: "Chùa Cầu Hội An",
    address: "Đường Nguyễn Thị Minh Khai, Phường Minh An, Hội An, Quảng Nam",
    rating: 4.7,
    reviewsCount: 14200,
    lat: 15.877139,
    lng: 108.325889,
    photos: ["image/greensteps/da-nang-hoi-an/hoi-an-chua-cau-01.jpg"],
    img: "image/greensteps/da-nang-hoi-an/hoi-an-chua-cau-01.jpg",
    hours: "Đang mở cửa",
    destination: "Đà Nẵng - Hội An",
    types: ["tourist_attraction", "place_of_worship"]
  },
  {
    id: "place_hoian_anbang",
    title: "Bãi biển An Bàng",
    address: "Đường Hai Bà Trưng, Phường Cẩm An, Hội An, Quảng Nam",
    rating: 4.6,
    reviewsCount: 9800,
    lat: 15.918917,
    lng: 108.339250,
    photos: ["image/greensteps/da-nang-hoi-an/da-nang-my-khe-01.jpg"],
    img: "image/greensteps/da-nang-hoi-an/da-nang-my-khe-01.jpg",
    hours: "Mở cả ngày",
    destination: "Đà Nẵng - Hội An",
    types: ["natural_feature", "beach"]
  },
  {
    id: "place_phuyen_ghenhdadia",
    title: "Ghềnh Đá Đĩa Phú Yên",
    address: "Xã An Ninh Đông, Huyện Tuy An, Phú Yên",
    rating: 4.8,
    reviewsCount: 12500,
    lat: 13.364444,
    lng: 109.303889,
    photos: ["image/greensteps/phu-yen/phu-yen-ghenh-da-dia-01.jpg"],
    img: "image/greensteps/phu-yen/phu-yen-ghenh-da-dia-01.jpg",
    hours: "Đang mở cửa",
    destination: "Phú Yên",
    types: ["tourist_attraction", "natural_feature"]
  },
  {
    id: "place_phuyen_baixep",
    title: "Bãi Xép Phú Yên",
    address: "Xã An Chấn, Huyện Tuy An, Phú Yên",
    rating: 4.7,
    reviewsCount: 8900,
    lat: 13.197028,
    lng: 109.299500,
    photos: ["image/greensteps/phu-yen/phu-yen-bai-xep-01.jpg"],
    img: "image/greensteps/phu-yen/phu-yen-bai-xep-01.jpg",
    hours: "Mở cả ngày",
    destination: "Phú Yên",
    types: ["tourist_attraction", "beach"]
  },
  {
    id: "place_phuyen_thapnhan",
    title: "Tháp Nhạn",
    address: "Phường 1, Thành phố Tuy Hòa, Phú Yên",
    rating: 4.6,
    reviewsCount: 7100,
    lat: 13.089500,
    lng: 109.296500,
    photos: ["image/greensteps/phu-yen/phu-yen-thap-nhan-01.jpg"],
    img: "image/greensteps/phu-yen/phu-yen-thap-nhan-01.jpg",
    hours: "Đang mở cửa",
    destination: "Phú Yên",
    types: ["historical_landmark", "tourist_attraction"]
  },
  {
    id: "place_danang_caurong",
    title: "Cầu Rồng Đà Nẵng",
    address: "Đường Nguyễn Văn Linh, Phước Ninh, Hải Châu, Đà Nẵng",
    rating: 4.8,
    reviewsCount: 31200,
    lat: 16.061111,
    lng: 108.227222,
    photos: ["image/greensteps/da-nang-hoi-an/da-nang-cau-rong-01.jpg"],
    img: "image/greensteps/da-nang-hoi-an/da-nang-cau-rong-01.jpg",
    hours: "Mở cả ngày",
    destination: "Đà Nẵng - Hội An",
    types: ["tourist_attraction", "point_of_interest"]
  },
  {
    id: "place_danang_banahills",
    title: "Bà Nà Hills",
    address: "Xã Hòa Ninh, Huyện Hòa Vang, Đà Nẵng",
    rating: 4.7,
    reviewsCount: 45000,
    lat: 15.998944,
    lng: 107.995806,
    photos: ["image/greensteps/da-nang-hoi-an/da-nang-ba-na-hills-01.jpg"],
    img: "image/greensteps/da-nang-hoi-an/da-nang-ba-na-hills-01.jpg",
    hours: "Đang mở cửa",
    destination: "Đà Nẵng - Hội An",
    types: ["tourist_attraction", "amusement_park"]
  },
  {
    id: "place_danang_sontra",
    title: "Bán đảo Sơn Trà",
    address: "Quận Sơn Trà, Đà Nẵng",
    rating: 4.8,
    reviewsCount: 16800,
    lat: 16.115833,
    lng: 108.271389,
    photos: ["image/greensteps/da-nang-hoi-an/da-nang-son-tra-01.jpg"],
    img: "image/greensteps/da-nang-hoi-an/da-nang-son-tra-01.jpg",
    hours: "Mở cả ngày",
    destination: "Đà Nẵng - Hội An",
    types: ["natural_feature", "tourist_attraction"]
  }
];

/**
 * 0. Popular Places Batch Endpoint (Single round-trip, pre-seeded 5ms response)
 */
router.get('/popular-places', async (req, res) => {
  try {
    const cachedBatch = await getCache('places:popular:batch');
    if (cachedBatch && Array.isArray(cachedBatch) && cachedBatch.length > 0) {
      return res.json({ success: true, places: cachedBatch, cached: true });
    }

    // Return pre-seeded high quality places directly (0ms latency, zero third-party calls)
    await setCache('places:popular:batch', PRESEEDED_POPULAR_PLACES, 14);
    return res.json({ success: true, places: PRESEEDED_POPULAR_PLACES, cached: false });
  } catch (err) {
    return res.json({ success: true, places: PRESEEDED_POPULAR_PLACES, cached: false });
  }
});

/**
 * 0. Cache Statistics & Health Endpoint
 */
router.get('/cache/stats', async (req, res) => {
  const stats = await getCacheStats();
  return res.json({ success: true, ...stats });
});
  const requireKey = (res) => {
    if (configuredKey) return true;
    res.set('Cache-Control', 'no-store');
    res.status(503).json({ success: false, code: 'MAPS_NOT_CONFIGURED', message: 'Google Maps is not configured.' });
    return false;
  };

  const fetchGoogleJson = async (url, options) => {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Google Maps request failed.');
    return response.json();
  };

  const placeResponse = (place) => {
    const openNow = place.currentOpeningHours?.openNow;
    const rawPhotos = Array.isArray(place.photos) ? place.photos : [];
    const photoUrls = rawPhotos.map(p => {
      const name = p.name || '';
      return name ? `/api/maps/places/photo?name=${encodeURIComponent(name)}` : '';
    }).filter(Boolean);

    return {
      id: place.id,
      title: place.displayName?.text || '',
      address: place.formattedAddress || '',
      rating: place.rating ?? null,
      reviewsCount: place.userRatingCount ?? 0,
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      photos: photoUrls,
      img: photoUrls[0] || '',
      hours: openNow === undefined ? null : (openNow ? 'Đang mở cửa' : 'Đã đóng cửa'),
      weekdayText: place.currentOpeningHours?.weekdayDescriptions || [],
      phone: place.nationalPhoneNumber || '',
      website: place.websiteUri || '',
      googleReviews: [],
      googleMapsUrl: place.googleMapsUri || '',
      types: place.types || []
    };
  };

  router.get('/cache/stats', (_req, res) => res
    .set('Cache-Control', 'no-store')
    .json({ success: true, active: false, cacheDisabled: true, count: null }));
  const mapsRateLimiter = createMapsRateLimiter();
  router.use(function mapsRateLimitMiddleware(req, res, next) {
    return mapsRateLimiter(req, res, next);
  });

  router.get('/places/search', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!requireKey(res)) return;
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!query || query.length > 200) {
      return res.status(400).json({ success: false, message: 'query must contain between 1 and 200 characters.' });
    }

    try {
      const data = await fetchGoogleJson('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': configuredKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.currentOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.types,places.googleMapsUri,places.photos'
        },
        body: JSON.stringify({ textQuery: query, languageCode: 'vi' })
      });
      const places = Array.isArray(data.places) ? data.places.map(placeResponse) : [];
      return res.json({ success: true, places, cached: false });
    } catch {
      return res.status(502).json({ success: false, message: 'Google Places search is temporarily unavailable.' });
    }
  });

  router.get('/places/photo', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!name || !name.startsWith('places/')) {
      return res.status(400).json({ success: false, message: 'name query parameter is required.' });
    }
    if (!configuredKey) {
      return res.redirect(302, '/image/Viet Nam.png');
    }
    const targetUrl = `https://places.googleapis.com/v1/${name}/media?maxHeightPx=800&maxWidthPx=1200&key=${configuredKey}`;
    return res.redirect(302, targetUrl);
  });

  router.get('/places/details/:placeId', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!requireKey(res)) return;
    const placeId = typeof req.params.placeId === 'string' ? req.params.placeId.trim() : '';
    if (!placeId || placeId.length > 256 || !/^[A-Za-z0-9_-]+$/.test(placeId)) {
      return res.status(400).json({ success: false, message: 'placeId is invalid.' });
    }

    try {
      const place = await fetchGoogleJson(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=vi`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': configuredKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,location,currentOpeningHours,websiteUri,nationalPhoneNumber,types,googleMapsUri,photos'
        }
      });
      if (!place || place.error) {
        return res.status(404).json({ success: false, message: 'Place not found.' });
      }
      return res.json({ success: true, place: placeResponse(place), cached: false });
    } catch {
      return res.status(502).json({ success: false, message: 'Google Place details are temporarily unavailable.' });
    }
  });

  router.post('/routes', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!requireKey(res)) return;
    const { origin, destination, waypoints, travelMode } = req.body || {};
    const validPoint = point => point && point.lat !== null && point.lat !== undefined && String(point.lat).trim() !== ''
      && point.lng !== null && point.lng !== undefined && String(point.lng).trim() !== ''
      && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
      && Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180;
    if (!validPoint(origin) || !validPoint(destination) || (waypoints !== undefined && (!Array.isArray(waypoints) || waypoints.length > 25 || waypoints.some(point => !validPoint(point))))) {
      return res.status(400).json({ success: false, message: 'Valid origin, destination, and up to 25 waypoints are required.' });
    }

    try {
      const safeMode = ['WALK', 'TWO_WHEELER', 'BICYCLE', 'TRANSIT'].includes(travelMode) ? travelMode : 'DRIVE';
      const payload = {
        origin: { location: { latLng: { latitude: Number(origin.lat), longitude: Number(origin.lng) } } },
        destination: { location: { latLng: { latitude: Number(destination.lat), longitude: Number(destination.lng) } } },
        travelMode: safeMode,
        languageCode: 'vi'
      };
      if (Array.isArray(waypoints) && waypoints.length) {
        payload.intermediates = waypoints.map(point => ({ location: { latLng: { latitude: Number(point.lat), longitude: Number(point.lng) } } }));
      }

      const data = await fetchGoogleJson('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': configuredKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps'
        },
        body: JSON.stringify(payload)
      });
      if (!Array.isArray(data.routes) || !data.routes.length) {
        return res.status(404).json({ success: false, message: 'No route found.' });
      }
      const route = data.routes[0];
      const distanceMeters = Number(route.distanceMeters) || 0;
      const durationSec = Number.parseInt(String(route.duration || '').replace(/s$/, ''), 10) || 0;
      const steps = (route.legs?.[0]?.steps || []).map(step => {
        const meters = Number(step.distanceMeters) || 0;
        const seconds = Number.parseInt(String(step.staticDuration || '').replace(/s$/, ''), 10) || 0;
        return {
          instruction: step.navigationInstruction?.instructions || 'Đi tiếp',
          maneuver: step.navigationInstruction?.maneuver || 'STRAIGHT',
          distance: meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`,
          duration: seconds >= 60 ? `${Math.round(seconds / 60)} phút` : `${seconds} giây`,
          meters
        };
      });
      return res.json({
        success: true,
        distance: `${(distanceMeters / 1000).toFixed(1)} km`,
        duration: `${Math.max(1, Math.round(durationSec / 60))} phút`,
        distanceMeters,
        durationSeconds: durationSec,
        encodedPolyline: route.polyline?.encodedPolyline || '',
        steps,
        travelMode: safeMode,
        cached: false
      });
    } catch {
      return res.status(502).json({ success: false, message: 'Google Routes is temporarily unavailable.' });
    }
  });

  return router;
}

module.exports = createMapsRouter();
module.exports.createMapsRouter = createMapsRouter;
