// Additive, repeatable demo data for the redesigned service detail page.
// Run with --apply to write; without it, only validate and describe the records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { store, GreenService, Vender, Badge, BadgeService } = require('../src/models');
const { calculatePricing } = require('../src/services/booking-pricing.service');

const image = name => `image/services/${name}.png`;
const commonAmenities = ['WiFi miễn phí', 'Phòng tắm riêng', 'Khăn tắm', 'Máy sấy tóc', 'Bình nước dùng lại'];
const lodgingPolicy = [
  'Dữ liệu mẫu để xem và thử giao diện GreenSteps; không phải ưu đãi thương mại thực tế.',
  'Nhận phòng từ 14:00; trả phòng trước 12:00.',
  'Hủy trước 7 ngày: hoàn 90% tiền cọc; trước 3–6 ngày: hoàn 50%; trong 48 giờ: không hoàn cọc.',
  'Đổi ngày tối thiểu 48 giờ trước khi nhận phòng, tùy tình trạng phòng.',
  'Không hút thuốc trong phòng; hạn chế tiếng ồn sau 22:00.'
];
const room = (id, name, photo, area, capacity, beds, price, available, extra = []) => ({
  id, name, images: [image(photo)], area, capacity, beds,
  amenities: [...commonAmenities, ...extra],
  policies: ['Áp dụng điều kiện hoàn/hủy tại tab Chính Sách', 'Nhận phòng 14:00 · trả phòng 12:00', 'Không hút thuốc trong phòng'],
  price_per_night: price, available_rooms: available
});
const demo = (slug, name, type, destination, cost, cover, carbon, maxCapacity, data) => ({
  id: `srv_demo_detail_${slug}`, name_service: `${name} (Demo)`, type,
  destination, cost, image_url: image(cover), carbon, max_capacity: maxCapacity,
  status: 'active',
  current_data: {
    ...data, isDemo: true, seedSource: 'greensteps-detail-demo-v1',
    description: `DỮ LIỆU MẪU — ${data.description} Hình ảnh, mức giá, số lượng và vị trí mang tính minh họa để thử giao diện; chưa phải thông tin đặt dịch vụ thực tế. Chỉ số CO₂ là số liệu mô phỏng.`,
    shortDesc: `DỮ LIỆU MẪU — ${data.description} Giá, phòng trống, ảnh, vị trí và CO₂ chỉ dùng minh họa.`,
    img: image(cover)
  }
});

