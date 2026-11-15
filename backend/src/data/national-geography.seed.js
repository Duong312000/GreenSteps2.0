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
  ['dalat', 'Đà Lạt', ['Dalat', 'Đà Lạt'], ['admin-area:68'], 'central-highlands', { lat: 11.9404, lng: 108.4583 }],
  ['phu-yen', 'Phú Yên', ['Phu Yen', 'Tuy Hòa', 'Tuy Hoa'], ['admin-area:66'], 'south-central', { lat: 13.0882, lng: 109.0929 }],
  ['da-nang-hoi-an', 'Đà Nẵng – Hội An', ['Da Nang', 'Hội An', 'Hoi An'], ['admin-area:48'], 'south-central', { lat: 15.8801, lng: 108.3380 }],
  ['sa-pa', 'Sa Pa', ['Sapa', 'Sa Pả'], ['admin-area:15'], 'northwest', { lat: 22.3364, lng: 103.8438 }],
  ['ninh-binh', 'Ninh Bình', ['Ninh Binh', 'Tràng An', 'Tam Cốc'], ['admin-area:37'], 'red-river-delta', { lat: 20.2506, lng: 105.9745 }],
  ['phu-quoc', 'Phú Quốc', ['Phu Quoc', 'Đảo Ngọc'], ['admin-area:91'], 'mekong-delta', { lat: 10.2899, lng: 103.9840 }]
].map(([slug, name, aliases, adminAreaIds, regionSlug, coordinates]) => ({
  id: `destination:${slug}`, slug, name, aliases, adminAreaIds, regionId: `region:${regionSlug}`,
  coordinates, coordinateVerification: 'pending', status: 'editorial', description: '',
  source: { name: 'GreenSteps demo catalog', type: 'editorial', coordinateStatus: 'pending_verification' }, version: '2025-07-01'
}));

module.exports = { source, adminAreas, regions, destinations };
