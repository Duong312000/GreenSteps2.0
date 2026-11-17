const fs = require('fs');
const path = require('path');
const { BANKS, fileExists, getFileMd5 } = require('./build-services-image-mapping');

const services = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backups/services-pre-update-backup.json'), 'utf8'));

// Specific dedicated cover mapping for key landmark venues
const VENUE_COVERS = {
  // Attractions Đà Lạt
  'SRV_DL_LAMVIEN01': 'image/da-lat/da-lat-quang-truong-lam-vien-01.jpg',
  'SRV_DL_XUANHUONG01': 'image/da-lat/da-lat-ho-xuan-huong-01.jpg',
  'srv_par_1': 'image/da-lat/da-lat-ho-xuan-huong-01.jpg',
  'SRV_DL_TUYENLAM01': 'image/da-lat/da-lat-ho-tuyen-lam-01.jpg',
  'GGP_DL_TUYENLAM': 'image/places/ggp_dl_tuyenlam.jpg',
  'SRV_DL_TRUCLAM01': 'image/da-lat/da-lat-kien-truc-co-01.jpg',
  'SRV_DL_LINHPHUOC01': 'image/da-lat/da-lat-chua-linh-phuoc-01.jpg',
  'srv_par_2': 'image/da-lat/da-lat-thac-nuoc-01.jpg',
  'GGP_DL_DATANLA': 'image/places/ggp_dl_datanla.jpg',
  'GGP_DALAT_DATANLA': 'image/places/ggp_dalat_datanla.jpg',
  'GGP_DL_CAUDAT': 'image/places/ggp_dl_caudat.jpg',
  'SRV_DL_LANGBIANG01': 'image/da-lat/da-lat-toan-canh-thanh-pho-01.jpg',
  'srv_par_3': 'image/da-lat/da-lat-vuon-hoa-01.jpg',
  'ser_1783935927448': 'image/da-lat/da-lat-vuon-hoa-01.jpg',
  'srv_duong_3': 'image/da-lat/da-lat-rung-thong-san-may-01.jpg',

  // Attractions Đà Nẵng
  'SRV_DN_DRAGON01': 'image/da-nang-hoi-an/da-nang-cau-rong-phun-lua-01.jpg',
  'SRV_DN_SONTRA01': 'image/da-nang-hoi-an/da-nang-son-tra-rung-xanh-01.jpg',
  'GGP_DN_SONTRA': 'image/places/ggp_dn_sontra.jpg',
  'SRV_DN_GOLDEN01': 'image/da-nang-hoi-an/da-nang-cau-vang-ba-na-hills-01.jpg',
  'SRV_DN_MARBLE01': 'image/places/ggp_dn_nguhanhson.jpg',
  'GGP_DN_NGUHANHSON': 'image/places/ggp_dn_nguhanhson.jpg',
  'SRV_DN_CHAM01': 'image/da-nang-hoi-an/da-nang-bien-my-khe-01.jpg',

  // Attractions Hội An
  'SRV_HA_TRAQUE01': 'image/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg',
  'GGP_HA_TRAQUE': 'image/places/ggp_ha_traque.jpg',
  'GGP_HOIAN_TRAQUE': 'image/places/ggp_hoian_traque.jpg',
  'GGP_HA_BAYMAU': 'image/places/ggp_ha_baymau.jpg',
  'GGP_HA_THANHHA': 'image/places/ggp_ha_thanhha.jpg',
  'srv_demo_detail_hoian_herbal': 'image/da-nang-hoi-an/hoi-an-lang-huong-thu-cong-01.jpg',

  // Attractions Phú Yên
  'SRV_PY_GANHDA01': 'image/places/ggp_py_ganhdadia.jpg',
  'GGP_PY_GANHDADIA': 'image/places/ggp_py_ganhdadia.jpg',
  'SRV_PY_BAIXEP01': 'image/phu-yen/phu-yen-bai-xep-checkin-01.jpg',
  'SRV_PY_MUIDIEN01': 'image/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
  'GGP_PY_MAIDAT': 'image/places/ggp_py_maidat.jpg',
  'SRV_PY_HONYEN01': 'image/places/ggp_py_honyen.jpg',
  'GGP_PY_HONYEN': 'image/places/ggp_py_honyen.jpg',

  // Attractions Ninh Bình, Sa Pa, Hà Giang
  'GGP_NB_TRANGAN': 'image/places/ggp_nb_trangan.jpg',
  'GGP_NB_CUC_PHUONG': 'image/places/ggp_nb_cuc_phuong.jpg',
  'GGP_SP_CATCAT': 'image/places/ggp_sp_catcat.jpg',
  'GGP_HG_MAPILENG': 'image/places/ggp_hg_mapileng.jpg',

  // Food Services
  'GGP_DL_LANGCHAY': 'image/places/ggp_dl_langchay.jpg',
  'srv_duong_2': 'image/food/vegan.jpg',
  'srv_duong_5': 'image/food/tea.jpg',
  'SRV_DL_CAUKDAT01': 'image/food/cafe.png',
  'ser_1783939184743': 'image/services/food_organic_vietnamese.png',
  'srv_demo_detail_dalat_farm_table': 'image/food/local.jpg',
  'GGP_HA_ANLACCHAY': 'image/places/ggp_ha_anlacchay.jpg',
  'GGP_DN_QUANCHAY': 'image/places/ggp_dn_quanchay.jpg',
  'SRV_PY_DAMOLOAN01': 'image/phu-yen/phu-yen-lang-chai-vung-ro-01.jpg',

  // Transport Services
  'SRV_DL_EBIKE01': 'image/transport/rental-electric-motorbike.jpg',
  'srv_duong_4': 'image/transport/rental-electric-motorbike.jpg',
  'GGP_DL_BUSXANH': 'image/places/ggp_dl_busxanh.jpg',
  'SRV_DN_EBUS01': 'image/transport/shared-minibus-green.jpg',
  'GGP_DN_BUSDIEN': 'image/places/ggp_dn_busdien.jpg',
  'GGP_HA_XEDAPTRE': 'image/places/ggp_ha_xedaptre.jpg',
  'srv_demo_detail_hoian_cycle': 'image/transport/rental-motorbike.jpg',
  'ser_1794853337500': 'image/transport/rental-motorbike.jpg',
  'SRV_PY_EBIKE01': 'image/transport/shared-mpv-teal.jpg',

  // Stays
  'SRV_DL_HOMESTAY01': 'image/da-lat/da-lat-nghi-duong-ven-ho-01.jpg',
  'srv_duong_1': 'image/services/stay_homestay_dalat.png',
  'ser_1783938578484': 'image/da-lat/da-lat-rung-thong-01.jpg',
  'ser_1783938578281': 'image/services/stay_hoa_da_quy.png',
  'ser_1783938577799': 'image/services/stay_mai_anh_dao.png',
  'ser_1783938577656': 'image/services/stay_green_boutique.png',
  'ser_1783938577946': 'image/places/ggp_dl_pineretreat.jpg',
  'GGP_DL_PINERETREAT': 'image/places/ggp_dl_pineretreat.jpg',
  'srv_par_4': 'image/da-lat/da-lat-rung-thong-02.jpg',
  'srv_demo_detail_dalat_garden': 'image/da-lat/da-lat-kien-truc-co-01.jpg',
  'SRV_HA_ECOSTAY01': 'image/services/stay_hoi_an_eco.png',
  'GGP_HA_RIVERSTAY': 'image/places/ggp_ha_riverstay.jpg',
  'GGP_HOIAN_ANBANG': 'image/places/ggp_hoian_anbang.jpg',
  'srv_demo_detail_hoian_riverside': 'image/da-nang-hoi-an/da-nang-ba-na-hills-kien-truc-01.jpg',
  'SRV_PY_HOMESTAY01': 'image/services/stay_hon_yen.png',
  'GGP_PY_HOMESTAY': 'image/places/ggp_py_homestay.jpg',
  'srv_demo_detail_phuyen_seaside': 'image/phu-yen/phu-yen-canh-quan-xanh-01.jpg',
  'GGP_NB_ECORESORT': 'image/places/ggp_nb_ecoresort.jpg'
};