const services = [
  demo('dalat_garden', 'Nhà Trong Vườn Đà Lạt', 'stay', 'Đà Lạt', 550000, 'stay_homestay_dalat', 2.4, 24, {
    description: 'Homestay phong cách mộc với cửa sổ hướng vườn, khu bếp chung và góc đọc sách yên tĩnh. Phù hợp cho cặp đôi, gia đình và nhóm bạn muốn nghỉ chậm giữa Đà Lạt.',
    address: 'Khu vực Hồ Xuân Hương, Đà Lạt — vị trí minh họa', lat: 11.9416, lng: 108.446,
    areaDescription: 'Khu vực minh họa gần trung tâm Đà Lạt, thuận tiện đi bộ quanh hồ và ghé các quán cà phê địa phương. Các khoảng cách cụ thể cần được xác nhận khi vận hành thực tế.',
    nearby: ['Hồ Xuân Hương', 'Quảng trường Lâm Viên', 'Chợ Đà Lạt', 'Vườn hoa Thành phố'],
    images: ['stay_green_boutique', 'stay_pine_hill', 'stay_mountain_cabin', 'stay_hoa_da_quy'].map(image),
    amenityGroups: [
      { name: 'Trong phòng', items: ['WiFi miễn phí', 'Phòng tắm riêng', 'Máy sấy tóc', 'Bàn làm việc', 'Ấm đun nước'] },
      { name: 'Không gian chung', items: ['Bếp chung', 'Vườn hoa', 'Góc đọc sách', 'Chỗ đỗ xe', 'Khu ăn sáng'] },
      { name: 'Trải nghiệm xanh', items: ['Trạm tiếp nước', 'Phân loại rác', 'Đồ dùng tái sử dụng', 'Gợi ý đi bộ quanh hồ'] }
    ],
    policies: lodgingPolicy,
    rooms: [
      room('dalat_studio', 'Studio Hướng Vườn', 'stay_homestay_dalat', 25, 2, '1 giường đôi', 550000, 4, ['Bàn làm việc', 'Cửa sổ hướng vườn']),
      room('dalat_family', 'Family Garden', 'stay_hoa_da_quy', 42, 4, '2 giường đôi', 950000, 3, ['Bếp riêng', 'Ban công', 'Phù hợp gia đình']),
      room('dalat_cabin', 'Cabin Gỗ Riêng Tư', 'stay_green_boutique', 32, 2, '1 giường queen', 790000, 2, ['Sân hiên', 'Góc đọc sách'])
    ]
  }),
  demo('hoian_riverside', 'An Nhiên Eco Stay Hội An', 'stay', 'Hội An', 680000, 'stay_hoi_an_eco', 1.8, 28, {
    description: 'Điểm nghỉ mang cảm hứng nhà vườn Hội An, kết hợp phòng gia đình, sân hiên và trải nghiệm xe đạp. Ưu tiên vật liệu tự nhiên và hoạt động nhẹ nhàng tại địa phương.',
    address: 'Khu vực Cẩm Thanh, Hội An — vị trí minh họa', lat: 15.8718, lng: 108.3595,
    areaDescription: 'Không gian minh họa tại khu vực Cẩm Thanh, thích hợp khám phá làng quê và kết nối chuyến tham quan phố cổ. Giờ phục vụ các tiện ích được xác nhận trước khi đến.',
    nearby: ['Rừng dừa Cẩm Thanh', 'Phố cổ Hội An', 'Làng rau Trà Quế', 'Biển An Bàng'],
    images: ['stay_mai_anh_dao', 'stay_green_boutique', 'stay_homestay_dalat', 'stay_pine_hill'].map(image),
    amenityGroups: [
      { name: 'Phòng nghỉ', items: ['WiFi miễn phí', 'Điều hòa', 'Phòng tắm riêng', 'Ấm đun nước', 'Két an toàn'] },
      { name: 'Tiện ích chung', items: ['Sân vườn', 'Xe đạp', 'Bếp chung', 'Khu ăn sáng', 'Chỗ đỗ xe'] },
      { name: 'Hỗ trợ khách', items: ['Giữ hành lý', 'Gợi ý tuyến xe đạp', 'Trạm tiếp nước', 'Hỗ trợ lịch trình địa phương'] }
    ],
    policies: lodgingPolicy,
    rooms: [
      room('hoian_deluxe', 'Deluxe Sân Vườn', 'stay_hoi_an_eco', 28, 2, '1 giường queen', 680000, 5, ['Điều hòa', 'Sân hiên']),
      room('hoian_family', 'Family Balcony', 'stay_mai_anh_dao', 45, 4, '2 giường đôi', 1180000, 2, ['Điều hòa', 'Ban công', 'Bếp riêng']),
      room('hoian_suite', 'Suite An Nhiên', 'stay_pine_hill', 55, 3, '1 giường king và 1 sofa bed', 1490000, 1, ['Điều hòa', 'Phòng khách', 'Bồn tắm'])
    ]
  }),
  demo('phuyen_seaside', 'Gió Biển Eco Retreat Phú Yên', 'stay', 'Phú Yên', 820000, 'stay_hon_yen', 2.1, 20, {
    description: 'Khu nghỉ minh họa cho chuyến đi biển nhẹ nhàng với bungalow, sân riêng và không gian gia đình. Khuyến khích sử dụng bình nước cá nhân và tôn trọng hệ sinh thái ven biển.',
    address: 'Khu vực ven biển Tuy Hòa, Phú Yên — vị trí minh họa', lat: 13.095, lng: 109.324,
    areaDescription: 'Khu vực minh họa ven biển Tuy Hòa. Khách có thể kết hợp nghỉ dưỡng với tham quan danh thắng Phú Yên; hoạt động ngoài trời phụ thuộc thời tiết.',
    nearby: ['Bãi biển Tuy Hòa', 'Tháp Nghinh Phong', 'Hòn Yến', 'Gành Đá Đĩa'],
    images: ['stay_tuyen_lam_lake', 'stay_mountain_cabin', 'stay_villa_tuyen_lam', 'stay_green_boutique'].map(image),
    amenityGroups: [
      { name: 'Tiện nghi phòng', items: ['WiFi miễn phí', 'Điều hòa', 'Phòng tắm riêng', 'Tủ lạnh', 'Sân hiên'] },
      { name: 'Không gian nghỉ dưỡng', items: ['Khu sân vườn', 'Chỗ đỗ xe', 'Khu ăn sáng', 'Không gian sinh hoạt chung'] },
      { name: 'Du lịch có trách nhiệm', items: ['Trạm tiếp nước', 'Phân loại rác', 'Thông tin bảo vệ bờ biển', 'Ưu tiên thực phẩm địa phương'] }
    ],
    policies: [...lodgingPolicy, 'Hoạt động ngoài trời được điều chỉnh theo thời tiết để đảm bảo an toàn.'],
    rooms: [
      room('phuyen_bungalow', 'Bungalow Gió Biển', 'stay_hon_yen', 30, 2, '1 giường đôi', 820000, 4, ['Điều hòa', 'Sân riêng']),
      room('phuyen_family', 'Family Retreat', 'stay_villa_tuyen_lam', 48, 4, '2 giường đôi', 1350000, 2, ['Điều hòa', 'Bếp riêng', 'Sân hiên']),
      room('phuyen_cabin', 'Cabin Yên Tĩnh', 'stay_mountain_cabin', 26, 2, '1 giường đôi', 720000, 0, ['Điều hòa', 'Bàn làm việc'])
    ]
  }),
  demo('dalat_farm_table', 'Bếp Vườn Farm to Table', 'food', 'Đà Lạt', 220000, 'food_organic_vietnamese', 0.8, 20, {
    description: 'Bữa ăn theo mùa với rau củ địa phương, thực đơn chay tùy chọn và không gian bàn ăn gia đình. Giá mẫu áp dụng cho một khách với một phần ăn theo thực đơn.',
    address: 'Khu vực trung tâm Đà Lạt — vị trí minh họa', lat: 11.9404, lng: 108.4388,
    startTime: '11:30',
    areaDescription: 'Địa điểm minh họa ở trung tâm Đà Lạt, thuận tiện kết hợp với lịch đi bộ quanh hồ.',
    nearby: ['Chợ Đà Lạt', 'Hồ Xuân Hương', 'Khu cà phê địa phương'],
    images: ['food_local_cafe', 'food_organic_vietnamese'].map(image),
    amenityGroups: [
      { name: 'Bao gồm trong phần ăn', items: ['Món chính theo mùa', 'Rau củ địa phương', 'Nước lọc', 'Tráng miệng'] },
      { name: 'Tiện ích & hỗ trợ', items: ['WiFi miễn phí', 'Lựa chọn món chay', 'Ghế trẻ em', 'Tư vấn thành phần món ăn'] },
      { name: 'Vận hành xanh', items: ['Không dùng ống hút nhựa', 'Ưu tiên nông sản địa phương', 'Phân loại rác'] }
    ],
    policies: ['Dịch vụ mẫu, chưa phải nhà hàng đang nhận khách thực tế.', 'Khung giờ phục vụ minh họa: 11:30–14:00 và 17:30–20:00.', 'Báo trước yêu cầu ăn chay hoặc dị ứng thực phẩm khi đặt.', 'Hủy trước 24 giờ: hoàn tiền cọc; trong 24 giờ: xử lý theo xác nhận đặt chỗ.']
  }),
  demo('hoian_cycle', 'Đạp Xe Xanh Hội An', 'transport', 'Hội An', 120000, 'transport_green_bike', 0.2, 16, {
    description: 'Gói thuê xe đạp một ngày để khám phá nhịp sống Hội An. Bao gồm xe, khóa, mũ bảo hiểm và tuyến đường gợi ý; giá mẫu tính cho mỗi khách một xe.',
    address: 'Khu vực Cẩm Châu, Hội An — vị trí minh họa', lat: 15.888, lng: 108.345,
    startTime: '08:00', areaDescription: 'Điểm nhận xe minh họa tại Cẩm Châu, thuận tiện kết nối phố cổ và các tuyến đường làng.',
    nearby: ['Phố cổ Hội An', 'Làng rau Trà Quế', 'Biển An Bàng'],
    images: ['transport_electric_car', 'transport_green_bike'].map(image),
    amenityGroups: [
      { name: 'Thiết bị đi kèm', items: ['Xe đạp', 'Khóa xe', 'Mũ bảo hiểm', 'Giỏ đựng đồ'] },
      { name: 'Hỗ trợ hành trình', items: ['Gợi ý tuyến đạp xe', 'Hướng dẫn kiểm tra xe', 'Trạm tiếp nước', 'Hỗ trợ trong giờ phục vụ'] }
    ],
    policies: ['Dữ liệu dịch vụ thuê xe mẫu để thử giao diện.', 'Nhận xe từ 08:00, trả xe trước 18:00 cùng ngày.', 'Kiểm tra phanh, lốp và độ cao yên trước khi nhận xe.', 'Đội mũ bảo hiểm, tuân thủ quy định giao thông và không đi vào khu vực cấm xe.', 'Báo trước tối thiểu 24 giờ nếu cần đổi ngày.']
  }),
  demo('hoian_herbal', 'Workshop Thảo Mộc & Sống Xanh', 'attraction', 'Hội An', 350000, 'attraction_herbal_workshop', 0.6, 12, {
    description: 'Buổi trải nghiệm 2 giờ tìm hiểu thảo mộc địa phương, tự làm một sản phẩm chăm sóc cá nhân đơn giản và thực hành giảm rác nhựa. Giá mẫu tính cho một người tham gia.',
    address: 'Khu vực làng rau Trà Quế, Hội An — vị trí minh họa', lat: 15.9035, lng: 108.3387,
    startTime: '09:00', areaDescription: 'Không gian workshop minh họa gần khu vực Trà Quế, có thể kết hợp đạp xe và tham quan làng rau.',
    nearby: ['Làng rau Trà Quế', 'Biển An Bàng', 'Phố cổ Hội An'],
    images: ['attraction_kayaking', 'attraction_herbal_workshop'].map(image),
    amenityGroups: [
      { name: 'Nội dung trải nghiệm', items: ['Giới thiệu nguyên liệu thảo mộc', 'Hướng dẫn thực hành', 'Một sản phẩm tự làm mang về', 'Thảo luận thói quen sống xanh'] },
      { name: 'Dụng cụ & hỗ trợ', items: ['Nguyên liệu thực hành', 'Dụng cụ dùng chung', 'Tạp dề', 'Nước uống', 'Hướng dẫn viên địa phương'] }
    ],
    policies: ['Workshop mẫu để xem giao diện, chưa phải sự kiện thực tế.', 'Có mặt trước giờ bắt đầu 15 phút; thời lượng minh họa 09:00–11:00.', 'Trẻ em cần người lớn đi kèm.', 'Thông báo trước nếu có dị ứng với thảo mộc, tinh dầu hoặc nguyên liệu.', 'Đổi ngày hoặc hủy trước ít nhất 48 giờ.']
  })
];

