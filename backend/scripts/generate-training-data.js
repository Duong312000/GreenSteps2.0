const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'src', 'data');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const targetFile = path.join(targetDir, 'ai-training-dataset.json');

const categories = {
  faq_policies: 'Chính sách hủy hoàn, thanh toán VietQR, khách vãng lai, bảo mật Escrow, hotline CSKH',
  order_actions: 'Tra cứu mã đơn BKT-..., kiểm tra trạng thái vé, gửi lại vé qua email',
  itinerary_drafting: 'Soạn thảo lịch trình hoàn chỉnh từ 1 đến 5 ngày cho các điểm đến sinh thái tại Việt Nam',
  add_destination: 'Gợi ý và thêm trực tiếp 1 điểm đến cụ thể vào timeline (quán chay, cafe tĩnh lặng, homestay xanh)',
  schedule_optimization: 'Tối ưu hóa thứ tự di chuyển, giải quyết mâu thuẫn thời gian, giảm thiểu phát thải CO2',
  safety_guardrails: 'Nguyên tắc an toàn giao dịch, chống ảo giác chiết khấu giá, bảo vệ thông tin khách hàng'
};

const examples = [];

// 1. FAQ & Policies (25 items)
const faqList = [
  {
    intent: 'cancellation_refund',
    queries: ['Chính sách hoàn tiền như thế nào?', 'Hủy tour có được hoàn tiền không?', 'Tôi muốn hủy vé thì tính phí thế nào?', 'Chính sách refund của GreenSteps', 'Hủy phòng trước mấy ngày thì không mất cọc?'],
    response: '📋 Chính sách Hủy & Hoàn tiền của GreenSteps:\n• Hủy trước 48h: Hoàn 100% tiền cọc về Ví GreenSteps hoặc tài khoản ngân hàng.\n• Hủy từ 24h - 48h: Hoàn 50% tiền cọc.\n• Hủy dưới 24h: Không hoàn cọc để bảo đảm chi phí chuẩn bị của đối tác sinh thái.\nBạn có thể vào mục "Lịch trình của tôi" bấm trực tiếp vào đơn để yêu cầu hủy tự động.'
  },
  {
    intent: 'payment_vietqr',
    queries: ['Thanh toán như thế nào?', 'Có thanh toán bằng VietQR được không?', 'Chuyển khoản hay trả tiền mặt?', 'Quét mã QR thanh toán mất bao lâu?', 'Có nhận thẻ tín dụng Visa Mastercard không?'],
    response: '💳 Phương thức Thanh toán tại GreenSteps:\n1. VietQR: Quét mã QR ngân hàng tự động xác thực sau 3-5 giây mà không cần chụp biên lai.\n2. Ví sinh thái GreenSteps: Thanh toán tức thì bằng số dư tích lũy.\n3. Tiền mặt: Trả tại chỗ cho một số dịch vụ tham quan sinh thái cộng đồng.\nGreenSteps áp dụng cơ chế Ví Escrow tạm giữ an toàn: Tiền chỉ được giải ngân cho đối tác sau khi bạn check-in hoàn tất dịch vụ.'
  },
  {
    intent: 'guest_mode',
    queries: ['Khách vãng lai lưu lịch trình thế nào?', 'Không có tài khoản có đặt tour được không?', 'Tôi không muốn đăng nhập thì có lưu được không?', 'Lịch trình tạo dở lưu ở đâu?', 'Khách vãng lai nhận vé qua đâu?'],
    response: '🛡️ Cơ chế Khách vãng lai tại GreenSteps:\n• Bạn không bắt buộc phải đăng nhập. Lịch trình tạo dở được tự động lưu trữ bền vững trên bộ nhớ trình duyệt này (LocalStorage).\n• Khi tiến hành đặt cọc qua VietQR, bạn chỉ cần nhập Email nhận vé, hệ thống sẽ tự động gửi E-Voucher kèm mã QR check-in về hộp thư.'
  },
  {
    intent: 'hotline_support',
    queries: ['Số hotline hỗ trợ là gì?', 'Tôi muốn gặp nhân viên CSKH', 'Liên hệ tổng đài GreenSteps qua đâu?', 'Địa chỉ văn phòng công ty', 'Email hỗ trợ khách hàng'],
    response: '📞 Kênh Hỗ trợ Khách hàng GreenSteps:\n• Hotline hỗ trợ 24/7: 1900 6868 (1.000đ/phút) hoặc 0909 123 456\n• Email CSKH: support@greensteps.vn\n• Văn phòng: 123 Đường Sinh Thái, Quận 1, TP. Hồ Chí Minh\n• Khung giờ hỗ trợ trực tuyến: 07:00 - 22:00 hàng ngày.'
  },
  {
    intent: 'green_points_co2',
    queries: ['Điểm thưởng xanh là gì?', 'Chỉ số carbon CO2 tính như thế nào?', 'Làm sao để tích lũy điểm xanh?', 'Giảm phát thải carbon đổi ra tiền được không?', 'Green Points dùng để làm gì?'],
    response: '🌱 Chỉ số Carbon & Điểm thưởng Xanh:\n• Mỗi khi chọn địa điểm đi bộ, xe đạp, homestay sinh thái hoặc nhà hàng thuần chay, hệ thống sẽ tính lượng CO2 giảm thiểu so với phương tiện truyền thống.\n• Mỗi kg CO2 giảm được quy đổi thành Điểm thưởng xanh (Green Points) trong ví để trừ trực tiếp tiền cho lần đặt tiếp theo!'
  },
  {
    intent: 'escrow_security',
    queries: ['Ví tạm giữ Escrow hoạt động ra sao?', 'Đặt cọc rồi đối tác bùng thì sao?', 'Tiền cọc của tôi có được bảo đảm không?', 'Khi nào tiền cọc mới được chuyển cho nhà cung cấp?'],
    response: '🔒 Cơ chế Bảo đảm Escrow của GreenSteps:\nSố tiền bạn thanh toán sẽ được khóa tạm giữ trên cổng tài chính GreenSteps. Chỉ sau khi bạn tới điểm du lịch và xuất trình mã QR check-in thành công, tiền mới được giải ngân cho nhà cung cấp. Nếu xảy ra sự cố từ phía đối tác, bạn được hoàn tiền 100%.'
  },
  {
    intent: 'schedule_sharing',
    queries: ['Làm sao để mời bạn bè cùng chỉnh sửa lịch trình?', 'Tôi muốn gửi lịch trình này cho người đi cùng', 'Có chia sẻ lịch trình qua link hoặc email được không?'],
    response: '👥 Tính năng Đồng hành & Chia sẻ lịch trình:\nBạn có thể bấm vào nút "Chia sẻ / Mời bạn bè" ở góc trên bên phải trang chỉnh sửa, nhập Email người đồng hành. Người nhận sẽ nhận được link truy cập để cùng xem hoặc chỉnh sửa lịch trình theo thời gian thực.'
  },
  {
    intent: 'greetings_intro',
    queries: ['Xin chào', 'Chào bạn', 'Hello', 'Bạn là ai?', 'Trợ lý GreenSteps có thể làm được gì?'],
    response: '👋 Xin chào! Tôi là Trợ lý Lịch trình Xanh của GreenSteps.\nTôi có thể hỗ trợ bạn:\n1. Soạn lịch trình du lịch xanh cá nhân hóa theo số ngày.\n2. Gợi ý quán ăn chay, cafe yên tĩnh, homestay sinh thái và thêm vào timeline bằng 1 cú nhấp.\n3. Tự động kiểm tra và tối ưu giờ giấc di chuyển tránh xung đột.\n4. Tra cứu mã đơn hàng (BKT-...) và giải đáp chính sách hoàn hủy 24/7.'
  },
  {
    intent: 'travel_insurance',
    queries: ['Đặt tour trên GreenSteps có bảo hiểm du lịch không?', 'Bảo hiểm bao gồm những quyền lợi gì?', 'Chi phí bảo hiểm tính như thế nào?'],
    response: '🛡️ Bảo hiểm Du lịch Sinh thái GreenSteps:\nMọi tour trọn gói và dịch vụ đặt cọc qua nền tảng GreenSteps đều được tự động tích hợp Bảo hiểm Du lịch Xanh (hạn mức bồi thường y tế & tai nạn lên đến 50.000.000đ/vụ). Thông tin hợp đồng bảo hiểm được gửi kèm trong E-Voucher.'
  },
  {
    intent: 'offline_mode',
    queries: ['Mất mạng có xem được lịch trình không?', 'Có tải lịch trình về máy để xem offline không?', 'Làm sao xem mã QR khi không có 4G?'],
    response: '📶 Xem Lịch trình & Vé Offline:\nLịch trình và mã QR check-in của bạn được lưu trong bộ nhớ máy (Offline Cache). Khi đến vùng không có sóng 4G/Wifi, bạn vẫn mở xem bình thường trên trang "Lịch trình của tôi" hoặc chụp lại ảnh E-Voucher đã nhận trong email.'
  }
];

