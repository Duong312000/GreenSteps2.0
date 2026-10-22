require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const {
  User,
  Provider,
  Service,
  Schedule,
  Booking,
  Review,
  CommunityPost,
  Voucher,
  Badge,
  SystemConfig,
  Notification
} = require('../models');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsData';

async function seedData() {
  try {
    console.log('🌱 Đang kết nối tới MongoDB:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công!');

    console.log('🧹 Đang làm sạch dữ liệu cũ...');
    await Promise.all([
      User.deleteMany({}),
      Provider.deleteMany({}),
      Service.deleteMany({}),
      Schedule.deleteMany({}),
      Booking.deleteMany({}),
      Review.deleteMany({}),
      CommunityPost.deleteMany({}),
      Voucher.deleteMany({}),
      Badge.deleteMany({}),
      SystemConfig.deleteMany({}),
      Notification.deleteMany({})
    ]);
    console.log('✅ Đã dọn dẹp các collection.');

    // 1. Tạo Mật Khẩu Hash
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const partnerPassword = await bcrypt.hash('partner123', salt);
    const travelerPassword = await bcrypt.hash('traveler123', salt);

    // 2. Tạo Users (Theo User schema chuẩn)
    console.log('👤 Đang tạo Users...');
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@greensteps.vn',
      password_hash: adminPassword,
      profile: {
        fullname: 'Quản trị viên GreenSteps',
        phone: '0901234567',
        gender: 'Nam',
        address: 'Tòa nhà Innovation, TP. Hồ Chí Minh',
        job: 'Hệ thống Quản trị viên',
        avatarUrl: '/images/users/admin.jpg'
      },
      roles: ['admin'],
      status: 'active',
      verified: true,
      wallet: {
        balance: 10000000,
        green_points: 1500,
        registered: true
      }
    });

    const partnerUser = await User.create({
      username: 'partner_dalat',
      email: 'partner@dalateco.vn',
      password_hash: partnerPassword,
      profile: {
        fullname: 'Trần Văn Đối Tác (Đà Lạt Eco)',
        phone: '0908889999',
        gender: 'Nam',
        address: '12 Lê Hồng Phong, Phường 4, TP. Đà Lạt',
        job: 'Đại diện Đối tác Du lịch',
        avatarUrl: '/images/users/partner.jpg'
      },
      roles: ['provider'],
      status: 'active',
      verified: true,
      wallet: {
        balance: 5000000,
        green_points: 800,
        registered: true
      }
    });

    const travelerUser = await User.create({
      username: 'traveler01',
      email: 'traveler@gmail.com',
      password_hash: travelerPassword,
      profile: {
        fullname: 'Nguyễn Văn Du Khách',
        phone: '0912345678',
        gender: 'Nam',
        address: 'Quận 1, TP. Hồ Chí Minh',
        job: 'Nhiếp ảnh gia tự do',
        avatarUrl: '/images/users/traveler.jpg'
      },
      roles: ['traveler'],
      status: 'active',
      verified: true,
      interests: ['Trekking', 'Ẩm thực hữu cơ', 'Chụp ảnh thiên nhiên'],
      wallet: {
        balance: 3200000,
        green_points: 450,
        registered: true
      }
    });

    // 3. Tạo Provider (Theo Provider schema chuẩn)
    console.log('🏢 Đang tạo Nhà cung cấp (Provider)...');
    const ecoProvider = await Provider.create({
      user_id: partnerUser._id,
      company_name: 'Công ty TNHH Du Lịch Sinh Thái Đà Lạt Xanh',
      field: 'Du lịch & Lưu trú sinh thái',
      destinations: ['Đà Lạt', 'Lâm Đồng'],
      business_license: '5801234567',
      contact_info: {
        hotline: '0908889999',
        email: 'partner@dalateco.vn',
        address: '12 Lê Hồng Phong, Phường 4, TP. Đà Lạt, Lâm Đồng',
        website: 'https://dalateco.vn'
      },
      status: 'active',
      contract: {
        name: 'Hợp đồng đối tác sinh thái GreenSteps 2025',
        status: 'active'
      },
      revenue: [
        {
          monthyear: '10/2026',
          total_booking: 18,
          total_revenue: 45000000,
          service_fee: 4500000,
          final_profit: 40500000
        }
      ]
    });

    // 4. Tạo Services (Theo Service schema chuẩn - 5 items mỗi loại)
    console.log('🏕️ Đang tạo Dịch vụ Xanh (5 Stays, 5 Transports, 5 Foods, 5 Attractions)...');
    
    // 4.1 STAY (5 items)
    const homestayService = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Nắng Ban Mai Eco Homestay Đà Lạt',
      type: 'stay',
      destination: 'Đà Lạt',
      address: 'Đồi Dã Quỳ, Phường 11, TP. Đà Lạt',
      location: { lat: 11.9404, lng: 108.4583 },
      cost: 650000,
      carbon: 8.2,
      capacity: 12,
      description: 'Homestay sinh thái sử dụng 100% năng lượng mặt trời, phân loại rác tại nguồn, nói không với nhựa dùng một lần.',
      amenities: ['Wifi', 'Nước nóng năng lượng mặt trời', 'Vườn rau hữu cơ', 'Trạm lọc nước tự nhiên'],
      images: ['/images/services/stay_homestay_dalat.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Eco Certified', 'Solar Powered'],
      rating: 4.9,
      reviews_count: 24,
      bookings_count: 58,
      status: 'active'
    });

    const pineHillService = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Pine Hill Eco Cabin Rừng Thông Đà Lạt',
      type: 'stay',
      destination: 'Đà Lạt',
      address: 'Đồi Thông, Phường 4, TP. Đà Lạt',
      location: { lat: 11.9325, lng: 108.4412 },
      cost: 850000,
      carbon: 9.5,
      capacity: 6,
      description: 'Cabin gỗ thông tái chế ẩn mình giữa rừng nguyên sơ, sử dụng nước nóng mặt trời và vật liệu thân thiện.',
      amenities: ['Ban công ngắm rừng', 'Nước nóng mặt trời', 'Trà thảo mộc'],
      images: ['/images/services/stay_pine_hill.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['FSC Wood', 'Rainwater Harvest'],
      rating: 4.8,
      reviews_count: 31,
      bookings_count: 42,
      status: 'active'
    });

    const hoiAnEcoVilla = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Hội An Eco Green Boutique Villa',
      type: 'stay',
      destination: 'Hội An',
      address: 'Thôn Thanh Nhì, Cẩm Thanh, TP. Hội An',
      location: { lat: 15.8892, lng: 108.3584 },
      cost: 1200000,
      carbon: 12.0,
      capacity: 16,
      description: 'Khu biệt thự nghỉ dưỡng sinh thái phong cách mộc mạc ven sông, sử dụng hồ bơi điện phân muối không hóa chất.',
      amenities: ['Hồ bơi muối khoáng', 'Xe đạp miễn phí', 'Bữa sáng hữu cơ'],
      images: ['/images/services/stay_hoi_an_eco.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Bamboo Architecture', 'Salt Pool'],
      rating: 5.0,
      reviews_count: 42,
      bookings_count: 73,
      status: 'active'
    });

    const honYenBeachHouse = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Hòn Yến Eco Beach House Phú Yên',
      type: 'stay',
      destination: 'Phú Yên',
      address: 'Xã An Hòa, Huyện Tuy An, Phú Yên',
      location: { lat: 13.2384, lng: 109.3015 },
      cost: 750000,
      carbon: 7.5,
      capacity: 8,
      description: 'Căn nhà ven biển mộc mạc bên rạn san hô Hòn Yến, thưởng thức hải sản sạch mùa vụ và bảo vệ môi trường biển.',
      amenities: ['View biển ngắm bình minh', 'Quạt gió tự nhiên', 'Thuyền kayak'],
      images: ['/images/services/stay_hon_yen.png'],
      green_criteria: { energy: false, waste: true, local: true },
      badges: ['Marine Conservation', 'Zero Plastic'],
      rating: 4.8,
      reviews_count: 18,
      bookings_count: 35,
      status: 'active'
    });

    const tuyenLamGlamping = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Tuyền Lâm Lakeside Eco Glamping',
      type: 'stay',
      destination: 'Đà Lạt',
      address: 'Bán đảo Tuyền Lâm, TP. Đà Lạt',
      location: { lat: 11.8950, lng: 108.4350 },
      cost: 950000,
      carbon: 11.2,
      capacity: 20,
      description: 'Trải nghiệm ngủ lều sinh thái giữa đồi thông thơ mộng ven hồ Tuyền Lâm, thưởng thức trà atiso quanh bếp lửa.',
      amenities: ['Lều vải cotton', 'Bếp nướng không khói', 'Chiếu sáng LED mặt trời'],
      images: ['/images/services/stay_tuyen_lam_lake.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Solar Glamping', 'Leave No Trace'],
      rating: 4.9,
      reviews_count: 29,
      bookings_count: 64,
      status: 'active'
    });

    // 4.2 TRANSPORT (5 items)
    const evRentalService = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Thuê Xe Ô Tô Điện VinFast VF8 & VF5 Net-Zero Tự Lái',
      type: 'transport',
      destination: 'Đà Lạt',
      address: 'Trung tâm TP. Đà Lạt',
      location: { lat: 11.9388, lng: 108.4452 },
      cost: 900000,
      carbon: 28.5,
      capacity: 5,
      description: 'Dịch vụ cho thuê xe ô tô điện di chuyển xanh 0 phát thải, bảo vệ bầu không khí trong lành của cao nguyên.',
      amenities: ['GPS thông minh', 'Trạm sạc miễn phí', 'Bảo hiểm trọn gói'],
      images: ['/images/services/transport_electric_car.png'],
      green_criteria: { energy: true, waste: false, local: true },
      badges: ['Zero Emission', 'EV Fast Charge'],
      rating: 4.8,
      reviews_count: 15,
      bookings_count: 82,
      status: 'active'
    });

    const busAirportService = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Dịch Vụ Xe Buýt Điện Đưa Đón Sân Bay Liên Khương - Đà Lạt',
      type: 'transport',
      destination: 'Đà Lạt',
      address: 'Sân bay Liên Khương, Lâm Đồng',
      location: { lat: 11.7505, lng: 108.3719 },
      cost: 120000,
      carbon: 6.8,
      capacity: 29,
      description: 'Tuyến buýt điện chất lượng cao kết nối sân bay Liên Khương và trung tâm Đà Lạt nhanh chóng, tiện nghi.',
      amenities: ['Điều hòa xanh', 'Wifi miễn phí', 'Cổng sạc USB'],
      images: ['/images/services/transport_electric_car.png'],
      green_criteria: { energy: true, waste: false, local: true },
      badges: ['Green Bus', 'Shared Ride'],
      rating: 4.9,
      reviews_count: 52,
      bookings_count: 140,
      status: 'active'
    });

    const electricMotoService = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Thuê Xe Máy Điện VinFast Feliz S Điểm Đến Xanh',
      type: 'transport',
      destination: 'Đà Lạt',
      address: 'Phường 1, TP. Đà Lạt',
      location: { lat: 11.9420, lng: 108.4380 },
      cost: 160000,
      carbon: 5.2,
      capacity: 2,
      description: 'Vi vu đèo dốc Đà Lạt êm ái, không khói xăng và không gây ô nhiễm tiếng ồn cho thành phố ngàn hoa.',
      amenities: ['Đổi pin nhanh', '2 mũ bảo hiểm sinh thái', 'Áo mưa tái chế'],
      images: ['/images/services/transport_green_bike.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Zero Noise', 'Fast Battery Swap'],
      rating: 4.9,
      reviews_count: 38,
      bookings_count: 115,
      status: 'active'
    });

    const bikeHoiAnService = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Xe Đạp Thể Thao Dạo Quanh Bờ Biển & Phố Cổ Hội An',
      type: 'transport',
      destination: 'Hội An',
      address: 'Phố cổ Hội An, Quảng Nam',
      location: { lat: 15.8770, lng: 108.3280 },
      cost: 80000,
      carbon: 8.0,
      capacity: 1,
      description: 'Thuê xe đạp thể thao chất lượng cao dạo quanh từng con ngõ cổ kính và cánh đồng lúa xanh mướt Cẩm Châu.',
      amenities: ['Khung nhôm siêu nhẹ', 'Khóa dây an toàn', 'Bản đồ di sản xanh'],
      images: ['/images/services/transport_green_bike.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['0 Emission', 'Healthy Travel'],
      rating: 5.0,
      reviews_count: 64,
      bookings_count: 190,
      status: 'active'
    });

    const electricCarPhuYen = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Dịch Vụ Xe Điện Du Lịch Khám Phá Tháp Nghinh Phong',
      type: 'transport',
      destination: 'Phú Yên',
      address: 'Quảng trường Nghinh Phong, Tuy Hòa',
      location: { lat: 13.1025, lng: 109.3180 },
      cost: 250000,
      carbon: 12.0,
      capacity: 8,
      description: 'Chuyến xe điện thoáng gió ngắm cảnh bờ biển Tuy Hòa, công viên biển và check-in quảng trường Nghinh Phong.',
      amenities: ['Xe 8 chỗ thoáng gió', 'Tài xế bản địa', 'Ngắm cảnh biển'],
      images: ['/images/services/transport_electric_car.png'],
      green_criteria: { energy: true, waste: false, local: true },
      badges: ['Coastal EV', 'Scenic Tour'],
      rating: 4.7,
      reviews_count: 21,
      bookings_count: 48,
      status: 'active'
    });

    // 4.3 FOOD (5 items)
    const vegetarianDining = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Nhà Hàng Chay Thực Dưỡng An Lạc - Farm To Table',
      type: 'food',
      destination: 'Đà Lạt',
      address: 'Phường 3, TP. Đà Lạt',
      location: { lat: 11.9325, lng: 108.4371 },
      cost: 180000,
      carbon: 4.5,
      capacity: 50,
      description: 'Thực đơn chay thực dưỡng tinh tế chế biến từ rau củ quả canh tác tự nhiên hái trực tiếp tại vườn sáng sớm.',
      amenities: ['Món chay thuần khiết', 'Rau hữu cơ', 'Trà thảo mộc miễn phí'],
      images: ['/images/services/food_organic_vietnamese.png'],
      green_criteria: { energy: false, waste: true, local: true },
      badges: ['Organic Farm', 'Zero Plastic'],
      rating: 5.0,
      reviews_count: 38,
      bookings_count: 130,
      status: 'active'
    });

    const cafeZeroWaste = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Tiệm Cafe Không Rác Thải Rừng Thông & Bánh Thuần Chay',
      type: 'food',
      destination: 'Đà Lạt',
      address: 'Đồi Dã Quỳ, Phường 11, Đà Lạt',
      location: { lat: 11.9390, lng: 108.4600 },
      cost: 65000,
      carbon: 2.1,
      capacity: 30,
      description: 'Thưởng thức cà phê Robusta & Arabica Cầu Đất nguyên chất bên tiếng chim hót, không sử dụng đồ nhựa một lần.',
      amenities: ['Ly bã mía', 'Ống hút sậy', 'Phân bón từ bã cà phê'],
      images: ['/images/services/food_local_cafe.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Zero Waste Cafe', 'Shade-grown Coffee'],
      rating: 4.9,
      reviews_count: 47,
      bookings_count: 180,
      status: 'active'
    });

    const comQueTraQue = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Bếp Cơm Quê Sinh Thái Làng Rau Trà Quế',
      type: 'food',
      destination: 'Hội An',
      address: 'Làng rau Trà Quế, Hội An',
      location: { lat: 15.8980, lng: 108.3410 },
      cost: 150000,
      carbon: 3.8,
      capacity: 40,
      description: 'Mâm cơm dân dã miền Trung đậm đà với rau thơm Trà Quế nức tiếng, canh chua nấu khế và cá bống kho tộ lá nghệ.',
      amenities: ['Rau sạch VietGAP', 'Trải nghiệm hái rau', 'Nước trà hột é'],
      images: ['/images/services/food_organic_vietnamese.png'],
      green_criteria: { energy: false, waste: true, local: true },
      badges: ['VietGAP Herbs', 'Farm Dining'],
      rating: 4.8,
      reviews_count: 33,
      bookings_count: 95,
      status: 'active'
    });

    const seafoodVungRo = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Ẩm Thực Hải Sản Đánh Bắt Bền Vững Làng Chài Vũng Rô',
      type: 'food',
      destination: 'Phú Yên',
      address: 'Vịnh Vũng Rô, Đông Hòa, Phú Yên',
      location: { lat: 12.8680, lng: 109.4180 },
      cost: 250000,
      carbon: 5.0,
      capacity: 60,
      description: 'Thưởng thức ẩm thực làng chài Vũng Rô tươi ngon, ủng hộ việc đánh bắt có trách nhiệm bảo vệ nguồn lợi thủy sản.',
      amenities: ['Hải sản mùa vụ', 'Nói không cá con', 'Gia vị thảo mộc'],
      images: ['/images/services/food_organic_vietnamese.png'],
      green_criteria: { energy: false, waste: true, local: true },
      badges: ['Sustainable Catch', 'Support Fishermen'],
      rating: 4.8,
      reviews_count: 27,
      bookings_count: 67,
      status: 'active'
    });

    const teaHouseDaLat = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Trà Quán Thảo Mộc Bản Địa & Bánh Ngũ Cốc Hữu Cơ',
      type: 'food',
      destination: 'Đà Lạt',
      address: 'Phường 4, TP. Đà Lạt',
      location: { lat: 11.9310, lng: 108.4350 },
      cost: 75000,
      carbon: 1.8,
      capacity: 25,
      description: 'Không gian tĩnh lặng thưởng thức trà hoa cúc, atiso sấy lạnh và các loại bánh hạt ngũ cốc bồi bổ sức khỏe.',
      amenities: ['Trà atiso tươi', 'Ngũ cốc nguyên cám', 'Nhạc thiền an tịnh'],
      images: ['/images/services/food_local_cafe.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Herbal Tea', 'No Refined Sugar'],
      rating: 4.9,
      reviews_count: 29,
      bookings_count: 88,
      status: 'active'
    });

    // 4.4 ATTRACTION (5 items)
    const supActivity = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Chèo SUP Ngắm Hoàng Hôn & Nhặt Rác Tình Nguyện Hồ Tuyền Lâm',
      type: 'attraction',
      destination: 'Đà Lạt',
      address: 'Khu du lịch Hồ Tuyền Lâm, Đà Lạt',
      location: { lat: 11.8892, lng: 108.4314 },
      cost: 350000,
      carbon: 8.0,
      capacity: 20,
      description: 'Hoạt động trải nghiệm thể thao mặt nước kết hợp lan toả thông điệp bảo vệ hồ Tuyền Lâm trong xanh.',
      amenities: ['Áo phao tái chế', 'SUP thể thao cao cấp', 'Túi đựng rác bảo vệ môi trường'],
      images: ['/images/services/attraction_kayaking.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Clean Ocean/Lake', 'Eco Adventure'],
      rating: 4.9,
      reviews_count: 42,
      bookings_count: 165,
      status: 'active'
    });

    const trekkingBidoupActivity = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Trekking Rừng Nguyên Sinh Bidoup & Trồng Cây Thông Bản Địa',
      type: 'attraction',
      destination: 'Đà Lạt',
      address: 'Vườn Quốc Gia Bidoup Núi Bà, Lâm Đồng',
      location: { lat: 12.1000, lng: 108.6000 },
      cost: 750000,
      carbon: 15.0,
      capacity: 15,
      description: 'Chinh phục rừng rêu cổ thụ Vườn Quốc Gia Bidoup Núi Bà và chung tay gieo mầm cây thông xanh cho tương lai.',
      amenities: ['Trồng 1 cây thông', 'Gậy trekking gỗ', 'Bữa trưa gói lá chuối'],
      images: ['/images/services/attraction_kayaking.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Tree Planting', 'Biodiversity Guide'],
      rating: 5.0,
      reviews_count: 56,
      bookings_count: 110,
      status: 'active'
    });

    const thuyenThungActivity = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Thuyền Thúng Sinh Thái Rừng Dừa Bảy Mẫu Không Động Cơ Xăng',
      type: 'attraction',
      destination: 'Hội An',
      address: 'Rừng dừa Bảy Mẫu, Cẩm Thanh, Hội An',
      location: { lat: 15.8850, lng: 108.3650 },
      cost: 200000,
      carbon: 6.5,
      capacity: 30,
      description: 'Ngồi thuyền thúng truyền thống do các cô chú địa phương chèo tay luồn lách qua các lạch dừa nước bình yên.',
      amenities: ['Chèo tay bản địa', 'Nón lá truyền thống', 'Làm đồ chơi lá dừa'],
      images: ['/images/services/attraction_kayaking.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Traditional Boat', 'No Motor Noise'],
      rating: 4.9,
      reviews_count: 61,
      bookings_count: 220,
      status: 'active'
    });

    const workshopSoap = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Workshop Tự Làm Xà Phòng Tự Nhiên & Nến Thơm Tái Chế',
      type: 'attraction',
      destination: 'Đà Lạt',
      address: 'Phường 2, TP. Đà Lạt',
      location: { lat: 11.9450, lng: 108.4350 },
      cost: 180000,
      carbon: 3.2,
      capacity: 12,
      description: 'Buổi học làm đồ thủ công tái chế thú vị, tạo ra những bánh xà phòng thảo mộc tinh khiết mang về làm quà.',
      amenities: ['Nguyên liệu tự nhiên', 'Dầu ăn tái chế', 'Mang sản phẩm về'],
      images: ['/images/services/attraction_herbal_workshop.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Upcycling Workshop', 'Organic Soap'],
      rating: 4.8,
      reviews_count: 23,
      bookings_count: 75,
      status: 'active'
    });

    const bikeHonYenActivity = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Đạp Xe Ngắm San Hô Cạn & Thu Gom Rác Biển Hòn Yến',
      type: 'attraction',
      destination: 'Phú Yên',
      address: 'Hòn Yến, Tuy An, Phú Yên',
      location: { lat: 13.2350, lng: 109.3000 },
      cost: 280000,
      carbon: 9.0,
      capacity: 15,
      description: 'Cùng hướng dẫn viên đạp xe qua các xóm chài ven biển và tham gia chiến dịch làm sạch bãi san hô Hòn Yến.',
      amenities: ['Xe đạp leo núi', 'Dụng cụ gắp rác', 'Kính lặn ngắm san hô'],
      images: ['/images/services/attraction_kayaking.png'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Coral Protection', 'Clean Beach'],
      rating: 4.9,
      reviews_count: 35,
      bookings_count: 53,
      status: 'active'
    });

    // 5. Tạo Tours / Lịch Trình (Theo Schedule schema chuẩn - 5 tours trọn gói)
    console.log('🗺️ Đang tạo 5 Tour Trọn Gói Sinh Thái (Schedules)...');
    const dalatTour = await Schedule.create({
      owner_id: partnerUser._id,
      tour_name: 'Tour Sinh Thái Đà Lạt 3N2Đ: Trekking Rừng Bidoup & Homestay Bản Địa',
      destination: 'Đà Lạt',
      days: 3,
      total_cost: 2450000,
      total_carbon: 42.5,
      is_sample: true,
      sample_details: {
        old_cost: 2950000,
        rating: 4.9,
        votes_count: 36,
        image_url: '/images/tours/dalat1.jpg',
        tour_description: 'Trekking rừng nguyên sinh Bidoup Núi Bà, nghỉ tại homestay điện mặt trời và trải nghiệm chèo SUP không rác nhựa.'
      },
      activities: [
        {
          day_number: 1,
          time: '08:00',
          name: 'Đón khách bằng xe điện & Check-in Nắng Ban Mai Eco Homestay',
          cost: 650000,
          carbon: 4.2,
          type: 'lodging',
          service_id: homestayService._id
        },
        {
          day_number: 1,
          time: '14:30',
          name: 'Chèo SUP & nhặt rác tình nguyện tại Hồ Tuyền Lâm',
          cost: 350000,
          carbon: 0,
          type: 'attraction',
          service_id: supActivity._id
        },
        {
          day_number: 1,
          time: '18:30',
          name: 'Bữa tối chay thanh tịnh tại An Lạc Farm',
          cost: 180000,
          carbon: 1.5,
          type: 'dining',
          service_id: vegetarianDining._id
        },
        {
          day_number: 2,
          time: '07:30',
          name: 'Chinh phục Đỉnh Bidoup Núi Bà & Trồng cây thông bản địa',
          cost: 750000,
          carbon: -15,
          type: 'attraction'
        },
        {
          day_number: 3,
          time: '09:00',
          name: 'Hái rau tại vườn hữu cơ & học cách ủ phân vi sinh',
          cost: 200000,
          carbon: 0,
          type: 'attraction'
        }
      ]
    });

    const phuyenTour = await Schedule.create({
      owner_id: partnerUser._id,
      tour_name: 'Khám Phá Phú Yên Xanh: Xứ Sở Hoa Vàng Cỏ Xanh & Gành Đá Đĩa Net-Zero',
      destination: 'Phú Yên',
      days: 3,
      total_cost: 3200000,
      total_carbon: 55.0,
      is_sample: true,
      sample_details: {
        old_cost: 3750000,
        rating: 4.8,
        votes_count: 22,
        image_url: '/images/tours/phuyen1.jpg',
        tour_description: 'Đạp xe dọc bờ biển Bãi Xép, ngắm bình minh Mũi Điện và dọn sạch bãi biển cùng người dân địa phương.'
      },
      activities: [
        {
          day_number: 1,
          time: '06:00',
          name: 'Đón bình minh tại hải đăng Mũi Điện - Nơi đón ánh bình minh đầu tiên',
          cost: 250000,
          carbon: 2.0,
          type: 'attraction'
        },
        {
          day_number: 2,
          time: '14:00',
          name: 'Khám phá kiệt tác Gành Đá Đĩa & dọn rác bãi biển',
          cost: 200000,
          carbon: 0,
          type: 'attraction'
        }
      ]
    });

    const hoianTour = await Schedule.create({
      owner_id: partnerUser._id,
      tour_name: 'Hành Trình Di Sản Xanh Hội An - Rừng Dừa Bảy Mẫu Không Khói',
      destination: 'Hội An',
      days: 2,
      total_cost: 1850000,
      total_carbon: 30.0,
      is_sample: true,
      sample_details: {
        old_cost: 2200000,
        rating: 5.0,
        votes_count: 45,
        image_url: '/images/tours/hoian1.jpg',
        tour_description: 'Đi thuyền thúng chèo tay không ô nhiễm tiếng ồn, đạp xe qua làng rau Trà Quế không thuốc trừ sâu.'
      },
      activities: [
        {
          day_number: 1,
          time: '08:30',
          name: 'Thuyền thúng sinh thái Rừng dừa Bảy Mẫu',
          cost: 300000,
          carbon: 0,
          type: 'attraction'
        }
      ]
    });

    const tuyenLamCampingTour = await Schedule.create({
      owner_id: partnerUser._id,
      tour_name: 'Trải Nghiệm Sinh Thái Rừng Thông & Cắm Trại Glamping Hồ Tuyền Lâm',
      destination: 'Đà Lạt',
      days: 2,
      total_cost: 1450000,
      total_carbon: 25.0,
      is_sample: true,
      sample_details: {
        old_cost: 1800000,
        rating: 4.9,
        votes_count: 28,
        image_url: '/images/tours/dalat2.jpg',
        tour_description: 'Thức dậy giữa đồi thông thơ mộng ven hồ Tuyền Lâm, hòa mình vào thiên nhiên với hoạt động chèo SUP và tiệc nướng sinh thái.'
      },
      activities: [
        {
          day_number: 1,
          time: '14:00',
          name: 'Check-in Glamping ven hồ Tuyền Lâm & thưởng trà atiso hữu cơ',
          cost: 500000,
          carbon: 5.0,
          type: 'lodging'
        }
      ]
    });

    const sonTraTour = await Schedule.create({
      owner_id: partnerUser._id,
      tour_name: 'Tour Khám Phá Bán Đảo Sơn Trà & Lặn Ngắm San Hô Không Dấu Chân',
      destination: 'Đà Nẵng',
      days: 1,
      total_cost: 950000,
      total_carbon: 18.0,
      is_sample: true,
      sample_details: {
        old_cost: 1200000,
        rating: 4.7,
        votes_count: 19,
        image_url: '/images/tours/danang1.jpg',
        tour_description: 'Quan sát loài Voọc Chà Vá chân nâu quý hiếm trong tự nhiên và lặn ngắm rạn san hô nguyên sơ có trách nhiệm.'
      },
      activities: [
        {
          day_number: 1,
          time: '07:30',
          name: 'Trekking nhẹ bán đảo Sơn Trà ngắm Voọc Chà Vá',
          cost: 450000,
          carbon: 0,
          type: 'attraction'
        }
      ]
    });

    // 6. Tạo Vouchers (Theo Voucher schema chuẩn)
    console.log('🎟️ Đang tạo Vouchers khuyến mãi...');
    await Voucher.create([
      {
        code: 'GREENFIRST',
        discount_type: 'percent',
        discount_value: 10,
        min_order_value: 500000,
        max_discount: 200000,
        quantity: 200,
        used_count: 5,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: 'active'
      },
      {
        code: 'NETZERO50',
        discount_type: 'fixed',
        discount_value: 50000,
        min_order_value: 300000,
        quantity: 500,
        used_count: 12,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'active'
      },
      {
        code: 'ECOSTAY15',
        discount_type: 'percent',
        discount_value: 15,
        min_order_value: 1000000,
        max_discount: 300000,
        quantity: 100,
        used_count: 2,
        expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: 'active'
      }
    ]);

    // 7. Tạo Huy Hiệu (Badges)
    console.log('🏅 Đang tạo Huy hiệu Xanh (Badges)...');
    await Badge.create([
      {
        name: 'Người Tiên Phong Net-Zero',
        description: 'Hoàn thành chuyến du lịch sinh thái đầu tiên cùng GreenSteps.',
        scope: 'user',
        icon_url: '/images/badges/pioneer.png'
      },
      {
        name: 'Bảo Vệ Rừng Xanh',
        description: 'Tham gia trồng ít nhất 01 cây xanh trong lịch trình du lịch.',
        scope: 'schedule',
        icon_url: '/images/badges/tree.png'
      },
      {
        name: 'Hiệp Sĩ Không Rác Thải',
        description: 'Hoàn thành hoạt động nhặt rác tình nguyện tại các điểm đến.',
        scope: 'user',
        icon_url: '/images/badges/zero_waste.png'
      },
      {
        name: 'Đại Sứ Hành Tinh Xanh',
        description: 'Đạt trên 1,000 Điểm Xanh và chia sẻ ít nhất 5 bài viết bảo vệ môi trường.',
        scope: 'user',
        icon_url: '/images/badges/ambassador.png'
      }
    ]);

    // 8. Tạo Bài Viết Cộng Đồng (CommunityPosts)
    console.log('📝 Đang tạo Bài viết cộng đồng chia sẻ hành trình...');
    await CommunityPost.create([
      {
        author_id: travelerUser._id,
        title: 'Chuyến trekking rừng Bidoup Đà Lạt 3N2Đ - Chuyến đi không rác đầu tiên trong đời mình!',
        destination: 'Đà Lạt',
        days: 3,
        text: 'Thực sự cảm phục các bạn hướng dẫn viên tại GreenSteps. Suốt 3 ngày 2 đêm, chúng mình không hề sử dụng bất kỳ một chai nhựa hay túi nylon nào. Nước uống được tiếp từ các trạm lọc nước sinh thái, bữa ăn bọc trong lá dong và hộp thiếc tái sử dụng. Cảm giác thức dậy giữa rừng thông tĩnh lặng, nghe tiếng chim hót mà không vương một cọng rác nào làm mình thấy yêu đất nước này vô cùng!',
        image_url: '/images/community/post1.jpg',
        itinerary_id: dalatTour._id,
        likes_count: 38,
        liked_by: [adminUser._id],
        comments_count: 1,
        comments: [
          {
            author_id: adminUser._id,
            text: 'Cảm ơn bạn đã đồng hành và lan tỏa tinh thần du lịch có trách nhiệm!',
            rating: 5,
            created_at: new Date()
          }
        ],
        status: 'published'
      },
      {
        author_id: partnerUser._id,
        title: 'Hướng dẫn chuẩn bị hành lý sinh thái cho chuyến du lịch Net-Zero hoàn hảo',
        destination: 'Toàn quốc',
        days: 1,
        text: '1. Luôn mang theo bình nước giữ nhiệt cá nhân.\n2. Chuẩn bị túi vải xếp gọn để mua đặc sản thay túi nylon.\n3. Dùng xà phòng và dầu gội thanh hữu cơ không vi nhựa.\n4. Ưu tiên thuê xe máy điện hoặc xe đạp khi di chuyển trong thành phố.',
        image_url: '/images/community/tips1.jpg',
        likes_count: 56,
        liked_by: [travelerUser._id],
        comments_count: 0,
        status: 'published'
      }
    ]);

    // 9. Tạo Booking Mẫu và Ký quỹ Escrow (Theo Booking schema chuẩn)
    console.log('📦 Đang tạo Booking mẫu...');
    const demoBooking = await Booking.create({
      evoucher_code: `EV-GS-${Date.now().toString().slice(-6)}`,
      user_id: travelerUser._id,
      kind: 'tour',
      target_id: dalatTour._id,
      provider_id: ecoProvider._id,
      customer: {
        fullname: travelerUser.profile.fullname,
        email: travelerUser.email,
        phone: travelerUser.profile.phone
      },
      booking_date: '2026-11-01',
      check_out_date: '2026-11-03',
      guests: 2,
      value: 4900000,
      voucher_code: 'GREENFIRST',
      payment: {
        method: 'wallet',
        status: 'paid',
        paid_at: new Date()
      },
      escrow: {
        status: 'holding' // Ký quỹ đang bảo vệ tiền của khách
      },
      booking_status: 'confirmed'
    });

    // 10. Tạo Đánh Giá Mẫu (Review)
    console.log('⭐ Đang tạo Đánh giá mẫu...');
    await Review.create({
      booking_id: demoBooking._id,
      schedule_id: dalatTour._id,
      service_id: homestayService._id,
      user_id: travelerUser._id,
      rating: 5,
      comment: 'Trải nghiệm vượt trên kỳ vọng! Homestay Nắng Ban Mai rất ấm cúng, rau hái trực tiếp xào tại chỗ siêu ngọt. Tour guide am hiểu rừng, rất có tâm. 10/10 điểm cho GreenSteps!',
      images: ['/images/reviews/review1.jpg'],
      provider_reply: {
        reply_text: 'Đà Lạt Eco Travel chân thành cảm ơn gia đình bạn! Rất mong được đón tiếp bạn trong những chuyến hành trình xanh tiếp theo.',
        replied_at: new Date()
      }
    });

    // 11. Cấu Hình Hệ Thống (SystemConfig)
    console.log('⚙️ Đang tạo Cấu hình hệ thống...');
    await SystemConfig.create([
      {
        config_key: 'commission_rate_default',
        config_value: 10,
        description: 'Tỷ lệ hoa hồng mặc định của sàn GreenSteps (%)'
      },
      {
        config_key: 'green_points_ratio',
        config_value: { points: 100, vnd: 10000 },
        description: 'Tỷ lệ quy đổi điểm xanh ra VNĐ'
      },
      {
        config_key: 'escrow_hold_hours',
        config_value: 24,
        description: 'Thời gian giữ tiền ký quỹ Escrow sau khi kết thúc dịch vụ trước khi chuyển cho đối tác (giờ)'
      }
    ]);

    // 12. Tạo Thông Báo (Notifications)
    console.log('🔔 Đang tạo Thông báo...');
    await Notification.create([
      {
        user_id: travelerUser._id,
        title: 'Đặt tour thành công!',
        message: 'Bạn đã đặt thành công Tour Đà Lạt 3N2Đ. Mã vé E-Voucher của bạn đã sẵn sàng trong ứng dụng.',
        type: 'booking',
        read: false
      },
      {
        user_id: travelerUser._id,
        title: 'Chúc mừng nhận +450 Điểm Xanh',
        message: 'Bạn được cộng 450 Điểm Xanh vì đã chọn phương thức di chuyển Net-Zero.',
        type: 'wallet',
        read: true
      }
    ]);

    console.log('=======================================================');
    console.log('🎉 KHỞI TẠO DỮ LIỆU SEED MONGODB THÀNH CÔNG RỰC RỠ!');
    console.log('=======================================================');
    console.log('Tài khoản Quản trị: admin@greensteps.vn (username: admin) / admin123');
    console.log('Tài khoản Đối tác:  partner@dalateco.vn (username: partner_dalat) / partner123');
    console.log('Tài khoản Khách:    traveler@gmail.com (username: traveler01) / traveler123');
    console.log('=======================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khởi tạo dữ liệu seed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedData();
