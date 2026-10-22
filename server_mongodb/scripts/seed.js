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

    // 4. Tạo Services (Theo Service schema chuẩn)
    console.log('🏕️ Đang tạo Dịch vụ Xanh (Services)...');
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
      images: ['/images/services/homestay1.jpg', '/images/services/homestay2.jpg'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Eco Certified', 'Solar Powered'],
      rating: 4.9,
      reviews_count: 24,
      status: 'active'
    });

    const evRentalService = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Thuê Xe Điện Du Lịch VinFast VF8 & VF5 Tự Lái',
      type: 'transport',
      destination: 'Đà Lạt',
      address: 'Trung tâm TP. Đà Lạt',
      location: { lat: 11.9388, lng: 108.4452 },
      cost: 900000,
      carbon: 2.1,
      capacity: 5,
      description: 'Dịch vụ cho thuê xe ô tô điện di chuyển xanh 0 phát thải, hỗ trợ trạm sạc miễn phí tại các điểm liên kết.',
      amenities: ['GPS', 'Trạm sạc miễn phí', 'Bảo hiểm trọn gói'],
      images: ['/images/services/car1.jpg'],
      green_criteria: { energy: true, waste: false, local: true },
      badges: ['Zero Emission'],
      rating: 4.8,
      reviews_count: 15,
      status: 'active'
    });

    const vegetarianDining = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Nhà hàng Chay Thực Dưỡng An Lạc - Farm To Table',
      type: 'food',
      destination: 'Đà Lạt',
      address: 'Phường 3, TP. Đà Lạt',
      location: { lat: 11.9325, lng: 108.4371 },
      cost: 180000,
      carbon: 1.5,
      capacity: 50,
      description: 'Thực đơn chay 100% từ nông sản sạch canh tác tự nhiên không phân bón hoá học, mang lại năng lượng an lành.',
      amenities: ['Món chay thuần khiết', 'Rau hữu cơ', 'Trà thảo mộc miễn phí'],
      images: ['/images/services/dining1.jpg'],
      green_criteria: { energy: false, waste: true, local: true },
      badges: ['Organic Farm', 'Zero Plastic'],
      rating: 5.0,
      reviews_count: 38,
      status: 'active'
    });

    const supActivity = await Service.create({
      provider_id: ecoProvider._id,
      name: 'Chèo SUP Ngắm Hoàng Hôn & Nhặt Rác Tình Nguyện Hồ Tuyền Lâm',
      type: 'attraction',
      destination: 'Đà Lạt',
      address: 'Khu du lịch Hồ Tuyền Lâm, Đà Lạt',
      location: { lat: 11.8892, lng: 108.4314 },
      cost: 350000,
      carbon: 0,
      capacity: 20,
      description: 'Hoạt động trải nghiệm thể thao mặt nước kết hợp lan toả thông điệp bảo vệ hồ Tuyền Lâm trong xanh.',
      amenities: ['Áo phao', 'SUP thể thao cao cấp', 'Túi đựng rác bảo vệ môi trường'],
      images: ['/images/services/activity1.jpg'],
      green_criteria: { energy: true, waste: true, local: true },
      badges: ['Clean Ocean/Lake', 'Eco Adventure'],
      rating: 4.9,
      reviews_count: 42,
      status: 'active'
    });

    // 5. Tạo Tours / Lịch Trình (Theo Schedule schema chuẩn)
    console.log('🗺️ Đang tạo Tour Trọn Gói Sinh Thái (Schedules)...');
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
          carbon: -15, // Hấp thụ CO2
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
