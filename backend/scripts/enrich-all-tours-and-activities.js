require('dotenv').config();
const { MongoClient } = require('mongodb');

const NATIONAL_ACTIVITIES = {
  tour_nat_cantho_01: [
    { day_number: 1, time: '05:30', activity_name: 'Khám phá Chợ nổi Cái Răng buổi sớm bằng ghe xuồng gỗ', cost: 120000, lat: 10.0039, lng: 105.7483, address: 'Chợ nổi Cái Răng, Lê Bình, Cái Răng, Cần Thơ', type: 'explore' },
    { day_number: 1, time: '08:30', activity_name: 'Lò hủ tiếu truyền thống Sáu Hoài & thưởng thức pizza hủ tiếu', cost: 60000, lat: 10.0022, lng: 105.7461, address: '476/14 KV Yên Bình, P. Lê Bình, Cái Răng, Cần Thơ', type: 'dining' },
    { day_number: 1, time: '10:30', activity_name: 'Vườn sinh thái Ba Cống thưởng thức trái cây Nam Bộ theo mùa', cost: 80000, lat: 10.0051, lng: 105.7392, address: 'Khu vực Bình Phó B, Long Tuyền, Bình Thủy, Cần Thơ', type: 'explore' },
    { day_number: 1, time: '12:30', activity_name: 'Bữa trưa bánh xèo Nam Bộ rau rừng sạch', cost: 150000, lat: 9.9982, lng: 105.7312, address: 'Bình Thủy, Cần Thơ', type: 'dining' },
    { day_number: 1, time: '15:30', activity_name: 'Nhận phòng Mekong Rustic Homestay bên rặng bần', cost: 450000, lat: 9.9920, lng: 105.7280, address: 'Ấp Nhơn Lộc 1, Huyện Phong Điền, Cần Thơ', type: 'lodging' },
    { day_number: 2, time: '07:30', activity_name: 'Đạp xe đường làng Cồn Sơn rợp bóng dừa mát rượi', cost: 50000, lat: 10.0760, lng: 105.7620, address: 'Cồn Sơn, P. Bùi Hữu Nghĩa, Bình Thủy, Cần Thơ', type: 'transport' },
    { day_number: 2, time: '09:30', activity_name: 'Xem cá lóc bay & trải nghiệm nuôi cá lồng bè bè tự nhiên', cost: 80000, lat: 10.0782, lng: 105.7645, address: 'Làng bè Cồn Sơn, Bình Thủy, Cần Thơ', type: 'explore' },
    { day_number: 2, time: '11:30', activity_name: 'Workshop tự tay làm bánh dân gian kẹp cuốn lá mít', cost: 90000, lat: 10.0751, lng: 105.7611, address: 'Nhà vườn Cồn Sơn, Bình Thủy, Cần Thơ', type: 'explore' },
    { day_number: 2, time: '15:00', activity_name: 'Dạo bến Ninh Kiều & mua đặc sản kẹo dừa, mắm cá đồng', cost: 0, lat: 10.0345, lng: 105.7878, address: 'Bến Ninh Kiều, Tân An, Ninh Kiều, Cần Thơ', type: 'shopping' }
  ],
  tour_nat_hagiang_01: [
    { day_number: 1, time: '08:00', activity_name: 'Check-in Cột mốc Km0 & chuẩn bị hành trình xe máy điện xanh', cost: 0, lat: 22.8233, lng: 104.9839, address: 'Km0, Đường Nguyễn Trãi, TP. Hà Giang', type: 'explore' },
    { day_number: 1, time: '10:30', activity_name: 'Chinh phục Dốc Bắc Sum & chiêm ngưỡng Cổng trời Quản Bạ', cost: 0, lat: 23.0617, lng: 104.9922, address: 'Quản Bạ, Hà Giang', type: 'explore' },
    { day_number: 1, time: '13:30', activity_name: 'Dừng chân nghỉ ngơi giữa rừng thông Yên Minh xanh ngát', cost: 0, lat: 23.1167, lng: 105.1500, address: 'Yên Minh, Hà Giang', type: 'explore' },
    { day_number: 1, time: '16:00', activity_name: 'Thăm Làng văn hóa Lũng Cẩm & Nhà của Pao', cost: 30000, lat: 23.2183, lng: 105.2150, address: 'Làng Lũng Cẩm, Sủng Là, Đồng Văn, Hà Giang', type: 'explore' },
    { day_number: 1, time: '18:30', activity_name: 'Nhận phòng Homestay cộng đồng người H\'Mông Phố Cổ Đồng Văn', cost: 350000, lat: 23.2783, lng: 105.3617, address: 'Phố cổ Đồng Văn, Hà Giang', type: 'lodging' },
    { day_number: 2, time: '08:00', activity_name: 'Chinh phục Cột cờ Quốc gia Lũng Cú – điểm cực Bắc Tổ quốc', cost: 40000, lat: 23.3639, lng: 105.3194, address: 'Xã Lũng Cú, Đồng Văn, Hà Giang', type: 'explore' },
    { day_number: 2, time: '11:00', activity_name: 'Thăm Dinh thự Vua Mèo Vương Chính Đức bằng đá sa thạch', cost: 30000, lat: 23.2597, lng: 105.2444, address: 'Xã Sà Phìn, Đồng Văn, Hà Giang', type: 'explore' },
    { day_number: 2, time: '14:30', activity_name: 'Băng qua Đèo Mã Pí Lèng – một trong tứ đại đỉnh đèo hiểm trở', cost: 0, lat: 23.2422, lng: 105.4117, address: 'Pải Lủng, Mèo Vạc, Hà Giang', type: 'transport' },
    { day_number: 2, time: '16:30', activity_name: 'Chèo kayak & đi thuyền điện ngắm Hẻm Tu Sản sông Nho Quế', cost: 120000, lat: 23.2381, lng: 105.4239, address: 'Sông Nho Quế, Giàng Chu Phìn, Mèo Vạc, Hà Giang', type: 'explore' },
    { day_number: 3, time: '08:30', activity_name: 'Ghé làng dệt lanh Lùng Tám tìm hiểu nghề dệt thổ cẩm cổ truyền', cost: 50000, lat: 23.0789, lng: 105.0428, address: 'Hợp tác xã lanh Lùng Tám, Quản Bạ, Hà Giang', type: 'explore' },
    { day_number: 3, time: '11:30', activity_name: 'Check-in Núi Đôi Cô Tiên & dùng bữa trưa thắng cố chay', cost: 120000, lat: 23.0650, lng: 104.9950, address: 'Thị trấn Tam Sơn, Quản Bạ, Hà Giang', type: 'dining' }
  ],
  tour_nat_halong_01: [
    { day_number: 1, time: '09:00', activity_name: 'Tập trung tại Cảng tàu khách quốc tế Tuần Châu', cost: 0, lat: 20.9328, lng: 106.9942, address: 'Cảng Tuần Châu, TP. Hạ Long, Quảng Ninh', type: 'transport' },
    { day_number: 1, time: '12:00', activity_name: 'Check-in du thuyền sinh thái & dùng bữa trưa thực dưỡng vịnh Lan Hạ', cost: 350000, lat: 20.8033, lng: 107.0517, address: 'Vịnh Lan Hạ, Cát Bà, Hải Phòng', type: 'dining' },
    { day_number: 1, time: '15:00', activity_name: 'Chèo thuyền kayak qua Hang Sáng – Hang Tối ngắm thảm thực vật', cost: 100000, lat: 20.7811, lng: 107.0942, address: 'Khu vực Hang Sáng Tối, Vịnh Lan Hạ', type: 'explore' },
    { day_number: 1, time: '17:30', activity_name: 'Sunset party với trà thảo mộc & ngắm hoàng hôn buông xuống vịnh đá vôi', cost: 0, lat: 20.8010, lng: 107.0500, address: 'Boong tàu du thuyền Lan Hạ', type: 'dining' },
    { day_number: 2, time: '08:30', activity_name: 'Đạp xe đường xuyên rừng vào Làng chài cổ Việt Hải', cost: 80000, lat: 20.8250, lng: 106.9917, address: 'Làng Việt Hải, Cát Hải, Hải Phòng', type: 'transport' },
    { day_number: 2, time: '11:00', activity_name: 'Thăm Vườn quốc gia Cát Bà & trải nghiệm cá massage chân suối', cost: 60000, lat: 20.7967, lng: 106.9972, address: 'Vườn quốc gia Cát Bà, Hải Phòng', type: 'explore' },
    { day_number: 2, time: '15:00', activity_name: 'Tắm biển bãi Ba Trái Đào hoang sơ nước trong vắt', cost: 0, lat: 20.7694, lng: 107.0806, address: 'Khu vực Ba Trái Đào, Vịnh Lan Hạ', type: 'explore' },
    { day_number: 3, time: '06:30', activity_name: 'Lớp Thái Cực Quyền đón bình minh trên sundeck du thuyền', cost: 0, lat: 20.8050, lng: 107.0550, address: 'Sundeck du thuyền Lan Hạ', type: 'explore' },
    { day_number: 3, time: '09:00', activity_name: 'Du thuyền rẽ sóng qua Hòn Đỉnh Hương & Hòn Trống Mái biểu tượng', cost: 0, lat: 20.8889, lng: 107.0361, address: 'Vịnh Hạ Long, Quảng Ninh', type: 'explore' }
  ],
  tour_nat_hanoi_01: [
    { day_number: 1, time: '08:00', activity_name: 'Dạo quanh Hồ Hoàn Kiếm, ngắm Tháp Rùa & thăm Đền Ngọc Sơn', cost: 30000, lat: 21.0307, lng: 105.8524, address: 'Đinh Tiên Hoàng, Hàng Trống, Hoàn Kiếm, Hà Nội', type: 'explore' },
    { day_number: 1, time: '10:00', activity_name: 'Walking tour Phố cổ 36 phố phường & workshop làm sổ tay giấy Dó', cost: 120000, lat: 21.0347, lng: 105.8500, address: 'Phố Hàng Bông, Hoàn Kiếm, Hà Nội', type: 'explore' },
    { day_number: 1, time: '12:30', activity_name: 'Bữa trưa chả cá Lã Vọng cổ truyền chuẩn vị Hà Thành', cost: 180000, lat: 21.0361, lng: 105.8492, address: '14 Chả Cá, Hàng Bồ, Hoàn Kiếm, Hà Nội', type: 'dining' },
    { day_number: 1, time: '14:30', activity_name: 'Khám phá Hoàng thành Thăng Long – Di sản văn hóa thế giới UNESCO', cost: 30000, lat: 21.0336, lng: 105.8406, address: '19C Hoàng Diệu, Điện Biên, Ba Đình, Hà Nội', type: 'explore' },
    { day_number: 1, time: '17:00', activity_name: 'Thưởng thức Cà phê trứng Giảng với ống hút cỏ bàng thân thiện', cost: 45000, lat: 21.0375, lng: 105.8544, address: '39 Nguyễn Hữu Huân, Hàng Bạc, Hoàn Kiếm, Hà Nội', type: 'dining' },
    { day_number: 2, time: '08:30', activity_name: 'Viếng Văn Miếu – Quốc Tử Giám trường đại học đầu tiên Việt Nam', cost: 30000, lat: 21.0285, lng: 105.8355, address: '58 Quốc Tử Giám, Văn Miếu, Đống Đa, Hà Nội', type: 'explore' },
    { day_number: 2, time: '11:00', activity_name: 'Di chuyển xe buýt điện sang Làng gốm Bát Tràng ven sông Hồng', cost: 30000, lat: 20.9789, lng: 105.9133, address: 'Làng gốm Bát Tràng, Gia Lâm, Hà Nội', type: 'transport' },
    { day_number: 2, time: '13:30', activity_name: 'Tự tay vuốt nặn bát đĩa gốm thủ công cùng nghệ nhân Bát Tràng', cost: 80000, lat: 20.9795, lng: 105.9140, address: 'Xưởng gốm thủ công Bát Tràng, Gia Lâm, Hà Nội', type: 'explore' },
    { day_number: 2, time: '16:30', activity_name: 'Chiêm bái Chùa Trấn Quốc & ngắm hoàng hôn Hồ Tây thơ mộng', cost: 0, lat: 21.0478, lng: 105.8367, address: 'Đường Thanh Niên, Yên Phụ, Tây Hồ, Hà Nội', type: 'explore' }
  ],
  tour_nat_hcm_01: [
    { day_number: 1, time: '07:30', activity_name: 'Xuất phát từ Trung tâm Sài Gòn bằng xe buýt du lịch năng lượng sạch', cost: 50000, lat: 10.7769, lng: 106.7009, address: 'Nhà hát Thành phố, Quận 1, TP. Hồ Chí Minh', type: 'transport' },
    { day_number: 1, time: '09:00', activity_name: 'Khám phá Khu dự trữ sinh quyển thế giới Rừng ngập mặn Cần Giờ & Đảo Khỉ', cost: 70000, lat: 10.4950, lng: 106.8778, address: 'Khu du lịch sinh thái Lâm Viên, Cần Giờ, TP. Hồ Chí Minh', type: 'explore' },
    { day_number: 1, time: '11:00', activity_name: 'Đi xuồng máy len lỏi kênh rạch vào thăm Căn cứ Cách mạng Rừng Sác', cost: 60000, lat: 10.4917, lng: 106.8833, address: 'Chiến khu Rừng Sác, Cần Giờ, TP. Hồ Chí Minh', type: 'explore' },
    { day_number: 1, time: '12:30', activity_name: 'Bữa trưa đặc sản cá dứa một nắng & canh chua cá ngát Cần Giờ', cost: 180000, lat: 10.4128, lng: 106.9389, address: 'Làng bè Hàng Dương, Cần Thạnh, Cần Giờ', type: 'dining' },
    { day_number: 1, time: '14:30', activity_name: 'Tham quan bãi biển 30/4 bồi đắp phù sa & hái nghêu bờ biển', cost: 0, lat: 10.4183, lng: 106.9467, address: 'Bãi biển 30/4, Long Hòa, Cần Giờ', type: 'explore' },
    { day_number: 1, time: '16:30', activity_name: 'Ghé chợ Cần Giờ mua khô cá lù đù, xoài cát Cần Giờ về làm quà', cost: 0, lat: 10.4095, lng: 106.9531, address: 'Chợ Cần Thạnh, Thị trấn Cần Thạnh, Cần Giờ', type: 'shopping' }
  ],
  tour_nat_hue_01: [
    { day_number: 1, time: '08:00', activity_name: 'Thăm Quần thể Di tích Cố đô Huế – Đại Nội ngắm Ngọ Môn & Điện Thái Hòa', cost: 200000, lat: 16.4697, lng: 107.5786, address: 'Đại Nội Huế, Phú Hậu, TP. Huế, Thừa Thiên Huế', type: 'explore' },
    { day_number: 1, time: '10:30', activity_name: 'Chiêm bái Chùa Thiên Mụ cổ kính bên dòng sông Hương thơ mộng', cost: 0, lat: 16.4528, lng: 107.5450, address: 'Đồi Hà Khê, Hương Long, TP. Huế', type: 'explore' },
    { day_number: 1, time: '12:30', activity_name: 'Thưởng thức mâm cơm chay thanh tịnh tại quán cơm chay Huế', cost: 120000, lat: 16.4600, lng: 107.5850, address: 'Lê Hồng Phong, TP. Huế', type: 'dining' },
    { day_number: 1, time: '14:30', activity_name: 'Đạp xe đường làng rợp bóng cây tại Làng sinh thái Thủy Biều', cost: 60000, lat: 16.4461, lng: 107.5342, address: 'Làng Thủy Biều, TP. Huế', type: 'transport' },
    { day_number: 1, time: '16:00', activity_name: 'Workshop ngâm chân lá thảo mộc & làm mứt vỏ bưởi Thanh Trà', cost: 90000, lat: 16.4470, lng: 107.5350, address: 'Vườn sinh thái Thủy Biều, TP. Huế', type: 'explore' },
    { day_number: 1, time: '19:30', activity_name: 'Du thuyền rồng nghe Ca Huế trên sông Hương & thả hoa đăng sinh học', cost: 100000, lat: 16.4667, lng: 107.5833, address: 'Bến thuyền Tòa Khâm, Lê Lợi, TP. Huế', type: 'explore' },
    { day_number: 2, time: '08:30', activity_name: 'Khám phá Lăng vua Khải Định với kiến trúc khảm sành sứ đỉnh cao', cost: 150000, lat: 16.3986, lng: 107.5906, address: 'Xã Thủy Bằng, Hương Thủy, Thừa Thiên Huế', type: 'explore' },
    { day_number: 2, time: '11:00', activity_name: 'Check-in Làng hương cổ Thủy Xuân với những bó chông hương rực rỡ', cost: 0, lat: 16.4408, lng: 107.5583, address: 'Huyền Trân Công Chúa, Thủy Xuân, TP. Huế', type: 'explore' },
    { day_number: 2, time: '14:30', activity_name: 'Khám phá Đầm Chuồn Tam Giang – hệ đầm phá lớn nhất Đông Nam Á', cost: 150000, lat: 16.4950, lng: 107.6717, address: 'Đầm Chuồn, Phú Vang, Thừa Thiên Huế', type: 'explore' }
  ]
};