function enrichInformationTabs() {
  for (const service of services) {
    const data = service.current_data;
    data.greenFeatures = [
      { title: 'Giảm rác nhựa', description: 'Ưu tiên bình nước dùng lại, hạn chế đồ nhựa sử dụng một lần trong quá trình phục vụ.' },
      { title: 'Tiết kiệm nước', description: 'Khuyến khích sử dụng nước vừa đủ và chủ động yêu cầu thay khăn khi cần.' },
      { title: 'Năng lượng tiết kiệm', description: 'Sử dụng đèn tiết kiệm điện và nhắc khách tắt thiết bị khi không sử dụng.' },
      { title: 'Kết nối cộng đồng địa phương', description: 'Gợi ý trải nghiệm địa phương, ưu tiên nguyên liệu và sản phẩm từ khu vực.' }
    ];
    data.nearbyGroups = [
      { name: 'Điểm nổi bật', items: data.nearby.map(name => ({ name })) },
      { name: 'Giao thông & di chuyển xanh', items: [{ name: 'Gợi ý tuyến đi bộ quanh khu vực' }, { name: 'Hỗ trợ thông tin thuê xe đạp tại địa phương' }] }
    ];
    if (service.type === 'stay') {
      data.popularAmenities = [
        { name: 'WiFi ở khu vực chung', fee: 'free' }, { name: 'Nơi để hành lý', fee: 'free' },
        { name: 'Chỗ đỗ xe', fee: 'free' }, { name: 'Trạm tiếp nước', fee: 'free' }
      ];
      data.amenityGroups = [
        { name: 'Internet', items: [{ name: 'WiFi ở khu vực chung', fee: 'free' }, { name: 'WiFi trong phòng', fee: 'free' }] },
        { name: 'Chỗ đỗ xe', items: [{ name: 'Chỗ đỗ xe tại chỗ nghỉ', fee: 'free' }, { name: 'Trạm sạc xe điện', available: false }] },
        { name: 'Dịch vụ lễ tân', items: ['Nơi để hành lý', 'Hỗ trợ thông tin du lịch', 'Hướng dẫn nhận phòng'] },
        { name: 'Ngôn ngữ sử dụng', items: ['Tiếng Việt', 'Tiếng Anh'] },
        { name: 'Khu vực chung', items: ['Sân vườn', 'Bếp chung', 'Góc đọc sách', { name: 'Thang máy', available: false }] },
        { name: 'Dịch vụ dọn vệ sinh', items: ['Dọn phòng theo yêu cầu', { name: 'Dịch vụ giặt là', fee: 'paid', note: 'Vui lòng hỏi đối tác về mức phí trước khi sử dụng.' }] },
        { name: 'An toàn & an ninh', items: ['Bình chữa cháy', 'Bộ sơ cứu', 'Báo động cháy', 'Camera ở khu vực chung'] },
        { name: 'Phòng nghỉ', items: ['Phòng tắm riêng', 'Máy sấy tóc', 'Khăn tắm', 'Ấm đun nước'] }
      ];
      data.policyGroups = [
        { title: 'Thời gian nhận và trả phòng', lines: ['Nhận phòng: từ 14:00. Trả phòng: trước 12:00.', 'Vui lòng báo giờ đến dự kiến; nhận phòng sớm hoặc trả phòng muộn tùy tình trạng phòng.'] },
        { title: 'Chính sách cho trẻ em', lines: ['Trẻ em được lưu trú cùng người lớn; tính trong tổng số khách và sức chứa của phòng đã chọn.', 'Chi phí bổ sung, nếu có, cần được đối tác xác nhận trước khi đặt.'] },
        { title: 'Nôi/cũi và giường phụ', lines: ['Chưa cung cấp nôi/cũi hoặc giường phụ trong gói phòng Demo. Vui lòng chọn loại phòng đủ sức chứa.'] },
        { title: 'Bữa sáng', lines: ['Giá phòng Demo chưa bao gồm bữa sáng. Có thể liên hệ đối tác để hỏi lựa chọn ăn sáng và chi phí.'] },
        { title: 'Chính sách đặt cọc & thanh toán', lines: ['Tiền cọc và các khoản phí được hiển thị trong báo giá trước khi xác nhận.', 'Thanh toán theo phương thức khả dụng ở bước đặt chỗ. Không có khoản đặt cọc đảm bảo bổ sung trong dữ liệu Demo.'] },
        { title: 'Điều kiện hoàn / hủy', lines: ['Hủy trước 7 ngày: hoàn 90% tiền cọc. Hủy trước 3–6 ngày: hoàn 50%. Trong 48 giờ: không hoàn cọc.', 'Đổi ngày tối thiểu 48 giờ trước ngày nhận phòng, tùy tình trạng phòng.'] },
        { title: 'Thú cưng', lines: ['Dữ liệu Demo chưa hỗ trợ mang theo thú cưng.'] },
        { title: 'Giới hạn độ tuổi & giấy tờ', lines: ['Người đại diện nhận phòng từ 18 tuổi, xuất trình giấy tờ tùy thân hợp lệ.'] },
        { title: 'Quy định tại chỗ nghỉ', lines: ['Không hút thuốc trong phòng. Giữ yên tĩnh sau 22:00.', 'Tôn trọng cảnh quan, phân loại rác theo hướng dẫn và tiết kiệm điện, nước.'] },
        { title: 'Thông tin dữ liệu mẫu', lines: ['Điều kiện trên được tạo để trải nghiệm giao diện GreenSteps; không phải chính sách của cơ sở đang nhận đặt phòng thực tế.'] }
      ];
    } else {
      data.popularAmenities = data.amenityGroups.flatMap(group => group.items).slice(0, 6);
      data.policyGroups = data.policies.map((line, index) => ({ title: ['Thông tin dịch vụ', 'Thời gian phục vụ', 'Điều kiện tham gia', 'Lưu ý an toàn', 'Đổi ngày & hỗ trợ'][index] || 'Thông tin bổ sung', lines: [line] }));
    }
  }
}

