const source = {
  name: 'Quyết định 19/2025/QĐ-TTg',
  url: 'https://vanban.chinhphu.vn/?classid=1&docid=214409&orggroupid=3&pageid=27160',
  effectiveDate: '2025-07-01',
  checkedAt: '2026-11-12'
};

const adminAreas = [
  ['01', 'Hà Nội', 'city', ['Thành phố Hà Nội']], ['04', 'Cao Bằng', 'province', []],
  ['08', 'Tuyên Quang', 'province', ['Hà Giang']], ['11', 'Điện Biên', 'province', []],
  ['12', 'Lai Châu', 'province', []], ['14', 'Sơn La', 'province', []],
  ['15', 'Lào Cai', 'province', ['Sa Pa', 'Sapa', 'Lào Cai cũ']], ['19', 'Thái Nguyên', 'province', ['Bắc Kạn']],
  ['20', 'Lạng Sơn', 'province', []], ['22', 'Quảng Ninh', 'province', []],
  ['24', 'Bắc Ninh', 'province', ['Bắc Giang']], ['25', 'Phú Thọ', 'province', ['Vĩnh Phúc', 'Hòa Bình']],
  ['31', 'Hải Phòng', 'city', ['Thành phố Hải Phòng', 'Hải Dương']], ['33', 'Hưng Yên', 'province', ['Thái Bình']],
  ['37', 'Ninh Bình', 'province', ['Hà Nam', 'Nam Định']], ['38', 'Thanh Hóa', 'province', []],
  ['40', 'Nghệ An', 'province', []], ['42', 'Hà Tĩnh', 'province', []],
  ['44', 'Quảng Trị', 'province', ['Quảng Bình']], ['46', 'Huế', 'city', ['Thành phố Huế', 'Thừa Thiên Huế']],
  ['48', 'Đà Nẵng', 'city', ['Thành phố Đà Nẵng', 'Quảng Nam', 'Hội An']], ['51', 'Quảng Ngãi', 'province', ['Kon Tum']],
  ['52', 'Gia Lai', 'province', ['Bình Định', 'Quy Nhơn']], ['56', 'Khánh Hòa', 'province', ['Ninh Thuận']],
  ['66', 'Đắk Lắk', 'province', ['Phú Yên', 'Tuy Hòa']], ['68', 'Lâm Đồng', 'province', ['Đắk Nông', 'Bình Thuận', 'Đà Lạt']],
  ['75', 'Đồng Nai', 'province', ['Bình Phước']], ['79', 'Hồ Chí Minh', 'city', ['Thành phố Hồ Chí Minh', 'TP HCM', 'Sài Gòn', 'Bà Rịa - Vũng Tàu', 'Bình Dương']],
  ['80', 'Tây Ninh', 'province', ['Long An']], ['82', 'Đồng Tháp', 'province', ['Tiền Giang']],
  ['86', 'Vĩnh Long', 'province', ['Bến Tre', 'Trà Vinh']], ['91', 'An Giang', 'province', ['Kiên Giang', 'Phú Quốc']],
  ['92', 'Cần Thơ', 'city', ['Thành phố Cần Thơ', 'Hậu Giang', 'Sóc Trăng']], ['96', 'Cà Mau', 'province', ['Bạc Liêu']]
].map(([code, name, type, aliases]) => ({
  id: `admin-area:${code}`, code, name, type, aliases,
  status: 'published', source, effectiveFrom: source.effectiveDate, effectiveTo: null,
  version: '2025-07-01'
}));

const regions = [
  ['northwest', 'Tây Bắc', ['11', '12', '14', '15']],
  ['northeast', 'Đông Bắc', ['04', '08', '19', '20']],
  ['red-river-delta', 'Đồng bằng sông Hồng', ['01', '24', '25', '31', '33', '37']],
  ['north-central', 'Bắc Trung Bộ', ['38', '40', '42', '44', '46']],
  ['south-central', 'Duyên hải Nam Trung Bộ', ['48', '51', '52', '56', '66']],
  ['central-highlands', 'Tây Nguyên', ['68']],
  ['southeast', 'Đông Nam Bộ', ['75', '79', '80']],
  ['mekong-delta', 'Đồng bằng sông Cửu Long', ['82', '86', '91', '92', '96']]
].map(([slug, name, adminAreaCodes]) => ({
  id: `region:${slug}`, slug, name, description: '', adminAreaIds: adminAreaCodes.map(code => `admin-area:${code}`),
  status: 'published', source: { name: 'GreenSteps tourism taxonomy', type: 'editorial' }, version: '2025-07-01'
}));