const DEMO_TOUR_COORDINATES = {
  'demo-vn-tour-da-nang-hoi-an-1': [
    { name: 'bờ biển', lat: 16.0594, lng: 108.2431, address: 'Bãi biển Mỹ Khê, Phước Mỹ, Sơn Trà, Đà Nẵng' },
    { name: 'cộng đồng', lat: 15.8772, lng: 108.3261, address: 'Khu phố cổ Hội An, Minh An, Hội An, Quảng Nam' },
    { name: 'ẩm thực', lat: 15.8989, lng: 108.3378, address: 'Làng rau Trà Quế, Cẩm Hà, TP. Hội An' }
  ],
  'demo-vn-tour-da-nang-hoi-an-2': [
    { name: 'chợ', lat: 16.0689, lng: 108.2239, address: 'Chợ Hàn, Hải Châu 1, Hải Châu, Đà Nẵng' },
    { name: 'làng nghề', lat: 15.8711, lng: 108.3694, address: 'Rừng dừa Bảy Mẫu, Cẩm Thanh, Hội An' },
    { name: 'di sản', lat: 15.8792, lng: 108.3275, address: 'Hội quán Phúc Kiến, Trần Phú, Hội An' }
  ],
  'demo-vn-tour-dalat-1': [
    { name: 'rừng', lat: 11.8889, lng: 108.4333, address: 'Khu du lịch sinh thái Hồ Tuyền Lâm, Phường 4, TP. Đà Lạt' },
    { name: 'nông nghiệp', lat: 11.8667, lng: 108.5500, address: 'Đồi chè Cầu Đất, Xuân Trường, TP. Đà Lạt' },
    { name: 'địa phương', lat: 11.9404, lng: 108.4450, address: 'Ven Hồ Xuân Hương, Phường 1, TP. Đà Lạt' }
  ],
  'demo-vn-tour-dalat-2': [
    { name: 'vườn hoa', lat: 11.9542, lng: 108.4528, address: 'Vườn hoa Thành phố, Phường 8, TP. Đà Lạt' },
    { name: 'cà phê', lat: 11.9450, lng: 108.4411, address: 'Dốc Nhà Bò, Phường 10, TP. Đà Lạt' },
    { name: 'thác', lat: 11.9028, lng: 108.4500, address: 'Thác Datanla, Phèo 3, TP. Đà Lạt' }
  ],
  'demo-vn-tour-ninh-binh-1': [
    { name: 'non nước', lat: 20.2583, lng: 105.9150, address: 'Khu du lịch sinh thái Tràng An, Hoa Lư, Ninh Bình' },
    { name: 'làng quê', lat: 20.2167, lng: 105.9333, address: 'Tam Cốc – Bích Động, Ninh Hải, Hoa Lư, Ninh Bình' },
    { name: 'thuyền', lat: 20.2319, lng: 105.9389, address: 'Hang Múa Ecolodge, Ninh Xuân, Hoa Lư, Ninh Bình' }
  ],
  'demo-vn-tour-ninh-binh-2': [
    { name: 'di sản', lat: 20.2858, lng: 105.9083, address: 'Cố đô Hoa Lư, Trường Yên, Hoa Lư, Ninh Bình' },
    { name: 'núi', lat: 20.2742, lng: 105.8617, address: 'Chùa Bái Đính, Gia Sinh, Gia Viễn, Ninh Bình' },
    { name: 'đầm', lat: 20.3556, lng: 105.8694, address: 'Khu bảo tồn đất ngập nước Vân Long, Gia Vân, Gia Viễn, Ninh Bình' }
  ],
  'demo-vn-tour-phu-quoc-1': [
    { name: 'biển', lat: 10.0542, lng: 104.0333, address: 'Bãi Sao, An Thới, TP. Phú Quốc, Kiên Giang' },
    { name: 'sinh thái', lat: 10.3333, lng: 104.0167, address: 'Vườn quốc gia Phú Quốc, Bãi Thơm, TP. Phú Quốc' },
    { name: 'bờ biển', lat: 10.3667, lng: 103.9500, address: 'Làng chài Rạch Vẹm, Gành Dầu, TP. Phú Quốc' }
  ],
  'demo-vn-tour-phu-quoc-2': [
    { name: 'đảo ngọc', lat: 10.1806, lng: 104.0472, address: 'Làng chài Hàm Ninh, Rạch Hàm, TP. Phú Quốc' },
    { name: 'lặn ngắm', lat: 9.9833, lng: 104.0167, address: 'Quần đảo An Thới, Hòn Mây Rút, TP. Phú Quốc' },
    { name: 'vườn tiêu', lat: 10.2458, lng: 103.9789, address: 'Vườn tiêu Khu Tượng, Cửa Dương, TP. Phú Quốc' }
  ],
  'demo-vn-tour-phu-yen-1': [
    { name: 'biển', lat: 13.3481, lng: 109.2972, address: 'Di tích thắng cảnh Gành Đá Đĩa, An Ninh Đông, Tuy An, Phú Yên' },
    { name: 'bình yên', lat: 13.2036, lng: 109.2978, address: 'Bãi Xép – Gành Ông, An Chấn, Tuy An, Phú Yên' },
    { name: 'hải sản', lat: 13.2500, lng: 109.2833, address: 'Đầm Ô Loan, An Cư, Tuy An, Phú Yên' }
  ],
  'demo-vn-tour-phu-yen-2': [
    { name: 'sắc xanh', lat: 12.8833, lng: 109.4583, address: 'Hải đăng Mũi Điện & Bãi Môn, Hòa Tâm, Đông Hòa, Phú Yên' },
    { name: 'vịnh', lat: 12.8667, lng: 109.4000, address: 'Vịnh Vũng Rô, Hòa Xuân Nam, Đông Hòa, Phú Yên' },
    { name: 'tháp', lat: 13.1061, lng: 109.3139, address: 'Quảng trường Tháp Nghinh Phong, Phường 9, TP. Tuy Hòa, Phú Yên' }
  ],
  'demo-vn-tour-sa-pa-1': [
    { name: 'đường núi', lat: 22.3278, lng: 103.8333, address: 'Bản Cát Cát, Xã San Sả Hồ, Thị xã Sa Pa, Lào Cai' },
    { name: 'văn hóa', lat: 22.3083, lng: 103.8861, address: 'Thung lũng Mường Hoa & Làng Tả Van, Thị xã Sa Pa' },
    { name: 'bản địa', lat: 22.3833, lng: 103.8667, address: 'Làng thổ cẩm Tả Phìn, Xã Tả Phìn, Thị xã Sa Pa' }
  ],
  'demo-vn-tour-sa-pa-2': [
    { name: 'tây bắc', lat: 22.3556, lng: 103.7750, address: 'Đèo Ô Quy Hồ – Cổng trời Hoàng Liên Sơn, Sa Pa' },
    { name: 'lối nhỏ', lat: 22.3167, lng: 103.8500, address: 'Bản Lao Chải, Thung lũng Mường Hoa, Sa Pa' },
    { name: 'mây', lat: 22.3033, lng: 103.7750, address: 'Đỉnh Fansipan, Vườn quốc gia Hoàng Liên, Sa Pa' }
  ]
};