function validate() {
  assert.equal(new Set(services.map(service => service.id)).size, services.length);
  for (const service of services) {
    const data = service.current_data;
    assert.ok(data.description && data.address && data.policies.length && data.amenityGroups.length);
    const photos = [service.image_url, ...data.images, ...(data.rooms || []).flatMap(item => item.images)];
    for (const photo of photos) assert.ok(fs.existsSync(path.resolve(__dirname, '../../my-app/public', photo)), `Missing image: ${photo}`);
    if (service.type === 'stay') {
      assert.equal(data.rooms.length, 3);
      for (const item of data.rooms) {
        assert.ok(Number.isSafeInteger(item.price_per_night) && item.price_per_night > 0);
        assert.ok(Number.isSafeInteger(item.available_rooms) && item.available_rooms >= 0);
        assert.ok(item.capacity >= 1 && item.area > 0 && item.policies.length);
      }
    }
  }
}

async function main() {
  enrichInformationTabs();
  validate();
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'validate-only', services: services.map(({ id, type, name_service, current_data }) => ({ id, type, name: name_service, rooms: current_data.rooms?.length || 0 })) }, null, 2));
    return;
  }
  await store.authenticate();
  const existing = await GreenService.findAll();
  const vendors = await Vender.findAll();
  assert.ok(vendors.length, 'An existing provider is required; no provider account will be created.');
  const badges = await Badge.findAll();
  const created = [];
  const updated = [];
  for (const service of services) {
    const previous = await GreenService.findByPk(service.id);
    assert.ok(!previous || previous.current_data?.seedSource === 'greensteps-detail-demo-v1', `Refusing to overwrite a non-demo service: ${service.id}`);
    const regional = existing.find(item => item.destination === service.destination && vendors.some(vendor => vendor.id === item.vender_id));
    const venderId = previous?.vender_id || regional?.vender_id || vendors[0].id;
    const values = { ...service, vender_id: venderId };
    if (previous) {
      await previous.update(values);
      updated.push(service.id);
    } else {
      await GreenService.create({ ...values, rating: null, reviews_count: 0, bookings_count: 0, views_count: 0 });
      created.push(service.id);
    }
    const preferred = badges.find(item => item.id === 'green' || item.name === 'Không rác nhựa');
    if (preferred) await BadgeService.findOrCreate({ where: { service_id: service.id, badge_name: preferred.id } });
    const saved = await GreenService.findByPk(service.id);
    assert.equal(saved.current_data.rooms?.length || 0, service.current_data.rooms?.length || 0);
    if (service.type === 'stay') {
      const quote = await calculatePricing({
        type: 'service', targetId: service.id, guestCount: 2,
        roomId: service.current_data.rooms[0].id, roomCount: 1,
        bookingDate: '2027-01-10', checkOutDate: '2027-01-12'
      });
      assert.equal(quote.tourSubtotal, service.current_data.rooms[0].price_per_night * 2);
    }
  }
  console.log(JSON.stringify({ database: store.db.databaseName, created, updated,
    services: services.length, roomTypes: services.reduce((sum, service) => sum + (service.current_data.rooms?.length || 0), 0),
    verified: 'Catalog records read back, local images exist, and 2-night room quotes match database prices.'
  }, null, 2));
}

const timeout = setTimeout(() => { console.error('Database connection timed out. No connection details are logged.'); process.exit(1); }, 30000);
main().catch(error => { console.error(error.name + ': ' + (error.code || error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[redacted]'))); process.exitCode = 1; })
  .finally(async () => { clearTimeout(timeout); await store.close(); });
