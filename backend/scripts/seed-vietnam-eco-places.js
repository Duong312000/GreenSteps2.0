const { GreenService } = require('../src/models/index');

const vietnamPlaces = [
  // --- ĐÀ LẠT ---
  {
    id: 'GGP_DL_DATANLA',
    google_place_id: 'ChIJ_datanla_dalat_001',
    name_service: 'Khu du lịch sinh thái Thác Datanla',
    type: 'attraction',
    destination: 'Đà Lạt',
    cost: 50000,
    carbon: 3.5,
    rating: 4.6,
    reviews_count: 5120,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Quốc lộ 20, Đèo Prenn, Phường 3, Đà Lạt, Lâm Đồng', lat: 11.9025, lng: 108.4489, source: 'google_maps' }
  },
  {
    id: 'GGP_DL_CAUDAT',
    google_place_id: 'ChIJ_caudat_tea_002',
    name_service: 'Đồi chè Cầu Đất & Nông trường sinh thái',
    type: 'attraction',
    destination: 'Đà Lạt',
    cost: 0,
    carbon: 4.2,
    rating: 4.7,
    reviews_count: 4200,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Thôn Cầu Đất, Xã Xuân Trường, Đà Lạt, Lâm Đồng', lat: 11.8901, lng: 108.5612, source: 'google_maps' }
  },
  {
    id: 'GGP_DL_TUYENLAM',
    google_place_id: 'ChIJ_tuyenlam_lake_003',
    name_service: 'Hồ Tuyền Lâm & Rừng thông tự nhiên',
    type: 'attraction',
    destination: 'Đà Lạt',
    cost: 0,
    carbon: 4.0,
    rating: 4.8,
    reviews_count: 6890,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Phường 4, Đà Lạt, Lâm Đồng', lat: 11.8988, lng: 108.4289, source: 'google_maps' }
  },
  {
    id: 'GGP_DL_LANGCHAY',
    google_place_id: 'ChIJ_chay_hoa_sen_004',
    name_service: 'Nhà hàng chay Hoa Sen Đà Lạt',
    type: 'food',
    destination: 'Đà Lạt',
    cost: 85000,
    carbon: 2.2,
    rating: 4.5,
    reviews_count: 1450,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: '62 Phan Đình Phùng, Phường 2, Đà Lạt', lat: 11.9452, lng: 108.4381, source: 'google_maps' }
  },
  {
    id: 'GGP_DL_BUSXANH',
    google_place_id: 'ChIJ_xedien_dalat_005',
    name_service: 'Tuyến xe buýt điện ngắm cảnh vòng quanh Hồ Xuân Hương',
    type: 'transport',
    destination: 'Đà Lạt',
    cost: 30000,
    carbon: 3.8,
    rating: 4.7,
    reviews_count: 980,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Bến xe điện bờ hồ Xuân Hương, Đà Lạt', lat: 11.9398, lng: 108.4445, source: 'google_maps' }
  },
  {
    id: 'GGP_DL_PINERETREAT',
    google_place_id: 'ChIJ_pine_hill_stay_006',
    name_service: 'Pine Forest Eco Cottage Đà Lạt',
    type: 'stay',
    destination: 'Đà Lạt',
    cost: 490000,
    carbon: 2.5,
    rating: 4.7,
    reviews_count: 830,
    image_url: 'image/services/stay_homestay_dalat.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Đường Triệu Việt Vương, Phường 4, Đà Lạt', lat: 11.9189, lng: 108.4312, source: 'google_maps' }
  },

  // --- HỘI AN ---
  {
    id: 'GGP_HA_TRAQUE',
    google_place_id: 'ChIJ_traque_herb_007',
    name_service: 'Làng rau Trà Quế hữu cơ truyền thống',
    type: 'attraction',
    destination: 'Hội An',
    cost: 35000,
    carbon: 3.5,
    rating: 4.6,
    reviews_count: 2150,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Cẩm Hà, Hội An, Quảng Nam', lat: 15.9012, lng: 108.3456, source: 'google_maps' }
  },
  {
    id: 'GGP_HA_BAYMAU',
    google_place_id: 'ChIJ_baymau_coconut_008',
    name_service: 'Rừng dừa nước Bảy Mẫu Cẩm Thanh',
    type: 'attraction',
    destination: 'Hội An',
    cost: 60000,
    carbon: 3.8,
    rating: 4.7,
    reviews_count: 7300,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Xã Cẩm Thanh, Hội An, Quảng Nam', lat: 15.8756, lng: 108.3712, source: 'google_maps' }
  },
  {
    id: 'GGP_HA_THANHHA',
    google_place_id: 'ChIJ_thanhha_pottery_009',
    name_service: 'Công viên Đất nung & Làng gốm Thanh Hà',
    type: 'attraction',
    destination: 'Hội An',
    cost: 40000,
    carbon: 2.8,
    rating: 4.5,
    reviews_count: 1820,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Phạm Hồng Thái, Thanh Hà, Hội An, Quảng Nam', lat: 15.8821, lng: 108.3045, source: 'google_maps' }
  },
  {
    id: 'GGP_HA_ANLACCHAY',
    google_place_id: 'ChIJ_anlac_vegan_010',
    name_service: 'Quán chay dưỡng sinh An Lạc Hội An',
    type: 'food',
    destination: 'Hội An',
    cost: 70000,
    carbon: 2.3,
    rating: 4.7,
    reviews_count: 940,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: '93 Nguyễn Thị Minh Khai, Cẩm Phô, Hội An', lat: 15.8778, lng: 108.3245, source: 'google_maps' }
  },
  {
    id: 'GGP_HA_XEDAPTRE',
    google_place_id: 'ChIJ_bamboo_bike_011',
    name_service: 'Dịch vụ thuê xe đạp tre đồng quê Hội An',
    type: 'transport',
    destination: 'Hội An',
    cost: 50000,
    carbon: 4.5,
    rating: 4.9,
    reviews_count: 670,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Thôn Thanh Nhứt, Cẩm Thanh, Hội An', lat: 15.8841, lng: 108.3562, source: 'google_maps' }
  },
  {
    id: 'GGP_HA_RIVERSTAY',
    google_place_id: 'ChIJ_riverside_eco_stay_012',
    name_service: 'Riverside Garden Eco Lodge Hội An',
    type: 'stay',
    destination: 'Hội An',
    cost: 580000,
    carbon: 2.7,
    rating: 4.6,
    reviews_count: 480,
    image_url: 'image/services/stay_homestay_dalat.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Đường Nguyễn Tri Phương, Cẩm Nam, Hội An', lat: 15.8712, lng: 108.3398, source: 'google_maps' }
  },

  // --- ĐÀ NẴNG ---
  {
    id: 'GGP_DN_SONTRA',
    google_place_id: 'ChIJ_sontra_nature_013',
    name_service: 'Khu bảo tồn thiên nhiên Bán đảo Sơn Trà',
    type: 'attraction',
    destination: 'Đà Nẵng',
    cost: 0,
    carbon: 4.6,
    rating: 4.8,
    reviews_count: 8900,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Bán đảo Sơn Trà, Thọ Quang, Sơn Trà, Đà Nẵng', lat: 16.1154, lng: 108.2831, source: 'google_maps' }
  },
  {
    id: 'GGP_DN_NGUHANHSON',
    google_place_id: 'ChIJ_nguhanhson_014',
    name_service: 'Danh thắng Ngũ Hành Sơn & Làng đá Non Nước',
    type: 'attraction',
    destination: 'Đà Nẵng',
    cost: 40000,
    carbon: 2.8,
    rating: 4.6,
    reviews_count: 9500,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: '81 Huyền Trân Công Chúa, Hòa Hải, Ngũ Hành Sơn, Đà Nẵng', lat: 16.0042, lng: 108.2612, source: 'google_maps' }
  },
  {
    id: 'GGP_DN_QUANCHAY',
    google_place_id: 'ChIJ_bode_danang_015',
    name_service: 'Ẩm thực chay Bồ Đề Duyên Đà Nẵng',
    type: 'food',
    destination: 'Đà Nẵng',
    cost: 65000,
    carbon: 2.1,
    rating: 4.7,
    reviews_count: 1250,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: '128 Triệu Nữ Vương, Hải Châu, Đà Nẵng', lat: 16.0612, lng: 108.2178, source: 'google_maps' }
  },
  {
    id: 'GGP_DN_BUSDIEN',
    google_place_id: 'ChIJ_ecobus_danang_016',
    name_service: 'Hệ thống xe buýt điện du lịch Sơn Trà - Mỹ Khê',
    type: 'transport',
    destination: 'Đà Nẵng',
    cost: 25000,
    carbon: 3.5,
    rating: 4.6,
    reviews_count: 820,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Đường Võ Nguyên Giáp, Ngũ Hành Sơn, Đà Nẵng', lat: 16.0521, lng: 108.2456, source: 'google_maps' }
  },

  // --- PHÚ YÊN ---
  {
    id: 'GGP_PY_GANHDADIA',
    google_place_id: 'ChIJ_ganhdadia_017',
    name_service: 'Di tích quốc gia đặc biệt Gành Đá Đĩa',
    type: 'attraction',
    destination: 'Phú Yên',
    cost: 40000,
    carbon: 3.8,
    rating: 4.7,
    reviews_count: 4890,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Xã An Ninh Đông, Huyện Tuy An, Phú Yên', lat: 13.3489, lng: 109.2945, source: 'google_maps' }
  },
  {
    id: 'GGP_PY_HONYEN',
    google_place_id: 'ChIJ_honyen_coral_018',
    name_service: 'Khu bảo tồn san hô cạn Quần thể Hòn Yến',
    type: 'attraction',
    destination: 'Phú Yên',
    cost: 0,
    carbon: 4.4,
    rating: 4.6,
    reviews_count: 2100,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Thôn Nhơn Hội, Xã An Hòa Hải, Huyện Tuy An, Phú Yên', lat: 13.2289, lng: 109.3012, source: 'google_maps' }
  },
  {
    id: 'GGP_PY_MAIDAT',
    google_place_id: 'ChIJ_haidang_dien_019',
    name_service: 'Mũi Điện (Mũi Đại Lãnh) - Điểm đón bình minh đầu tiên',
    type: 'attraction',
    destination: 'Phú Yên',
    cost: 20000,
    carbon: 3.2,
    rating: 4.8,
    reviews_count: 5340,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Thôn Phước Tân, Xã Hòa Tâm, Thị xã Đông Hòa, Phú Yên', lat: 12.8831, lng: 109.4589, source: 'google_maps' }
  },
  {
    id: 'GGP_PY_HOMESTAY',
    google_place_id: 'ChIJ_langchai_stay_020',
    name_service: 'Nhà nghỉ sinh thái làng chài Tuy An',
    type: 'stay',
    destination: 'Phú Yên',
    cost: 380000,
    carbon: 2.2,
    rating: 4.6,
    reviews_count: 360,
    image_url: 'image/services/stay_homestay_dalat.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'An Ninh Đông, Tuy An, Phú Yên', lat: 13.3321, lng: 109.2812, source: 'google_maps' }
  },

  // --- NINH BÌNH ---
  {
    id: 'GGP_NB_TRANGAN',
    google_place_id: 'ChIJ_trangan_heritage_021',
    name_service: 'Quần thể danh thắng Tràng An (Thuyền chèo tay)',
    type: 'attraction',
    destination: 'Ninh Bình',
    cost: 250000,
    carbon: 4.8,
    rating: 4.9,
    reviews_count: 14200,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Tràng An, Trường Yên, Hoa Lư, Ninh Bình', lat: 20.2541, lng: 105.9123, source: 'google_maps' }
  },
  {
    id: 'GGP_NB_CUC_PHUONG',
    google_place_id: 'ChIJ_cucphuong_park_022',
    name_service: 'Vườn quốc gia Cúc Phương & Trung tâm cứu hộ linh trưởng',
    type: 'attraction',
    destination: 'Ninh Bình',
    cost: 60000,
    carbon: 5.0,
    rating: 4.7,
    reviews_count: 3890,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Huyện Nho Quan, Ninh Bình', lat: 20.3167, lng: 105.6042, source: 'google_maps' }
  },
  {
    id: 'GGP_NB_ECORESORT',
    google_place_id: 'ChIJ_emeralda_resort_023',
    name_service: 'Khu nghỉ dưỡng sinh thái Emeralda Ninh Bình',
    type: 'stay',
    destination: 'Ninh Bình',
    cost: 1250000,
    carbon: 3.0,
    rating: 4.6,
    reviews_count: 2400,
    image_url: 'image/services/stay_homestay_dalat.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Khu bảo tồn đất ngập nước Vân Long, Gia Vân, Gia Viễn, Ninh Bình', lat: 20.3642, lng: 105.8671, source: 'google_maps' }
  },

  // --- SA PA & HÀ GIANG ---
  {
    id: 'GGP_SP_CATCAT',
    google_place_id: 'ChIJ_catcat_village_024',
    name_service: 'Bản Cát Cát - Trải nghiệm văn hóa H\'Mông',
    type: 'attraction',
    destination: 'Sa Pa',
    cost: 90000,
    carbon: 3.6,
    rating: 4.5,
    reviews_count: 8500,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Xã San Sả Hồ, Thị xã Sa Pa, Lào Cai', lat: 22.3289, lng: 103.8341, source: 'google_maps' }
  },
  {
    id: 'GGP_HG_MAPILENG',
    google_place_id: 'ChIJ_mapileng_pass_025',
    name_service: 'Đèo Mã Pí Lèng & Du thuyền sinh thái hẻm Tu Sản',
    type: 'attraction',
    destination: 'Hà Giang',
    cost: 120000,
    carbon: 4.5,
    rating: 4.9,
    reviews_count: 7600,
    image_url: 'image/Viet Nam.png',
    is_partner: false,
    source: 'google_maps',
    current_data: { country: 'VN', address: 'Pải Lủng, Huyện Mèo Vạc, Hà Giang', lat: 23.2351, lng: 105.4189, source: 'google_maps' }
  }
];

async function seedVietnamPlaces() {
  console.log(`Seeding ${vietnamPlaces.length} real Vietnam Eco Places...`);
  for (const place of vietnamPlaces) {
    const existing = await GreenService.findByPk(place.id);
    if (!existing) {
      await GreenService.create(place);
    } else {
      await existing.update(place);
    }
  }
  console.log('All Vietnam Eco Places successfully seeded into MongoDB!');
}

seedVietnamPlaces().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});