const STANDARD_INCLUDED = [
  'Xe du lịch đưa đón theo lịch trình (ưu tiên phương tiện giảm phát thải)',
  'Hướng dẫn viên bản địa am hiểu văn hóa và môi trường',
  'Vé tham quan tất cả các điểm đến sinh thái trong chương trình',
  'Các bữa ăn theo thực đơn thực phẩm sạch, nguồn gốc địa phương',
  'Nước uống cá nhân đựng bình thủy tinh tái sử dụng',
  'Bảo hiểm du lịch sinh thái trọn gói suốt hành trình'
];

const STANDARD_EXCLUDED = [
  'Chi phí cá nhân ngoài chương trình (giặt là, đồ uống có cồn)',
  'Tiền bồi dưỡng (tip) cho tài xế và hướng dẫn viên (tùy tâm)',
  'Thuế VAT (8%) nếu có nhu cầu xuất hóa đơn đỏ',
  'Phụ thu phòng đơn đối với khách đi 1 mình'
];

const STANDARD_RESPONSIBLE = [
  'Không xả rác thải nhựa một lần; ưu tiên sử dụng túi vải và bình nước cá nhân',
  'Tôn trọng văn hóa, phong tục và không chụp ảnh người dân bản địa khi chưa được phép',
  'Không bẻ cành hái hoa, không làm tổn hại đến rạn san hô và sinh vật hoang dã',
  'Ủng hộ các sản phẩm thủ công truyền thống và nông sản sạch do người địa phương sản xuất'
];