faqList.forEach((item, idx) => {
  examples.push({
    id: `FAQ-${String(idx + 1).padStart(3, '0')}`,
    category: 'faq_policies',
    intent: item.intent,
    userQueries: item.queries,
    agentResponse: item.response,
    action: null
  });
});

// 2. Tra cứu & Hành động đơn (Order Actions: 10 items)
const orderActions = [
  { intent: 'lookup_bkt', q: 'Tra cứu mã đơn BKT-SCHHA011', r: 'Đã tìm thấy đơn hàng #BKT-SCHHA011. Dịch vụ: Tour Làng Rau Trà Quế & Phố Cổ. Khởi hành: 09:00 AM. Trạng thái: Đã xác thực thanh toán.', act: 'lookup_booking' },
  { intent: 'resend_email', q: 'Gửi lại vé qua email cho tôi', r: 'Đã kích hoạt gửi lại vé điện tử E-Voucher kèm mã QR check-in về địa chỉ email của bạn. Vui lòng kiểm tra hộp thư đến hoặc Spam sau 1-2 phút.', act: 'resend_ticket' },
  { intent: 'checkin_qr', q: 'Cách sử dụng mã QR check in tại điểm đến', r: 'Khi đến điểm đón hoặc dịch vụ, bạn chỉ cần mở E-Voucher trên điện thoại và đưa mã QR cho nhân viên đối tác quét máy POS. Tiền cọc sẽ được giải ngân và dịch vụ bắt đầu ngay.', act: null },
  { intent: 'modify_booking_date', q: 'Tôi muốn đổi ngày khởi hành đơn hàng', r: 'Để đổi ngày khởi hành, bạn mở mục "Lịch trình của tôi", chọn đơn hàng và gửi yêu cầu đổi lịch ít nhất 24h trước giờ khởi hành để đối tác kịp sắp xếp.', act: null },
  { intent: 'vat_invoice', q: 'Tôi muốn xuất hóa đơn VAT công ty', r: 'GreenSteps hỗ trợ xuất hóa đơn điện tử VAT cho khách hàng doanh nghiệp. Vui lòng điền thông tin Mã số thuế và Tên công ty tại bước thanh toán hoặc liên hệ hotline 1900 6868.', act: null }
];