// Function to get distinct 5 gallery images
function buildGalleryForService(service, cover, index) {
  const type = service.type || 'attraction';
  const dest = (service.destination || '').toLowerCase();
  
  let pool = [];
  if (type === 'transport') {
    pool = BANKS.transport_eco;
  } else if (type === 'food') {
    if (dest.includes('phú yên') || dest.includes('phu yen')) pool = BANKS.phuyen_food;
    else if (dest.includes('hội an') || dest.includes('đà nẵng') || dest.includes('danang') || dest.includes('hoi an')) pool = BANKS.danang_hoian_food;
    else pool = BANKS.dalat_food;
  } else if (type === 'stay') {
    if (dest.includes('phú yên') || dest.includes('phu yen')) pool = BANKS.phuyen_stay;
    else if (dest.includes('hội an') || dest.includes('đà nẵng') || dest.includes('danang') || dest.includes('hoi an')) pool = BANKS.danang_hoian_stay;
    else if (dest.includes('ninh bình') || dest.includes('ninh binh')) pool = BANKS.ninhbinh_stay;
    else pool = BANKS.dalat_stay;
  } else {
    // attraction
    if (dest.includes('phú yên') || dest.includes('phu yen')) pool = BANKS.phuyen_attraction;
    else if (dest.includes('hội an') || dest.includes('hoi an')) pool = BANKS.hoian_attraction;
    else if (dest.includes('đà nẵng') || dest.includes('danang')) pool = BANKS.danang_attraction;
    else if (dest.includes('ninh bình') || dest.includes('ninh binh')) pool = BANKS.ninhbinh_attraction;
    else if (dest.includes('sa pa') || dest.includes('sapa')) pool = BANKS.sapa_attraction;
    else if (dest.includes('hà giang') || dest.includes('ha giang')) pool = BANKS.hagiang_attraction;
    else pool = BANKS.dalat_attraction;
  }

  // Build unique gallery starting with cover
  const gallery = [cover];
  const seenHashes = new Set();
  const coverHash = getFileMd5(cover);
  if (coverHash) seenHashes.add(coverHash);

  // Offset selection by index to ensure variety between services
  const offset = index % pool.length;
  for (let i = 0; i < pool.length * 2; i++) {
    const candidate = pool[(offset + i) % pool.length];
    const candidateHash = getFileMd5(candidate);
    if (!gallery.includes(candidate)) {
      if (!candidateHash || !seenHashes.has(candidateHash)) {
        gallery.push(candidate);
        if (candidateHash) seenHashes.add(candidateHash);
      }
    }
    if (gallery.length >= 5) break;
  }

  return gallery;
}