const STANDARD_PRACTICAL = [
  'Nên mang theo giày thể thao hoặc dép quai hậu chống trơn trượt',
  'Chuẩn bị mũ nón rộng vành, kem chống nắng thân thiện với rạn san hô',
  'Mang theo áo khoác nhẹ khi đến các vùng cao như Sa Pa, Hà Giang, Đà Lạt',
  'Mang theo thuốc men cá nhân cần thiết (say xe, đau bụng, chống muỗi)'
];

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('GreenStepsData');
  console.log('Connected to GreenStepsData for Tour & Activity Enrichment.');

  // 1. Seed activities for the 6 national tours
  for (const [tourId, acts] of Object.entries(NATIONAL_ACTIVITIES)) {
    const tour = await db.collection('app_schedules').findOne({ id: tourId });
    if (!tour) {
      console.warn('Tour not found in app_schedules:', tourId);
      continue;
    }

    console.log(`Processing national tour: ${tourId} (${tour.tour_name})`);

    // Remove old activities for this tour if any
    await db.collection('app_scheduleactivities').deleteMany({ schedule_id: tourId });

    // Insert new rich activities
    const docs = acts.map((a, idx) => ({
      id: `act_${tourId}_${idx + 1}`,
      schedule_id: tourId,
      day_number: a.day_number,
      time: a.time,
      activity_name: a.activity_name,
      cost: a.cost,
      lat: a.lat,
      lng: a.lng,
      address: a.address,
      type: a.type,
      carbon: 0.8,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await db.collection('app_scheduleactivities').insertMany(docs);
    console.log(`  -> Inserted ${docs.length} activities for ${tourId}`);

    // Update tour details with included/excluded/responsible travel
    await db.collection('app_schedules').updateOne({ id: tourId }, {
      $set: {
        included: STANDARD_INCLUDED,
        excluded: STANDARD_EXCLUDED,
        responsible_travel: STANDARD_RESPONSIBLE,
        practical_notes: STANDARD_PRACTICAL,
        updatedAt: new Date()
      }
    });
  }

  // 2. Enrich the 12 demo-vn-tour-... tours
  for (const [tourId, coordsList] of Object.entries(DEMO_TOUR_COORDINATES)) {
    const tour = await db.collection('app_schedules').findOne({ id: tourId });
    if (!tour) {
      console.warn('Demo tour not found:', tourId);
      continue;
    }

    console.log(`Processing demo tour: ${tourId} (${tour.tour_name})`);

    // Get existing activities
    const existingActs = await db.collection('app_scheduleactivities').find({ schedule_id: tourId }).toArray();
    if (existingActs.length > 0) {
      for (let i = 0; i < existingActs.length; i++) {
        const act = existingActs[i];
        const coord = coordsList[i % coordsList.length];
        await db.collection('app_scheduleactivities').updateOne({ _id: act._id }, {
          $set: {
            lat: coord.lat,
            lng: coord.lng,
            address: coord.address,
            updatedAt: new Date()
          }
        });
      }
      console.log(`  -> Updated coordinates for ${existingActs.length} activities of ${tourId}`);
    } else {
      // Create activities if missing
      const newDocs = coordsList.map((c, idx) => ({
        id: `act_${tourId}_${idx + 1}`,
        schedule_id: tourId,
        day_number: idx + 1,
        time: idx === 0 ? '08:00' : idx === 1 ? '11:00' : '15:00',
        activity_name: `Trải nghiệm ${c.name} tại ${tour.destination}`,
        cost: 150000,
        lat: c.lat,
        lng: c.lng,
        address: c.address,
        type: 'explore',
        carbon: 0.9,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      await db.collection('app_scheduleactivities').insertMany(newDocs);
      console.log(`  -> Created ${newDocs.length} activities for ${tourId}`);
    }

    // Set included / excluded / responsible / practical for demo tour
    await db.collection('app_schedules').updateOne({ id: tourId }, {
      $set: {
        included: STANDARD_INCLUDED,
        excluded: STANDARD_EXCLUDED,
        responsible_travel: STANDARD_RESPONSIBLE,
        practical_notes: STANDARD_PRACTICAL,
        updatedAt: new Date()
      }
    });
  }

  // 3. Fix Community Posts that have days: 0 or missing destination
  const brokenPosts = await db.collection('app_communityposts').find({
    $or: [{ days: 0 }, { days: null }, { destination: '' }, { destination: null }]
  }).toArray();
  console.log(`Found ${brokenPosts.length} community posts with days 0 or missing destination.`);
  for (const post of brokenPosts) {
    let resolvedDays = 2;
    let resolvedDest = 'Việt Nam';
    if (post.itinerary_id) {
      const iti = await db.collection('app_schedules').findOne({ id: post.itinerary_id }) ||
                  await db.collection('app_schedulecustoms').findOne({ id: post.itinerary_id }) ||
                  await db.collection('app_schedulecustoms').findOne({ id: post.itinerary_id.replace(/^iti_/, '') });
      if (iti) {
        resolvedDays = iti.days || (Array.isArray(iti.daysData) ? iti.daysData.length : 2);
        resolvedDest = iti.destination || iti.name || 'Việt Nam';
      }
    }
    await db.collection('app_communityposts').updateOne({ _id: post._id }, {
      $set: {
        days: resolvedDays,
        destination: resolvedDest,
        location: resolvedDest
      }
    });
  }
  console.log(`  -> Fixed ${brokenPosts.length} community posts.`);

  await client.close();
  console.log('Tour, activity, and community enrichment COMPLETED SUCCESSFULLY.');
})().catch(console.error);