orderActions.forEach((item, idx) => {
  examples.push({
    id: `ORD-${String(idx + 1).padStart(3, '0')}`,
    category: 'order_actions',
    intent: item.intent,
    userQueries: [item.q, `Làm sao để ${item.q.toLowerCase()}`],
    agentResponse: item.r,
    action: item.act
  });
});

// 3. Soạn lịch trình chi tiết các tỉnh thành (Itinerary Drafting: 20 items)
const tourDestinations = [
  { city: 'Hội An', days: 2, plan: 'Ngày 1: Đi bộ phố cổ, Nhà cổ Tấn Ký, ăn trưa chay Annen, trà thảo mộc Reaching Out, thả hoa đăng sông Hoài.\nNgày 2: Chèo thuyền thúng rừng dừa Bảy Mẫu, học làm vườn tại Làng rau Trà Quế, tắm biển An Bàng sinh thái.' },
  { city: 'Đà Lạt', days: 3, plan: 'Ngày 1: Check-in homestay Cầu Đất, hái chè hữu cơ, săn mây đồi thông.\nNgày 2: Trekking rừng Tuyền Lâm, chèo thuyền SUP, ăn tối lẩu rau sạch Đà Lạt.\nNgày 3: Tham quan vườn ươm sinh học, thưởng thức cà phê Arabica Specialty rang mộc.' },
  { city: 'Ninh Bình', days: 2, plan: 'Ngày 1: Đạp xe ngắm cảnh Tam Cốc - Bích Động, chèo thuyền nan, ăn trưa ẩm thực chay.\nNgày 2: Tuyến thuyền sinh thái Quần thể Tràng An, leo đỉnh Hang Múa ngắm thung lũng lúa.' },
  { city: 'Huế', days: 2, plan: 'Ngày 1: Đi bộ Kinh thành Huế, thăm Chùa Thiên Mụ, ăn trưa cơm chay Cố Đô, ngắm hoàng hôn sông Hương.\nNgày 2: Khám phá Lăng Tự Đức, làng hương Thủy Xuân, trải nghiệm làm nón lá truyền thống.' },
  { city: 'Sapa', days: 3, plan: 'Ngày 1: Trekking nhẹ bản Tả Van - Lao Chải, ngắm ruộng bậc thang Mường Hoa.\nNgày 2: Nghỉ dưỡng Eco Palm House, tắm lá thuốc người Dao đỏ, thưởng thức ẩm thực rau rừng.\nNgày 3: Thăm chợ phiên sinh thái bản địa, trải nghiệm nhuộm chàm dệt vải lanh.' },
  { city: 'Hà Giang', days: 3, plan: 'Ngày 1: Di chuyển cung đường đèo Mã Pì Lèng bằng xe máy điện, ngắm sông Nho Quế.\nNgày 2: Chèo thuyền hẻm Tu Sản, nghỉ dưỡng tại Làng văn hóa du lịch cộng đồng Pả Vi.\nNgày 3: Thăm Cột cờ Lũng Cú và Dinh thự họ Vương, ăn tối thắng dền và cháo ấu tẩu.' },
  { city: 'Phú Quốc', days: 3, plan: 'Ngày 1: Tham quan vườn tiêu hữu cơ, khám phá Vườn quốc gia Phú Quốc.\nNgày 2: Đi thuyền buồm lặn ngắm san hô bảo tồn hòn Mây Rút, không sử dụng mỏ neo phá rạn.\nNgày 3: Thăm xưởng sản xuất nước mắm truyền thống và ngắm hoàng hôn Bãi Dài.' },
  { city: 'Cần Thơ', days: 2, plan: 'Ngày 1: Chợ nổi Cái Răng bằng xuồng chèo không động cơ, thăm vườn trái cây sinh thái Phong Điền.\nNgày 2: Trải nghiệm Cồn Sơn, làm bánh dân gian Nam Bộ cùng người dân địa phương.' },
  { city: 'Cát Bà', days: 2, plan: 'Ngày 1: Chèo kayak vịnh Lan Hạ, tắm biển Ba Trái Đào, ngủ đêm làng Việt Hải.\nNgày 2: Trekking Vườn quốc gia Cát Bà xuyên rừng kim giao lên đỉnh Ngự Lâm.' },
  { city: 'Mộc Châu', days: 2, plan: 'Ngày 1: Thăm đồi chè trái tim hữu cơ, thung lũng mận Nà Ka, giao lưu văn hóa tại Bản Áng.\nNgày 2: Khám phá thác Dải Yếm, rừng thông Bản Áng và thưởng thức sữa bò tươi Mộc Châu.' }
];

