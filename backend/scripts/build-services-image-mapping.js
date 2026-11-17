const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const baseDir = path.resolve(__dirname, '../../my-app/public/image');

function getFileMd5(relPath) {
  const fullPath = path.join(baseDir, relPath.replace(/^image\//, ''));
  if (fs.existsSync(fullPath)) {
    return crypto.createHash('md5').update(fs.readFileSync(fullPath)).digest('hex');
  }
  return null;
}

function fileExists(relPath) {
  if (relPath.startsWith('http')) return true;
  const fullPath = path.join(baseDir, relPath.replace(/^image\//, ''));
  return fs.existsSync(fullPath);
}

// Destination and Type banks with 100% existing files
const BANKS = {
  dalat_attraction: [
    'image/da-lat/da-lat-quang-truong-lam-vien-01.jpg',
    'image/da-lat/da-lat-quang-truong-lam-vien-02.jpg',
    'image/da-lat/da-lat-ho-xuan-huong-01.jpg',
    'image/da-lat/da-lat-ho-tuyen-lam-01.jpg',
    'image/da-lat/da-lat-chua-linh-phuoc-01.jpg',
    'image/da-lat/da-lat-thac-nuoc-01.jpg',
    'image/da-lat/da-lat-vuon-hoa-01.jpg',
    'image/da-lat/da-lat-duong-ham-dat-set-01.jpg',
    'image/da-lat/da-lat-rung-thong-san-may-01.jpg',
    'image/da-lat/da-lat-toan-canh-thanh-pho-01.jpg',
    'image/da-lat/da-lat-diem-ngam-thanh-pho-01.jpg',
    'image/da-lat/da-lat-duong-mai-anh-dao-01.jpg',
    'image/places/ggp_dl_caudat.jpg',
    'image/places/ggp_dl_datanla.jpg',
    'image/places/ggp_dl_tuyenlam.jpg',
    'image/services/attraction_herbal_workshop.png',
    'image/services/attraction_kayaking.png'
  ],
  dalat_stay: [
    'image/services/stay_homestay_dalat.png',
    'image/services/stay_hoa_da_quy.png',
    'image/services/stay_mai_anh_dao.png',
    'image/services/stay_green_boutique.png',
    'image/da-lat/da-lat-nghi-duong-ven-ho-01.jpg',
    'image/da-lat/da-lat-rung-thong-01.jpg',
    'image/da-lat/da-lat-rung-thong-02.jpg',
    'image/da-lat/da-lat-kien-truc-co-01.jpg',
    'image/places/ggp_dl_pineretreat.jpg'
  ],
  dalat_food: [
    'image/places/ggp_dl_langchay.jpg',
    'image/food/vegan.jpg',
    'image/food/vegetarian.jpg',
    'image/food/tea.jpg',
    'image/food/cafe.png',
    'image/food/local.jpg',
    'image/services/food_organic_vietnamese.png',
    'image/services/food_local_cafe.png'
  ],
  danang_attraction: [
    'image/da-nang-hoi-an/da-nang-cau-rong-phun-lua-01.jpg',
    'image/da-nang-hoi-an/da-nang-cau-rong-hoang-hon-01.jpg',
    'image/da-nang-hoi-an/da-nang-son-tra-rung-xanh-01.jpg',
    'image/da-nang-hoi-an/da-nang-cau-vang-ba-na-hills-01.jpg',
    'image/da-nang-hoi-an/da-nang-cau-vang-binh-minh-01.jpg',
    'image/da-nang-hoi-an/da-nang-ba-na-hills-lang-phap-01.jpg',
    'image/da-nang-hoi-an/da-nang-bien-my-khe-toan-canh-01.jpg',
    'image/da-nang-hoi-an/da-nang-bien-my-khe-01.jpg',
    'image/places/ggp_dn_sontra.jpg',
    'image/places/ggp_dn_nguhanhson.jpg'
  ],
  hoian_attraction: [
    'image/da-nang-hoi-an/hoi-an-pho-co-den-long-01.jpg',
    'image/da-nang-hoi-an/hoi-an-pho-co-den-long-02.jpg',
    'image/da-nang-hoi-an/hoi-an-chua-cau-01.jpg',
    'image/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg',
    'image/da-nang-hoi-an/hoi-an-checkin-pho-co-01.jpg',
    'image/da-nang-hoi-an/hoi-an-checkin-den-long-01.jpg',
    'image/da-nang-hoi-an/hoi-an-song-hoai-ban-dem-01.jpg',
    'image/da-nang-hoi-an/hoi-an-song-hoai-hoa-dang-01.jpg',
    'image/da-nang-hoi-an/hoi-an-lang-nghe-thu-cong-01.jpg',
    'image/da-nang-hoi-an/hoi-an-lang-huong-thu-cong-01.jpg',
    'image/places/ggp_ha_baymau.jpg',
    'image/places/ggp_ha_thanhha.jpg',
    'image/places/ggp_ha_traque.jpg'
  ],
  danang_hoian_stay: [
    'image/services/stay_hoi_an_eco.png',
    'image/places/ggp_ha_riverstay.jpg',
    'image/places/ggp_hoian_anbang.jpg',
    'image/da-nang-hoi-an/da-nang-ba-na-hills-kien-truc-01.jpg',
    'image/da-nang-hoi-an/hoi-an-checkin-pho-co-01.jpg'
  ],
  danang_hoian_food: [
    'image/places/ggp_dn_quanchay.jpg',
    'image/places/ggp_ha_anlacchay.jpg',
    'image/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg',
    'image/da-nang-hoi-an/hoi-an-ca-phe-dia-phuong-01.jpg',
    'image/food/local.jpg',
    'image/food/vegetarian.jpg',
    'image/food/vegan.jpg',
    'image/services/food_organic_vietnamese.png'
  ],
  phuyen_attraction: [
    'image/phu-yen/phu-yen-thap-nghinh-phong-01.jpg',
    'image/phu-yen/phu-yen-bai-xep-checkin-01.jpg',
    'image/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
    'image/phu-yen/phu-yen-lang-chai-vung-ro-01.jpg',
    'image/phu-yen/phu-yen-bai-bien-dua-01.jpg',
    'image/phu-yen/phu-yen-bai-da-ven-bien-01.jpg',
    'image/phu-yen/phu-yen-bien-dao-minh-hoa-01.jpg',
    'image/phu-yen/phu-yen-bien-trong-01.jpg',
    'image/phu-yen/phu-yen-canh-quan-xanh-01.jpg',
    'image/phu-yen/phu-yen-checkin-ven-bien-01.jpg',
    'image/phu-yen/phu-yen-duong-ven-bien-01.jpg',
    'image/places/ggp_py_ganhdadia.jpg',
    'image/places/ggp_py_maidat.jpg',
    'image/places/ggp_py_honyen.jpg'
  ],
  phuyen_stay: [
    'image/services/stay_hon_yen.png',
    'image/places/ggp_py_homestay.jpg',
    'image/phu-yen/phu-yen-lang-chai-vung-ro-01.jpg',
    'image/phu-yen/phu-yen-bai-bien-dua-01.jpg',
    'image/phu-yen/phu-yen-canh-quan-xanh-01.jpg'
  ],
  phuyen_food: [
    'image/phu-yen/phu-yen-lang-chai-vung-ro-01.jpg',
    'image/food/local.jpg',
    'image/food/vegetarian.jpg',
    'image/food/vegan.jpg',
    'image/services/food_organic_vietnamese.png'
  ],
  transport_eco: [
    'image/transport/rental-electric-motorbike.jpg',
    'image/transport/shared-minibus-green.jpg',
    'image/transport/shared-mpv-teal.jpg',
    'image/transport/bus-coach-green.jpg',
    'image/transport/rental-motorbike.jpg',
    'image/places/ggp_dl_busxanh.jpg',
    'image/places/ggp_dn_busdien.jpg',
    'image/places/ggp_ha_xedaptre.jpg',
    'image/transport/shared-minibus-ivory.jpg',
    'image/transport/shared-van-black.jpg'
  ],
  ninhbinh_attraction: [
    'image/places/ggp_nb_trangan.jpg',
    'image/places/ggp_nb_cuc_phuong.jpg',
    'image/greensteps/tours/ninh-binh/ninh-binh-trang-an-river.jpg',
    'image/greensteps/tours/ninh-binh/file-trang-an-01.jpg',
    'image/greensteps/tours/ninh-binh/file-buffles-a-tam-coc-1.jpg'
  ],
  ninhbinh_stay: [
    'image/places/ggp_nb_ecoresort.jpg',
    'image/greensteps/tours/ninh-binh/ninh-binh-tam-coc.jpg',
    'image/greensteps/tours/ninh-binh/file-trang-an-02.jpg',
    'image/greensteps/tours/ninh-binh/file-barques-a-tam-coc-1.jpg',
    'image/greensteps/tours/ninh-binh/file-bananiers-a-tam-coc.jpg'
  ],
  sapa_attraction: [
    'image/places/ggp_sp_catcat.jpg',
    'image/greensteps/tours/sa-pa/sa-pa-rice-terraces.jpg',
    'image/greensteps/tours/sa-pa/sa-pa-fansipan-view.jpg',
    'image/greensteps/tours/sa-pa/file-muong-hoa-valley-01.jpg',
    'image/greensteps/tours/sa-pa/file-cat-cat-village-4-waterfall.jpg'
  ],
  hagiang_attraction: [
    'image/places/ggp_hg_mapileng.jpg',
    'image/greensteps/tours/hagiang/hagiang-hem-tu-san-nho-que.jpg',
    'image/greensteps/tours/hagiang/hagiang-song-nho-que-boat.jpg',
    'image/greensteps/tours/hagiang/hagiang-cot-co-lung-cu.jpg',
    'image/greensteps/tours/hagiang/hagiang-deo-ma-pi-leng.jpg'
  ]
};

// Check all files in BANKS exist
let missing = 0;
for (const [k, arr] of Object.entries(BANKS)) {
  arr.forEach(f => {
    if (!fileExists(f)) {
      console.log('MISSING:', k, f);
      missing++;
    }
  });
}
console.log('Image banks check complete. Total missing files:', missing);

module.exports = { BANKS, fileExists, getFileMd5 };