const finalMapping = {};
let totalValid = 0;

services.forEach((s, idx) => {
  let cover = VENUE_COVERS[s.id];

  // If not in venue covers:
  if (!cover) {
    // Check if current image is already a clean authentic local or Google Place photo
    if (s.image_url && s.image_url.startsWith('image/') && fileExists(s.image_url)) {
      cover = s.image_url;
    } else if (s.image_url && s.image_url.includes('googleusercontent.com')) {
      cover = s.image_url;
    } else {
      // Pick first image from the pool
      const type = s.type || 'attraction';
      const dest = (s.destination || '').toLowerCase();
      if (type === 'transport') cover = BANKS.transport_eco[idx % BANKS.transport_eco.length];
      else if (type === 'food') {
        if (dest.includes('phú yên')) cover = BANKS.phuyen_food[idx % BANKS.phuyen_food.length];
        else if (dest.includes('hội an') || dest.includes('đà nẵng')) cover = BANKS.danang_hoian_food[idx % BANKS.danang_hoian_food.length];
        else cover = BANKS.dalat_food[idx % BANKS.dalat_food.length];
      } else if (type === 'stay') {
        if (dest.includes('phú yên')) cover = BANKS.phuyen_stay[idx % BANKS.phuyen_stay.length];
        else if (dest.includes('hội an') || dest.includes('đà nẵng')) cover = BANKS.danang_hoian_stay[idx % BANKS.danang_hoian_stay.length];
        else if (dest.includes('ninh bình')) cover = BANKS.ninhbinh_stay[idx % BANKS.ninhbinh_stay.length];
        else cover = BANKS.dalat_stay[idx % BANKS.dalat_stay.length];
      } else {
        if (dest.includes('phú yên')) cover = BANKS.phuyen_attraction[idx % BANKS.phuyen_attraction.length];
        else if (dest.includes('hội an')) cover = BANKS.hoian_attraction[idx % BANKS.hoian_attraction.length];
        else if (dest.includes('đà nẵng')) cover = BANKS.danang_attraction[idx % BANKS.danang_attraction.length];
        else if (dest.includes('ninh bình')) cover = BANKS.ninhbinh_attraction[idx % BANKS.ninhbinh_attraction.length];
        else if (dest.includes('sa pa')) cover = BANKS.sapa_attraction[idx % BANKS.sapa_attraction.length];
        else if (dest.includes('hà giang')) cover = BANKS.hagiang_attraction[idx % BANKS.hagiang_attraction.length];
        else cover = BANKS.dalat_attraction[idx % BANKS.dalat_attraction.length];
      }
    }
  }

  const gallery = buildGalleryForService(s, cover, idx);

  // Validate uniqueness
  const hashes = new Set();
  let hasDup = false;
  gallery.forEach(img => {
    const h = getFileMd5(img);
    if (h) {
      if (hashes.has(h)) hasDup = true;
      hashes.add(h);
    }
  });

  if (cover && gallery.length >= 5 && !hasDup) {
    totalValid++;
  } else {
    console.error('Issue with service:', s.id, 'gallery len:', gallery.length, 'hasDup:', hasDup, 'cover:', cover);
  }

  finalMapping[s.id] = {
    id: s.id,
    name: s.name_service,
    type: s.type,
    destination: s.destination,
    cover,
    gallery,
    galleryCount: gallery.length
  };
});

console.log('Mapping completed!');
console.log('Valid services count:', totalValid, '/', services.length);

fs.writeFileSync(path.resolve(__dirname, '../backups/services-final-image-mapping.json'), JSON.stringify(finalMapping, null, 2), 'utf8');
console.log('Saved final mapping to backups/services-final-image-mapping.json');

module.exports = { finalMapping };