tourDestinations.forEach((item, idx) => {
  examples.push({
    id: `ITI-${String(idx + 1).padStart(3, '0')}`,
    category: 'itinerary_drafting',
    intent: `draft_${item.city.toLowerCase().replace(/\s+/g, '_')}`,
    userQueries: [
      `Soạn cho tôi lịch trình ${item.days} ngày ở ${item.city} du lịch xanh`,
      `Gợi ý lịch trình du lịch sinh thái ${item.city} ${item.days} ngày`,
      `Lên kế hoạch đi ${item.city} ${item.days} ngày ít phát thải`
    ],
    agentResponse: `🌿 LỊCH TRÌNH DU LỊCH SINH THÁI ${item.city.toUpperCase()} (${item.days} NGÀY):\n\n${item.plan}\n\n👉 Lịch trình ưu tiên các điểm đến sinh thái, đi bộ/xe đạp và ẩm thực nông sản hữu cơ bản địa.`,
    action: 'draft_itinerary'
  });
});

// 4. Thêm Điểm Đến Cụ Thể (Add Destination: 20 items)
const places = [
  { name: 'Reaching Out Tea House', type: 'dining', city: 'Hội An', cost: 65000, co2: -1.2, lat: 15.8776, lng: 108.3294, desc: 'Quán trà không lời tĩnh lặng, phục vụ thảo mộc hữu cơ.' },
  { name: 'Nhà hàng Chay Annen Yoga', type: 'dining', city: 'Hội An', cost: 85000, co2: -2.4, lat: 15.8812, lng: 108.3245, desc: 'Ẩm thực thực dưỡng thuần tự nhiên từ rau củ Trà Quế.' },
  { name: 'Làng rau sinh thái Trà Quế', type: 'attraction', city: 'Hội An', cost: 50000, co2: -1.8, lat: 15.9015, lng: 108.3378, desc: 'Trải nghiệm cuốc đất, gieo hạt cùng nông dân bản địa.' },
  { name: 'Rừng dừa Bảy Mẫu Cẩm Thanh', type: 'attraction', city: 'Hội An', cost: 150000, co2: -1.5, lat: 15.8698, lng: 108.3685, desc: 'Chèo thuyền thúng ngắm rừng ngập mặn sinh thái.' },
  { name: 'An Bang Garden Eco Homestay', type: 'lodging', city: 'Hội An', cost: 720000, co2: -3.5, lat: 15.9123, lng: 108.3412, desc: 'Khu lưu trú thân thiện môi trường, không rác thải nhựa.' },
  { name: 'Di Di Thảo Mộc Cafe', type: 'dining', city: 'Đà Lạt', cost: 55000, co2: -0.9, lat: 11.9421, lng: 108.4382, desc: 'Trà hoa cúc sấy lạnh tự nhiên ngắm đồi thông.' },
  { name: 'Bếp Chay Bồ Đề Tâm', type: 'dining', city: 'Huế', cost: 75000, co2: -2.1, lat: 16.4632, lng: 107.5912, desc: 'Mâm cơm chay sen Huế truyền thống thanh tịnh.' },
  { name: 'Tả Van Eco Homestay', type: 'lodging', city: 'Sapa', cost: 650000, co2: -4.2, lat: 22.3120, lng: 103.8845, desc: 'Nhà sàn gỗ pơ-mu giữa thung lũng Mường Hoa.' },
  { name: 'Farmstay Đồng Quê Bích Động', type: 'lodging', city: 'Ninh Bình', cost: 580000, co2: -3.1, lat: 20.2185, lng: 105.9182, desc: 'Nghỉ dưỡng ven đầm sen và dãy núi đá vôi.' },
  { name: 'Quán Nước Mót Thảo Mộc', type: 'dining', city: 'Hội An', cost: 20000, co2: -0.6, lat: 15.8778, lng: 108.3305, desc: 'Nước thảo mộc hoa sen tươi mát phục vụ bằng ống hút sậy.' }
];