const destinations = [
  // 1. Tây Bắc
  ['sa-pa', 'Sa Pa', ['Sapa', 'Sa Pả', 'Lào Cai'], ['admin-area:15'], 'northwest', { lat: 22.3364, lng: 103.8438 }],
  ['ha-giang', 'Hà Giang', ['Ha Giang', 'Đồng Văn', 'Mèo Vạc'], ['admin-area:08'], 'northwest', { lat: 22.8233, lng: 104.9839 }],
  ['moc-chau', 'Mộc Châu', ['Moc Chau', 'Sơn La'], ['admin-area:14'], 'northwest', { lat: 20.8443, lng: 104.6475 }],
  ['dien-bien', 'Điện Biên', ['Dien Bien', 'Mường Phăng'], ['admin-area:11'], 'northwest', { lat: 21.3853, lng: 103.0173 }],

  // 2. Đông Bắc
  ['ha-long', 'Hạ Long', ['Ha Long', 'Quảng Ninh', 'Vịnh Hạ Long'], ['admin-area:22'], 'northeast', { lat: 20.9505, lng: 107.0733 }],
  ['cat-ba', 'Cát Bà', ['Cat Ba', 'Lan Hạ', 'Hải Phòng'], ['admin-area:31'], 'northeast', { lat: 20.7275, lng: 106.9996 }],
  ['cao-bang', 'Cao Bằng', ['Cao Bang', 'Bản Giốc', 'Pác Bó'], ['admin-area:04'], 'northeast', { lat: 22.6657, lng: 105.9734 }],
  ['ba-be', 'Ba Bể', ['Ba Be', 'Bắc Kạn', 'Hồ Ba Bể'], ['admin-area:19'], 'northeast', { lat: 22.4042, lng: 105.6174 }],

  // 3. Đồng bằng sông Hồng
  ['ha-noi', 'Hà Nội', ['Ha Noi', 'Thủ đô Hà Nội', 'Hanoi'], ['admin-area:01'], 'red-river-delta', { lat: 21.0285, lng: 105.8542 }],
  ['ninh-binh', 'Ninh Bình', ['Ninh Binh', 'Tràng An', 'Tam Cốc'], ['admin-area:37'], 'red-river-delta', { lat: 20.2506, lng: 105.9745 }],

  // 4. Bắc Trung Bộ
  ['phong-nha', 'Phong Nha', ['Phong Nha - Kẻ Bàng', 'Quảng Bình', 'Quang Binh'], ['admin-area:44'], 'north-central', { lat: 17.5898, lng: 106.2829 }],
  ['hue', 'Huế', ['Hue', 'Thừa Thiên Huế', 'Cố đô Huế'], ['admin-area:46'], 'north-central', { lat: 16.4637, lng: 107.5909 }],

  // 5. Duyên hải Nam Trung Bộ
  ['da-nang', 'Đà Nẵng', ['Da Nang', 'Đà Nẵng'], ['admin-area:48'], 'south-central', { lat: 16.0544, lng: 108.2022 }],
  ['hoi-an', 'Hội An', ['Hoi An', 'Phố cổ Hội An'], ['admin-area:48'], 'south-central', { lat: 15.8801, lng: 108.3380 }],
  ['da-nang-hoi-an', 'Đà Nẵng – Hội An', ['Da Nang', 'Hội An', 'Hoi An'], ['admin-area:48'], 'south-central', { lat: 15.8801, lng: 108.3380 }],
  ['quy-nhon', 'Quy Nhơn', ['Quy Nhon', 'Bình Định'], ['admin-area:52'], 'south-central', { lat: 13.7820, lng: 109.2197 }],
  ['phu-yen', 'Phú Yên', ['Phu Yen', 'Tuy Hòa', 'Tuy Hoa'], ['admin-area:66'], 'south-central', { lat: 13.0882, lng: 109.0929 }],
  ['nha-trang', 'Nha Trang', ['Nha Trang', 'Khánh Hòa'], ['admin-area:56'], 'south-central', { lat: 12.2388, lng: 109.1967 }],

  // 6. Tây Nguyên
  ['dalat', 'Đà Lạt', ['Dalat', 'Đà Lạt', 'Lâm Đồng'], ['admin-area:68'], 'central-highlands', { lat: 11.9404, lng: 108.4583 }],
  ['mang-den', 'Măng Đen', ['Mang Den', 'Kon Tum'], ['admin-area:51'], 'central-highlands', { lat: 14.6000, lng: 108.2917 }],
  ['buon-ma-thuot', 'Buôn Ma Thuột', ['Buon Ma Thuot', 'Đắk Lắk'], ['admin-area:66'], 'central-highlands', { lat: 12.6675, lng: 108.0383 }],

  // 7. Đông Nam Bộ
  ['ho-chi-minh', 'TP. Hồ Chí Minh', ['TP HCM', 'Sài Gòn', 'Ho Chi Minh', 'Saigon'], ['admin-area:79'], 'southeast', { lat: 10.8231, lng: 106.6297 }],
  ['con-dao', 'Côn Đảo', ['Con Dao', 'Bà Rịa - Vũng Tàu'], ['admin-area:79'], 'southeast', { lat: 8.6835, lng: 106.6074 }],

  // 8. Đồng bằng sông Cửu Long
  ['can-tho', 'Cần Thơ', ['Can Tho', 'Tây Đô', 'Cái Răng'], ['admin-area:92'], 'mekong-delta', { lat: 10.0452, lng: 105.7469 }],
  ['phu-quoc', 'Phú Quốc', ['Phu Quoc', 'Đảo Ngọc', 'Kiên Giang'], ['admin-area:91'], 'mekong-delta', { lat: 10.2899, lng: 103.9840 }],
  ['an-giang', 'An Giang', ['An Giang', 'Trà Sư', 'Châu Đốc'], ['admin-area:91'], 'mekong-delta', { lat: 10.5186, lng: 105.0289 }],
  ['ben-tre', 'Bến Tre', ['Ben Tre', 'Xứ Dừa'], ['admin-area:86'], 'mekong-delta', { lat: 10.2433, lng: 106.3759 }]
].map(([slug, name, aliases, adminAreaIds, regionSlug, coordinates]) => ({
  id: `destination:${slug}`, slug, name, aliases, adminAreaIds, regionId: `region:${regionSlug}`,
  coordinates, coordinateVerification: 'pending', status: 'editorial', description: '',
  source: { name: 'GreenSteps demo catalog', type: 'editorial', coordinateStatus: 'pending_verification' }, version: '2025-07-01'
}));

module.exports = { source, adminAreas, regions, destinations };