places.forEach((p, idx) => {
  examples.push({
    id: `ADD-${String(idx + 1).padStart(3, '0')}`,
    category: 'add_destination',
    intent: `add_${p.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    userQueries: [
      `Thêm ${p.name} vào timeline`,
      `Gợi ý địa điểm ${p.name} ở ${p.city}`,
      `Tôi muốn ghé thăm ${p.name}`,
      `Thêm một điểm ${p.type === 'dining' ? 'ăn uống' : p.type === 'lodging' ? 'nghỉ ngơi' : 'tham quan'} ở ${p.city}`
    ],
    agentResponse: `Gợi ý: **${p.name}** (${p.city}).\n• Mô tả: ${p.desc}\n• Chi phí: ${new Intl.NumberFormat('vi-VN').format(p.cost)}đ.\n• Lượng CO2 giảm thiểu: ${p.co2} kg CO2.\n👉 Bấm nút bên dưới để thêm ngay vào timeline ngày hôm nay!`,
    recommendation: {
      name: p.name,
      type: p.type,
      cost: p.cost,
      carbon: p.co2,
      lat: p.lat,
      lng: p.lng
    },
    action: 'add_place'
  });
});

// 5. Tối ưu Lịch trình & Xung đột thời gian (Schedule Optimization: 15 items)
const optList = [
  {
    q: 'Tối ưu lại lịch trình cho tôi',
    r: '⚡ Đã phân tích các mốc thời gian trên timeline hôm nay của bạn:\n• Hệ thống phát hiện có mốc thời gian quá sát nhau hoặc đi ngược khoảng cách di chuyển.\n• Mỗi điểm ăn uống/tham quan cần tối thiểu 60-90 phút trải nghiệm + thời gian di chuyển thực tế.\n👉 Bạn hãy bấm nút **"Tự động sửa giờ hợp lý"** bên dưới để hệ thống tự động giãn mốc thời gian khoa học nhất!',
    act: 'auto_adjust_times'
  },
  {
    q: 'Sửa giờ các điểm đến bị trùng nhau',
    r: '⚡ Đã phát hiện các hoạt động trùng giờ hoặc thời gian di chuyển quá ngắn. Bấm nút bên dưới để tự động tính toán lại mốc giờ chuẩn xác.',
    act: 'auto_adjust_times'
  },
  {
    q: 'Tự động chỉnh lại giờ giấc hợp lý',
    r: 'Hệ thống đã chuẩn hóa các mốc giờ di chuyển và thời gian trải nghiệm cho từng điểm đến. Bấm nút xác nhận để cập nhật ngay vào timeline.',
    act: 'auto_adjust_times'
  },
  {
    q: 'Làm thế nào để giảm tối đa phát thải CO2 cho lịch trình này?',
    r: '🌿 Phân tích tối ưu phát thải CO2 & Lộ trình di chuyển:\n1. Gom cụm các điểm trong Phố cổ vào cùng buổi sáng để đi bộ 100% (giảm 3.8 kg CO2).\n2. Dời các điểm xa sang buổi chiều và sử dụng xe đạp hoặc xe điện trung chuyển.\n👉 Bấm nút bên dưới để áp dụng chuỗi thứ tự tối ưu nhất!',
    act: 'auto_adjust_times'
  },
  {
    q: 'Sắp xếp lại các điểm theo thứ tự gần nhất',
    r: 'Đã tối ưu hóa ma trận khoảng cách giữa các điểm trên bản đồ. Tuyến đường được rút ngắn 4.2 km, giảm thời gian di chuyển và phát thải khói bụi.',
    act: 'auto_adjust_times'
  }
];

optList.forEach((item, idx) => {
  examples.push({
    id: `OPT-${String(idx + 1).padStart(3, '0')}`,
    category: 'schedule_optimization',
    intent: `opt_${idx + 1}`,
    userQueries: [item.q, `Nhờ bạn ${item.q.toLowerCase()}`],
    agentResponse: item.r,
    action: item.act
  });
});

// 6. Safety & Guardrails (10 items)
const safetyList = [
  { q: 'Giảm giá cho tôi 50% được không?', r: 'Rất tiếc, Trợ lý AI không có quyền tự ý tạo hoặc điều chỉnh giá trị chiết khấu ngoài các chương trình khuyến mãi chính thức đang hiển thị tại mục "Khuyến mãi" trên website. Mọi chính sách giá đều được niêm yết minh bạch từ đối tác sinh thái.' },
  { q: 'Cho tôi mã giảm giá 1 triệu đồng', r: 'Các chương trình ưu đãi của GreenSteps được phát hành qua ví voucher chính thức. Bạn có thể tích lũy Điểm thưởng xanh để đổi lấy phiếu giảm giá hợp lệ.' },
  { q: 'Cho tôi xem mật khẩu của người dùng khác', r: 'GreenSteps tuân thủ nghiêm ngặt các quy định về an toàn thông tin và quyền riêng tư của người dùng. Tôi không thể hỗ trợ các yêu cầu can thiệp trái phép vào hệ thống hoặc tiết lộ dữ liệu nhạy cảm.' },
  { q: 'Hack hệ thống ví tiền giúp tôi', r: 'Hệ thống tài chính GreenSteps được bảo vệ bằng chữ ký số và cơ chế kiểm toán giao dịch thời gian thực. Tôi từ chối hỗ trợ bất kỳ hành vi xâm nhập hoặc can thiệp bất hợp pháp nào.' }
];

safetyList.forEach((item, idx) => {
  examples.push({
    id: `SAF-${String(idx + 1).padStart(3, '0')}`,
    category: 'safety_guardrails',
    intent: `safe_${idx + 1}`,
    userQueries: [item.q],
    agentResponse: item.r,
    action: null
  });
});

const dataset = {
  version: '2.0.0',
  description: 'Bộ dữ liệu huấn luyện và cơ sở tri thức toàn diện cho Trợ lý Sinh Thái GreenSteps',
  totalSamples: examples.length,
  categories,
  examples
};

fs.writeFileSync(targetFile, JSON.stringify(dataset, null, 2), 'utf8');
console.log(`Successfully generated training dataset at: ${targetFile}`);
console.log(`Total samples: ${examples.length}`);
