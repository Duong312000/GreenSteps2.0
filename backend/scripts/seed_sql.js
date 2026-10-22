const bcrypt = require('bcrypt');
const {
  sequelize,
  User,
  Badge,
  BadgeUser,
  Wallet,
  WalletTransaction,
  Vender,
  VenderContract,
  Revenue,
  Contract,
  Provider,
  Schedule,
  BadgeSchedule,
  ScheduleSample,
  ScheduleCustom,
  UserSchedule,
  GreenService,
  BadgeService,
  ServiceBooking,
  TourBooking,
  WithdrawalRequest,
  ScheduleActivity,
  AdCampaign,
  CommunityPost,
  CommentPost,
  CPSS,
  CPGS,
  Voucher,
  FAQ
} = require('../src/models/index');

async function seed() {
  try {
    console.log('Syncing database schema (creating missing tables)...');
    await sequelize.sync({ alter: true });
    console.log('Schema synced. Cleaning up database tables before seeding...');
    const tables = [
      'CPGSes', 'CPSSes', 'CommentPosts', 'CommunityPosts', 'AdCampaigns', 'TourBookings', 'ServiceBookings',
      'BadgeServices', 'GreenServices', 'ScheduleActivities', 'ScheduleCustoms', 'ScheduleSamples',
      'BadgeSchedules', 'Schedules', 'Providers', 'VenderContracts', 'Venders', 'Revenues',
      'WithdrawalRequests', 'WalletTransactions', 'Wallets', 'BadgeUsers', 'Badges', 'Users',
      'Contracts', 'FAQs', 'Vouchers'
    ];
    for (const tbl of tables) {
      try {
        await sequelize.query(`TRUNCATE TABLE "${tbl}" CASCADE;`);
      } catch (err) {
        // Table might not exist yet, ignore
      }
    }
    console.log('Database tables cleared successfully! Inserting realistic seed data...');

    // 1. Insert Badges
    console.log('Seeding Badges...');
    await Badge.bulkCreate([
      { id: 'green', badges_description: 'Chứng nhận sinh thái xanh thân thiện môi trường', foruserortour: 2 },
      { id: 'budget', badges_description: 'Giá cả tiết kiệm, phù hợp ngân sách học sinh sinh viên', foruserortour: 0 },
      { id: 'bestseller', badges_description: 'Sản phẩm/dịch vụ lữ hành bán chạy nhất hệ thống', foruserortour: 1 }
    ]);

    // 2. Insert Users (Rule: UG + 2 số cuối năm (26) + 3 chữ đầu username + số thứ tự 0000-9999)
    console.log('Seeding Users...');
    const hashedPwd = await bcrypt.hash('123456', 10);
    const users = await User.bulkCreate([
      {
        id: 'UG26tra0001',
        role: 'traveler',
        username: 'traveler',
        password_hash: hashedPwd,
        fullname: 'Nguyễn Minh Anh',
        email: 'minhanh.greentravel@gmail.com',
        phone: '0901 234 567',
        dob: '1996-08-12',
        gender: 'Nam',
        address: 'Quận 1, TP. Hồ Chí Minh',
        job: 'Nhân viên văn phòng',
        last_interest: 'Đà Lạt'
      },
      {
        id: 'UG26par0001',
        role: 'provider',
        username: 'partner',
        password_hash: hashedPwd,
        fullname: 'Trần Văn A',
        email: 'partner.greentravel@gmail.com',
        phone: '0902 987 654',
        dob: '1988-05-15',
        gender: 'Nam',
        address: 'Quận 3, TP. Hồ Chí Minh',
        job: 'Kinh doanh homestay'
      },
      {
        id: 'UG26adm0001',
        role: 'admin',
        username: 'admin',
        password_hash: hashedPwd,
        fullname: 'Quản trị viên Hệ thống',
        email: 'admin.greensteps@gmail.com',
        phone: '0903 111 222',
        dob: '1990-01-01',
        gender: 'Khác',
        address: 'Trung tâm công nghệ GreenSteps'
      },
      {
        id: 'UG26duo0001',
        role: 'provider',
        username: 'Duong',
        password_hash: hashedPwd,
        fullname: 'Dương Văn Tiến',
        email: 'duong.partner@gmail.com',
        phone: '0909 333 444',
        dob: '1995-10-10',
        gender: 'Nam',
        address: 'Phường 2, Đà Lạt',
        job: 'Kinh doanh du lịch sinh thái xanh',
        company_name: 'GreenSteps Đà Lạt Co.'
      }
    ]);

    // 3. Create Vender & VenderContract (Rule: vender_ + 6 số cuối timestamp, VC- + 6 số cuối timestamp)
    console.log('Seeding Venders & VenderContracts...');
    await Vender.bulkCreate([
      { id: 'vender_26par01', user_id: 'UG26par0001', registration_date: '2026-06-28' },
      { id: 'vender_26duo01', user_id: 'UG26duo0001', registration_date: '2026-07-01' }
    ]);

    await VenderContract.bulkCreate([
      {
        id: 'VC-26par01',
        user_id: 'UG26par0001',
        name_contract: 'Hợp đồng liên kết đối tác bán hàng GreenSteps - Tran Van A',
        text: 'Nội dung chi tiết về điều khoản chiết khấu 10% hoa hồng trên giá trị đơn đặt chỗ dịch vụ sinh thái xanh. Cam kết chất lượng xanh, giảm thiểu phát thải carbon, sử dụng vật liệu thân thiện môi trường của hộ kinh doanh Trần Văn A.'
      },
      {
        id: 'VC-26duo01',
        user_id: 'UG26duo0001',
        name_contract: 'Hợp đồng liên kết đối tác bán hàng GreenSteps - Dương',
        text: 'Nội dung chi tiết về điều khoản chiết khấu 10% hoa hồng trên giá trị đơn đặt chỗ dịch vụ sinh thái xanh. Cam kết chất lượng xanh, giảm thiểu phát thải carbon, sử dụng vật liệu thân thiện môi trường của hộ kinh doanh Dương.'
      }
    ]);

    // 4. Create Ewallet & Transactions (Rule: EW + 8 số ngẫu nhiên, GD + timestamp/digits)
    console.log('Seeding Wallets & Transactions...');
    await Wallet.bulkCreate([
      { id: 'EW10000001', user_id: 'UG26tra0001', balance: 5000000.00, registered: true, green_points: 1250 },
      { id: 'EW10000002', user_id: 'UG26par0001', balance: 13500000.00, registered: true, green_points: 0 },
      { id: 'EW26admin001', user_id: 'UG26adm0001', balance: 1500000.00, registered: true, green_points: 0 },
      { id: 'EW10000004', user_id: 'UG26duo0001', balance: 8000000.00, registered: true, green_points: 250 }
    ]);

    await WalletTransaction.bulkCreate([
      { id: 'GD2606010001', wallet_id: 'EW10000001', type: 'deposit', description: 'Nạp tiền ví du lịch', amount: 5000000.00, status: 'success' },
      { id: 'GD2606020002', wallet_id: 'EW10000001', type: 'payment', description: 'Đặt cọc dịch vụ xanh Homestay Xanh Đà Lạt', amount: 850000.00, status: 'success', reference_id: 'BKG_D_0001' },
      { id: 'GD2606040003', wallet_id: 'EW10000001', type: 'refund', description: 'Hoàn tiền dịch vụ ẩm thực cũ', amount: 300000.00, status: 'success' }
    ]);

    // 5. Create Revenue (Rule: REV + 6 số cuối timestamp)
    console.log('Seeding Revenue history...');
    await Revenue.bulkCreate([
      {
        id: 'REV2604par01',
        user_id: 'UG26par0001',
        monthyear: '04/2026',
        total_booking: 8,
        total_revenue: 9800000.00,
        service_fee: 980000.00,
        final_profit: 8820000.00
      },
      {
        id: 'REV2605par02',
        user_id: 'UG26par0001',
        monthyear: '05/2026',
        total_booking: 15,
        total_revenue: 18500000.00,
        service_fee: 1850000.00,
        final_profit: 16650000.00
      },
      {
        id: 'REV2606par03',
        user_id: 'UG26par0001',
        monthyear: '06/2026',
        total_booking: 12,
        total_revenue: 15000000.00,
        service_fee: 1500000.00,
        final_profit: 13500000.00
      },
      {
        id: 'REV2605duo01',
        user_id: 'UG26duo0001',
        monthyear: '05/2026',
        total_booking: 5,
        total_revenue: 4500000.00,
        service_fee: 450000.00,
        final_profit: 4050000.00
      },
      {
        id: 'REV2606duo02',
        user_id: 'UG26duo0001',
        monthyear: '06/2026',
        total_booking: 7,
        total_revenue: 6800000.00,
        service_fee: 680000.00,
        final_profit: 6120000.00
      },
      {
        id: 'REV2607duo03',
        user_id: 'UG26duo0001',
        monthyear: '07/2026',
        total_booking: 6,
        total_revenue: 3290000.00,
        service_fee: 329000.00,
        final_profit: 2961000.00
      }
    ]);

    // 6. Create Contracts & Providers (Rule: CON + số thứ tự, PROV- + 6 số cuối timestamp)
    console.log('Seeding B2B Contracts & Providers...');
    await Contract.create({
      id: 'CON0001',
      name_contract: 'Hợp đồng hợp tác chiến lược Saigontourist B2B',
      text: 'Nội dung hợp tác phát triển, khai thác du lịch xanh, thúc đẩy các gói tour bảo vệ môi trường, hạn chế khí thải carbon...',
      contract_status: 'active'
    });

    await Provider.bulkCreate([
      {
        id: 'PROV-260001',
        contract_id: 'CON0001',
        name_provider: 'Saigontourist',
        field: 'Lữ hành quốc tế & nội địa',
        destination: 'TP. Hồ Chí Minh',
        image_url: 'image/Viet Nam.png',
        provider_status: 'active'
      },
      {
        id: 'PROV-260002',
        contract_id: 'CON0001',
        name_provider: 'Duong',
        field: 'Kinh doanh dịch vụ lưu trú & ăn uống xanh',
        destination: 'Đà Lạt',
        image_url: 'image/greensteps_logo.png',
        provider_status: 'active'
      }
    ]);

    // 7. Seeding Preset Tours
    console.log('Seeding Preset Tours...');
    const defaultTours = [
      {
        id: "preset_dl_1",
        title: "Tour Đà Lạt Gia Đình 3N2Đ",
        destination: "Đà Lạt",
        days: 3,
        cost: 1890000,
        oldCost: 2200000,
        carbon: 45,
        image: "image/dalat_cover.png",
        description: "Trải nghiệm 3 ngày 2 đêm tuyệt vời tại thành phố ngàn hoa Đà Lạt cùng gia đình. Tour được thiết kế đặc biệt cho các gia đình có trẻ nhỏ, ưu tiên các phương tiện và địa điểm sinh thái xanh.",
        data: [
          [
            { time: "08:00", name: "Đón khách - Khách sạn Dahlia", cost: 0, carbon: 0, icon: "bi-building-fill", type: "lodging", id: "t_dl_1_1", lat: 11.9425, lng: 108.4410 },
            { time: "10:00", name: "Dạo chơi Thung lũng Tình Yêu", cost: 150000, carbon: 3, icon: "bi-tree-fill", type: "attraction", id: "t_dl_1_2", lat: 11.9774, lng: 108.4526 },
            { time: "12:00", name: "Ăn trưa lẩu gà lá é Tao Ngộ", cost: 80000, carbon: 1.5, icon: "bi-cup-hot-fill", type: "dining", id: "t_dl_1_3", lat: 11.9485, lng: 108.4552 }
          ],
          [
            { time: "08:00", name: "Ăn sáng tại khách sạn", cost: 0, carbon: 0, icon: "bi-cup-hot-fill", type: "dining", id: "t_dl_1_5", lat: 11.9425, lng: 108.4410 },
            { time: "10:00", name: "Trượt máng Thác Datanla", cost: 170000, carbon: 1.2, icon: "bi-tree-fill", type: "attraction", id: "t_dl_1_6", lat: 11.9015, lng: 108.4485 }
          ],
          [
            { time: "08:00", name: "Cafe Săn Mây Đà Lạt", cost: 80000, carbon: 0.5, icon: "bi-cup-hot-fill", type: "dining", id: "t_dl_1_8", lat: 11.9620, lng: 108.5300 },
            { time: "11:00", name: "Mua sắm đặc sản chợ Đà Lạt", cost: 100000, carbon: 1, icon: "bi-cup-hot-fill", type: "dining", id: "t_dl_1_9", lat: 11.9423, lng: 108.4360 }
          ]
        ]
      },
      {
        id: "preset_dl_2",
        title: "Tour Đà Lạt Cắm Trại Săn Mây 2N1Đ",
        destination: "Đà Lạt",
        days: 2,
        cost: 1250000,
        oldCost: 1500000,
        carbon: 22,
        image: "image/1dc8619487310884c9d631d689ece1e7.jpg",
        description: "Ngủ lều giữa đồi thông thơ mộng, đón sương mù và săn mây lúc bình minh tại Đồi Đa Phú.",
        data: [
          [
            { time: "14:00", name: "Tập trung tại chân đồi Đa Phú", cost: 0, carbon: 1, icon: "bi-geo-alt-fill", type: "attraction", id: "t_dl_2_1", lat: 11.9720, lng: 108.4210 },
            { time: "16:00", name: "Dựng lều & đón hoàng hôn đồi thông", cost: 150000, carbon: 0.5, icon: "bi-tree-fill", type: "attraction", id: "t_dl_2_2", lat: 11.9730, lng: 108.4220 },
            { time: "18:00", name: "Tiệc nướng BBQ hữu cơ bản địa", cost: 300000, carbon: 4.5, icon: "bi-cup-hot-fill", type: "dining", id: "t_dl_2_3", lat: 11.9735, lng: 108.4225 }
          ],
          [
            { time: "05:00", name: "Thức giấc săn mây đón bình minh", cost: 50000, carbon: 0.2, icon: "bi-stars", type: "attraction", id: "t_dl_2_4", lat: 11.9730, lng: 108.4220 },
            { time: "08:00", name: "Uống cafe phin hữu cơ, dọn rác xanh", cost: 60000, carbon: -1.0, icon: "bi-cup-hot-fill", type: "dining", id: "t_dl_2_5", lat: 11.9740, lng: 108.4230 }
          ]
        ]
      },
      {
        id: "preset_dl_3",
        title: "Tour Đà Lạt LangBiang Khám Phá 3N2Đ",
        destination: "Đà Lạt",
        days: 3,
        cost: 2100000,
        oldCost: 2450000,
        carbon: 52,
        image: "image/dalat_cover.png",
        description: "Chinh phục đỉnh LangBiang huyền thoại, tìm hiểu nét văn hóa bản địa của người Lạch.",
        data: [
          [
            { time: "08:00", name: "Đón ga Đà Lạt bằng xe điện", cost: 0, carbon: 0.2, icon: "bi-car-front-fill", type: "transport", id: "t_dl_3_1", lat: 11.9423, lng: 108.4360 },
            { time: "10:00", name: "Tham quan Dinh 3 Bảo Đại", cost: 40000, carbon: 1.2, icon: "bi-building", type: "attraction", id: "t_dl_3_2", lat: 11.9295, lng: 108.4295 }
          ],
          [
            { time: "08:00", name: "Leo núi LangBiang sinh thái", cost: 120000, carbon: 2.0, icon: "bi-tree-fill", type: "attraction", id: "t_dl_3_3", lat: 12.0302, lng: 108.4395 },
            { time: "18:00", name: "Giao lưu cồng chiêng Tây Nguyên", cost: 250000, carbon: 3.5, icon: "bi-people-fill", type: "attraction", id: "t_dl_3_4", lat: 12.0250, lng: 108.4350 }
          ],
          [
            { time: "09:00", name: "Vườn dâu tây hữu cơ sinh học", cost: 100000, carbon: 0.5, icon: "bi-tree-fill", type: "attraction", id: "t_dl_3_5", lat: 11.9560, lng: 108.4520 }
          ]
        ]
      },
      {
        id: "preset_dl_4",
        title: "Tour Đà Lạt Nghỉ Dưỡng Sương Mù 4N3Đ",
        destination: "Đà Lạt",
        days: 4,
        cost: 3890000,
        oldCost: 4500000,
        carbon: 60,
        image: "image/dalat_cover.png",
        description: "Nghỉ dưỡng biệt thự thông xanh cổ kính Pháp, thiền trà dưỡng sinh yên ả.",
        data: [
          [
            { time: "09:00", name: "Nhận phòng Ana Mandara Villas", cost: 0, carbon: 1.5, icon: "bi-house-heart", type: "lodging", id: "t_dl_4_1", lat: 11.9480, lng: 108.4280 }
          ],
          [
            { time: "07:00", name: "Thiền Yoga giữa rừng thông", cost: 150000, carbon: 0.1, icon: "bi-stars", type: "attraction", id: "t_dl_4_2", lat: 11.9485, lng: 108.4285 },
            { time: "14:00", name: "Tắm bùn khoáng thiên nhiên", cost: 350000, carbon: 1.0, icon: "bi-droplet-fill", type: "attraction", id: "t_dl_4_3", lat: 11.9120, lng: 108.4680 }
          ],
          [
            { time: "09:00", name: "Tham quan Hồ Tuyền Lâm xanh", cost: 100000, carbon: 0.8, icon: "bi-tree-fill", type: "attraction", id: "t_dl_4_4", lat: 11.8970, lng: 108.4350 }
          ],
          [
            { time: "10:00", name: "Thưởng trà chiều hữu cơ Cầu Đất", cost: 150000, carbon: 1.8, icon: "bi-cup-hot", type: "dining", id: "t_dl_4_5", lat: 11.8540, lng: 108.5710 }
          ]
        ]
      },
      {
        id: "preset_py_1",
        title: "Tour Phú Yên Xứ Sở Hoa Vàng 3N2Đ",
        destination: "Phú Yên",
        days: 3,
        cost: 1690000,
        oldCost: 1950000,
        carbon: 38,
        image: "image/phuyen_cover.png",
        description: "Hành trình khám phá xứ sở hoa vàng trên cỏ xanh Phú Yên với các hoạt động bảo vệ rạn san hô Hòn Yến, đi bộ dọn rác bãi biển.",
        data: [
          [
            { time: "08:00", name: "Xe điện đón khách tại Ga Tuy Hòa", cost: 0, carbon: 0.1, icon: "bi-car-front-fill", type: "transport", id: "t_py_1_1", lat: 13.0885, lng: 109.3000 },
            { time: "10:00", name: "Tham quan Tháp Nhạn", cost: 20000, carbon: 0.8, icon: "bi-tree-fill", type: "attraction", id: "t_py_1_2", lat: 13.0898, lng: 109.3005 },
            { time: "12:00", name: "Ăn trưa cơm gà Tuyết Nhung", cost: 60000, carbon: 1.2, icon: "bi-cup-hot-fill", type: "dining", id: "t_py_1_3", lat: 13.0905, lng: 109.3032 }
          ],
          [
            { time: "08:00", name: "Khám phá danh thắng Gành Đá Đĩa", cost: 40000, carbon: 2.5, icon: "bi-tree-fill", type: "attraction", id: "t_py_1_4", lat: 13.3650, lng: 109.2990 },
            { time: "12:00", name: "Ăn trưa hải sản Đầm Ô Loan", cost: 150000, carbon: 3, icon: "bi-cup-hot-fill", type: "dining", id: "t_py_1_5", lat: 13.2625, lng: 109.2882 },
            { time: "15:00", name: "Dạo chơi Bãi Xép", cost: 20000, carbon: 1.5, icon: "bi-tree-fill", type: "attraction", id: "t_py_1_6", lat: 13.2040, lng: 109.2890 }
          ],
          [
            { time: "08:00", name: "Ngắm bình minh Mũi Điện", cost: 20000, carbon: 1, icon: "bi-tree-fill", type: "attraction", id: "t_py_1_7", lat: 12.8980, lng: 109.4120 }
          ]
        ]
      },
      {
        id: "preset_py_2",
        title: "Tour Phú Yên Gành Đá Đĩa Hoang Sơ 2N1Đ",
        destination: "Phú Yên",
        days: 2,
        cost: 1100000,
        oldCost: 1350000,
        carbon: 25,
        image: "image/15a0c52a7c13e6fb493d5ce4cb1b644b.jpg",
        description: "Khám phá tuyệt tác thiên nhiên Gành Đá Đĩa và nhà thờ cổ Mằng Lăng trong 2 ngày ngắn gọn.",
        data: [
          [
            { time: "08:00", name: "Đón Tuy Hòa đi Nhà thờ Mằng Lăng", cost: 0, carbon: 1.5, icon: "bi-building-fill", type: "attraction", id: "t_py_2_1", lat: 13.3394, lng: 109.2778 },
            { time: "10:30", name: "Tham quan quan Gành Đá Đĩa cổ kính", cost: 40000, carbon: 1.0, icon: "bi-tree-fill", type: "attraction", id: "t_py_2_2", lat: 13.3650, lng: 109.2990 }
          ],
          [
            { time: "09:00", name: "Hải đăng Đại Lãnh hùng vĩ", cost: 20000, carbon: 1.2, icon: "bi-tree-fill", type: "attraction", id: "t_py_2_3", lat: 12.8980, lng: 109.4120 }
          ]
        ]
      },
      {
        id: "preset_py_3",
        title: "Tour Phú Yên Khám Phá Vịnh Vũng Rô 3N2Đ",
        destination: "Phú Yên",
        days: 3,
        cost: 1950000,
        oldCost: 2200000,
        carbon: 40,
        image: "image/phuyen_cover.png",
        description: "Hành trình tìm hiểu lịch sử Vũng Rô tàu Không Số kết hợp lặn ngắm san hô Bãi Môn.",
        data: [
          [
            { time: "09:00", name: "Khu di tích Tàu Không Số Vũng Rô", cost: 0, carbon: 0.8, icon: "bi-building-fill", type: "attraction", id: "t_py_3_1", lat: 12.8680, lng: 109.4125 }
          ],
          [
            { time: "08:00", name: "Lặn ngắm rạn san hô Hòn Yến", cost: 200000, carbon: 0.5, icon: "bi-water", type: "attraction", id: "t_py_3_2", lat: 13.2320, lng: 109.3080 }
          ],
          [
            { time: "10:00", name: "Mua sắm hải sản khô Tuy Hòa", cost: 100000, carbon: 1.0, icon: "bi-shop", type: "dining", id: "t_py_3_3", lat: 13.0885, lng: 109.3000 }
          ]
        ]
      },
      {
        id: "preset_py_4",
        title: "Tour Phú Yên Đất Phú Trời Yên 4N3Đ",
        destination: "Phú Yên",
        days: 4,
        cost: 2990000,
        oldCost: 3500000,
        carbon: 58,
        image: "image/phuyen_cover.png",
        description: "Nghỉ dưỡng bên bờ biển Tuy Hòa trong vắt, thưởng thức mắt cá ngừ đại dương trứ danh.",
        data: [
          [
            { time: "14:00", name: "Nhận phòng Resort Sao Việt sinh thái", cost: 0, carbon: 2.0, icon: "bi-house-door", type: "lodging", id: "t_py_4_1", lat: 13.1360, lng: 109.2995 }
          ],
          [
            { time: "09:00", name: "Tham quan Nhất Tự Sơn con đường đi bộ giữa biển", cost: 50000, carbon: 1.2, icon: "bi-tree-fill", type: "attraction", id: "t_py_4_2", lat: 13.4350, lng: 109.2150 }
          ],
          [
            { time: "08:00", name: "Khám phá Cao nguyên Vân Hòa mát mẻ", cost: 100000, carbon: 2.5, icon: "bi-tree-fill", type: "attraction", id: "t_py_4_3", lat: 13.2330, lng: 109.1200 }
          ],
          [
            { time: "11:30", name: "Thưởng thức Mắt cá ngừ đại dương", cost: 120000, carbon: 3.0, icon: "bi-cup-hot-fill", type: "dining", id: "t_py_4_4", lat: 13.0910, lng: 109.3040 }
          ]
        ]
      },
      {
        id: "preset_dn_1",
        title: "Tour Đà Nẵng Phố Cổ Hội An 3N2Đ",
        destination: "Đà Nẵng - Hội An",
        days: 3,
        cost: 2450000,
        oldCost: 2800000,
        carbon: 32,
        image: "image/danang_cover.png",
        description: "Trải nghiệm thành phố đáng sống kết hợp thả đèn hoa đăng lung linh bên sông Hoài Hội An.",
        data: [
          [
            { time: "08:00", name: "Đón khách từ sân bay Đà Nẵng", cost: 0, carbon: 0.1, icon: "bi-airplane-engines", type: "transport", id: "t_dn_1_1", lat: 16.0470, lng: 108.2060 },
            { time: "10:00", name: "Ghé Bán đảo Sơn Trà - Chùa Linh Ứng", cost: 0, carbon: 1.2, icon: "bi-tree-fill", type: "attraction", id: "t_dn_1_2", lat: 16.1008, lng: 108.2778 }
          ],
          [
            { time: "09:00", name: "Check-in cầu Rồng, Cầu Tình Yêu", cost: 0, carbon: 0.5, icon: "bi-stars", type: "attraction", id: "t_dn_1_3", lat: 16.0610, lng: 108.2268 },
            { time: "16:00", name: "Đi bộ khám phá phố cổ Hội An", cost: 80000, carbon: 0.3, icon: "bi-building-fill", type: "attraction", id: "t_dn_1_4", lat: 15.8770, lng: 108.3270 }
          ],
          [
            { time: "09:00", name: "Mua sắm bánh khô mè tại chợ Cồn", cost: 100000, carbon: 1.0, icon: "bi-shop", type: "dining", id: "t_dn_1_5", lat: 16.0682, lng: 108.2155 }
          ]
        ]
      },
      {
        id: "preset_dn_2",
        title: "Tour Đà Nẵng Ngũ Hành Sơn Kịch Tính 2N1Đ",
        destination: "Đà Nẵng - Hội An",
        days: 2,
        cost: 1150000,
        oldCost: 1400000,
        carbon: 20,
        image: "image/7c9e14a82698a594dd914369bfb8eaa5.jpg",
        description: "Khám phá các hang động thạch nhũ huyền bí tại ngọn Thủy Sơn cổ kính thuộc Ngũ Hành Sơn.",
        data: [
          [
            { time: "08:30", name: "Khám phá hang động Ngũ Hành Sơn", cost: 40000, carbon: 1.8, icon: "bi-tree-fill", type: "attraction", id: "t_dn_2_1", lat: 16.0125, lng: 108.2635 },
            { time: "14:00", name: "Làng đá mỹ nghệ Non Nước", cost: 0, carbon: 0.5, icon: "bi-building-fill", type: "attraction", id: "t_dn_2_2", lat: 16.0100, lng: 108.2660 }
          ],
          [
            { time: "09:00", name: "Tự do tắm biển Non Nước trong xanh", cost: 0, carbon: 0.1, icon: "bi-water", type: "attraction", id: "t_dn_2_3", lat: 16.0180, lng: 108.2750 }
          ]
        ]
      },
      {
        id: "preset_dn_3",
        title: "Tour Đà Nẵng Bà Nà Hill Trọn Gói 4N3Đ",
        destination: "Đà Nẵng - Hội An",
        days: 4,
        cost: 4100000,
        oldCost: 4800000,
        carbon: 50,
        image: "image/da38f44902391ce9a9e4f0fd4b69fb04.jpg",
        description: "Chinh phục kỷ lục cáp treo Bà Nà Hills, dạo bước trên Cầu Vàng sương mù tiên cảnh.",
        data: [
          [
            { time: "14:00", name: "Nhận phòng khách sạn trung tâm Đà Nẵng", cost: 0, carbon: 1.5, icon: "bi-house", type: "lodging", id: "t_dn_3_1", lat: 16.0470, lng: 108.2060 }
          ],
          [
            { time: "08:00", name: "Khu du lịch Bà Nà Hills - Cầu Vàng", cost: 850000, carbon: 4.5, icon: "bi-stars", type: "attraction", id: "t_dn_3_2", lat: 15.9960, lng: 107.9860 }
          ],
          [
            { time: "09:00", name: "Vui chơi tại Công viên suối khoáng nóng núi Thần Tài", cost: 400000, carbon: 1.0, icon: "bi-droplet-fill", type: "attraction", id: "t_dn_3_3", lat: 15.9790, lng: 107.9920 }
          ],
          [
            { time: "09:30", name: "Đi chợ Hàn mua sắm quà lưu niệm", cost: 150000, carbon: 1.2, icon: "bi-shop", type: "dining", id: "t_dn_3_4", lat: 16.0682, lng: 108.2240 }
          ]
        ]
      },
      {
        id: "preset_dn_4",
        title: "Tour Hành Trình Xe Đạp Xanh Đà Nẵng 3N2Đ",
        destination: "Đà Nẵng - Hội An",
        days: 3,
        cost: 1750000,
        oldCost: 2100000,
        carbon: 10,
        image: "image/b025d2b33ebe6db7e576ff3476f9acde.jpg",
        description: "Đạp xe ngắm hoàng hôn dọc bờ biển Mỹ Khê, chèo thuyền thúng bảo tồn sinh thái rừng dừa.",
        data: [
          [
            { time: "08:00", name: "Thuê xe đạp xanh tự hành", cost: 100000, carbon: 0.1, icon: "bi-bicycle", type: "transport", id: "t_dn_4_1", lat: 16.0470, lng: 108.2060 },
            { time: "16:00", name: "Đạp xe ngắm hoàng hôn dọc biển Mỹ Khê", cost: 0, carbon: 0.0, icon: "bi-tree-fill", type: "attraction", id: "t_dn_4_2", lat: 16.0600, lng: 108.2450 }
          ],
          [
            { time: "09:00", name: "Rừng dừa Bảy Mẫu chèo thuyền thúng", cost: 150000, carbon: 0.4, icon: "bi-water", type: "attraction", id: "t_dn_4_3", lat: 15.8900, lng: 108.3750 }
          ],
          [
            { time: "09:00", name: "Lớp học làm gốm Thanh Hà truyền thống", cost: 100000, carbon: 0.8, icon: "bi-people", type: "attraction", id: "t_dn_4_4", lat: 15.8850, lng: 108.3050 }
          ]
        ]
      }
    ];

    for (const tData of defaultTours) {
      await Schedule.create({
        id: tData.id,
        tour_name: tData.title,
        destination: tData.destination,
        days: tData.days,
        discount: 0,
        carbon: tData.carbon,
        image_url: tData.image,
        tour_description: tData.description
      });

      await ScheduleSample.create({
        id: tData.id,
        cost: tData.cost,
        old_cost: tData.oldCost,
        rating: 5.0,
        votes_count: 1
      });

      for (let dayIdx = 0; dayIdx < tData.data.length; dayIdx++) {
        const dayActs = tData.data[dayIdx];
        for (const act of dayActs) {
          await ScheduleActivity.create({
            id: act.id,
            schedule_id: tData.id,
            day_number: dayIdx + 1,
            time: act.time,
            activity_name: act.name,
            activity_cost: act.cost,
            carbon: act.carbon,
            icon: act.icon,
            type: act.type,
            coordinates: `${act.lat}, ${act.lng}`
          });
        }
      }

      await BadgeSchedule.create({ badge_name: 'green', schedule_id: tData.id });
      await BadgeSchedule.create({ badge_name: 'budget', schedule_id: tData.id });
    }

    // 8. Seed GreenServices (Rule: srv_ + số thứ tự)
    console.log('Seeding GreenServices...');
    const greenServices = [
      // Tran Van A's services
      { id: 'srv_par_1', name_service: 'Hồ Xuân Hương', type: 'attraction', cost: 0, destination: 'Đà Lạt', carbon: 1, current_data: { lat: 11.9425, lng: 108.4385, img: 'image/1dc8619487310884c9d631d689ece1e7.jpg', category: 'Khám phá' }, rating: 4.9, bookings_count: 120, vender_id: 'vender_26par01', status: 'active', views_count: 850 },
      { id: 'srv_par_2', name_service: 'Thác Datanla máng trượt', type: 'attraction', cost: 200000, destination: 'Đà Lạt', carbon: 4, current_data: { lat: 11.9015, lng: 108.4485, img: 'image/1dc8619487310884c9d631d689ece1e7.jpg', category: 'Khám phá' }, rating: 4.7, bookings_count: 95, vender_id: 'vender_26par01', status: 'active', views_count: 510 },
      { id: 'srv_par_3', name_service: 'Vườn hoa Thành phố Đà Lạt', type: 'attraction', cost: 50000, destination: 'Đà Lạt', carbon: 1, current_data: { lat: 11.9480, lng: 108.4500, img: 'image/1dc8619487310884c9d631d689ece1e7.jpg', category: 'Khám phá' }, rating: 4.6, bookings_count: 80, vender_id: 'vender_26par01', status: 'active', views_count: 420 },
      { id: 'srv_par_4', name_service: 'Homestay Xanh Đà Lạt', type: 'stay', cost: 850000, destination: 'Đà Lạt', carbon: 2.5, current_data: { lat: 11.9450, lng: 108.4410, img: 'image/1dc8619487310884c9d631d689ece1e7.jpg', category: 'Lưu trú' }, rating: 4.8, bookings_count: 42, vender_id: 'vender_26par01', status: 'active', views_count: 360 },
      
      // Duong's services
      { id: 'srv_duong_1', name_service: 'Homestay Rừng Thông Đèo Cậu', type: 'stay', cost: 800000, destination: 'Đà Lạt', carbon: 5.5, current_data: { lat: 11.9520, lng: 108.4610, img: 'image/1dc8619487310884c9d631d689ece1e7.jpg', category: 'Lưu trú' }, rating: 4.8, bookings_count: 35, vender_id: 'vender_26duo01', status: 'active', views_count: 450 },
      { id: 'srv_duong_2', name_service: 'Bếp Chay Lá Phong', type: 'food', cost: 150000, destination: 'Đà Lạt', carbon: 2.0, current_data: { lat: 11.9412, lng: 108.4430, img: 'image/2eee566424c1f35fbeacf85496b4b6e7.jpg', category: 'Ăn uống' }, rating: 4.9, bookings_count: 55, vender_id: 'vender_26duo01', status: 'active', views_count: 310 },
      { id: 'srv_duong_3', name_service: 'Cắm Trại Đồi Mây Đà Lạt', type: 'attraction', cost: 250000, destination: 'Đà Lạt', carbon: 8.0, current_data: { lat: 11.9620, lng: 108.5300, img: 'image/15a0c52a7c13e6fb493d5ce4cb1b644b.jpg', category: 'Khám phá' }, rating: 4.7, bookings_count: 140, vender_id: 'vender_26duo01', status: 'active', views_count: 2400 },
      { id: 'srv_duong_4', name_service: 'Thuê Xe Đạp Điện Đà Lạt Xanh', type: 'transport', cost: 120000, destination: 'Đà Lạt', carbon: 1.5, current_data: { lat: 11.9423, lng: 108.4360, img: 'image/cb4fbf769d60d911e13c255f7fb39dcc.jpg', category: 'Di chuyển' }, rating: 4.6, bookings_count: 120, vender_id: 'vender_26duo01', status: 'active', views_count: 1500 },
      { id: 'srv_duong_5', name_service: 'Trà Chiều Hữu Cơ Cầu Đất', type: 'food', cost: 95000, destination: 'Đà Lạt', carbon: 2.0, current_data: { lat: 11.9620, lng: 108.5300, img: 'image/e8b896896439701c1ff79d65290703b0.jpg', category: 'Ăn uống' }, rating: 4.5, bookings_count: 15, vender_id: 'vender_26duo01', status: 'inactive', views_count: 1200 }
    ];

    for (const gs of greenServices) {
      await GreenService.create({
        id: gs.id,
        vender_id: gs.vender_id,
        name_service: gs.name_service,
        type: gs.type,
        cost: gs.cost,
        destination: gs.destination,
        carbon: gs.carbon,
        image_url: gs.current_data.img || 'image/Viet Nam.png',
        rating: gs.rating,
        bookings_count: gs.bookings_count,
        current_data: gs.current_data,
        max_capacity: 10,
        status: gs.status,
        views_count: gs.views_count
      });

      await BadgeService.create({ badge_name: 'green', service_id: gs.id });
      if (gs.cost === 0 || gs.cost <= 100000) {
        await BadgeService.create({ badge_name: 'budget', service_id: gs.id });
      }
      if (gs.bookings_count >= 50) {
        await BadgeService.create({ badge_name: 'bestseller', service_id: gs.id });
      }
    }

    // 9. Seed ServiceBookings (Rule: BKG_D_ + số thứ tự)
    console.log('Seeding ServiceBookings...');
    await ServiceBooking.bulkCreate([
      {
        id: 'BKG_D_0001',
        user_id: 'UG26tra0001',
        service_id: 'srv_par_4',
        fullname: 'Nguyễn Minh Anh',
        name_service: 'Homestay Xanh Đà Lạt',
        booking_date: '2026-10-20',
        guests: 2,
        value: 1700000.00,
        status: 'completed',
        votes_count: 1,
        evoucher_code: 'EV-vender-12039',
        escrow_status: 'released'
      },
      {
        id: 'BKG_D_0002',
        user_id: 'UG26tra0001',
        service_id: 'srv_duong_1',
        fullname: 'Nguyễn Minh Anh',
        name_service: 'Homestay Rừng Thông Đèo Cậu',
        booking_date: '2026-07-20',
        guests: 2,
        value: 1600000.00,
        status: 'completed',
        votes_count: 1,
        evoucher_code: 'EV-DUONG-0001',
        escrow_status: 'released'
      },
      {
        id: 'BKG_D_0003',
        user_id: 'UG26tra0001',
        service_id: 'srv_duong_2',
        fullname: 'Nguyễn Minh Anh',
        name_service: 'Bếp Chay Lá Phong',
        booking_date: '2026-07-21',
        guests: 3,
        value: 450000.00,
        status: 'completed',
        votes_count: 1,
        evoucher_code: 'EV-DUONG-0002',
        escrow_status: 'released'
      },
      {
        id: 'BKG_D_0004',
        user_id: 'UG26tra0001',
        service_id: 'srv_duong_1',
        fullname: 'Nguyễn Minh Anh',
        name_service: 'Homestay Rừng Thông Đèo Cậu',
        booking_date: '2026-07-22',
        guests: 1,
        value: 800000.00,
        status: 'pending',
        votes_count: 0,
        evoucher_code: 'EV-DUONG-0003',
        escrow_status: 'holding'
      },
      {
        id: 'BKG_D_0005',
        user_id: 'UG26tra0001',
        service_id: 'srv_duong_3',
        fullname: 'Nguyễn Minh Anh',
        name_service: 'Cắm Trại Đồi Mây Đà Lạt',
        booking_date: '2026-07-23',
        guests: 4,
        value: 1000000.00,
        status: 'completed',
        votes_count: 1,
        evoucher_code: 'EV-DUONG-0004',
        escrow_status: 'released'
      },
      {
        id: 'BKG_D_0006',
        user_id: 'UG26tra0001',
        service_id: 'srv_duong_4',
        fullname: 'Nguyễn Minh Anh',
        name_service: 'Thuê Xe Đạp Điện Đà Lạt Xanh',
        booking_date: '2026-07-25',
        guests: 2,
        value: 240000.00,
        status: 'completed',
        votes_count: 1,
        evoucher_code: 'EV-DUONG-0005',
        escrow_status: 'released'
      },
      {
        id: 'BKG_D_0007',
        user_id: 'UG26tra0001',
        service_id: 'srv_duong_5',
        fullname: 'Nguyễn Minh Anh',
        name_service: 'Trà Chiều Hữu Cơ Cầu Đất',
        booking_date: '2026-07-26',
        guests: 3,
        value: 285000.00,
        status: 'rejected',
        votes_count: 0,
        evoucher_code: 'EV-DUONG-0006',
        escrow_status: 'refunded'
      },
      {
        id: 'BKG_D_0008',
        user_id: 'UG26tra0001',
        service_id: 'srv_duong_1',
        fullname: 'Nguyễn Minh Anh',
        name_service: 'Homestay Rừng Thông Đèo Cậu',
        booking_date: '2026-07-20',
        guests: 2,
        value: 1600000.00,
        status: 'deposit',
        votes_count: 0,
        evoucher_code: 'EV-DUONG-0007',
        escrow_status: 'holding'
      }
    ]);

    // Seed TourBookings (Rule: BKT- + số thứ tự)
    console.log('Seeding TourBookings...');
    await TourBooking.create({
      id: 'BKT-2606010001',
      fullname: 'Nguyễn Minh Anh',
      tour_name: 'Tour Phú Yên Biển Xanh 3N2Đ',
      booking_date: '2026-10-20',
      guests: 2,
      value: 3780000.00,
      payment_method: 'wallet',
      voucher_code: 'GREENSTEPS10',
      evoucher_code: 'EV-5529103948',
      status: 'deposit',
      escrow_status: 'holding'
    });

    // 10. Seed AdCampaigns
    console.log('Seeding AdCampaigns...');
    await AdCampaign.create({
      id: 'ADC0001',
      user_id: 'UG26par0001',
      service_id: 'srv_par_4',
      campaigns_type: 'top_recommend',
      campaigns_name: 'Chiến dịch du lịch mùa hè rực rỡ',
      campaigns_cost: 500000.00,
      duration_days: 30,
      start_date: '2026-06-01',
      end_date: '2026-07-01',
      status: 'active',
      discount_percent: 10
    });

    // 11. Seed Community Posts
    console.log('Seeding Community Posts...');
    await CommunityPost.bulkCreate([
      {
        id: 'CUPtra000101',
        user_id: 'UG26tra0001',
        rating: 5,
        text: 'Chuyến đi Phú Yên 3 ngày 2 đêm của mình siêu xanh và đáng nhớ! Nhờ thuê xe máy điện VinFast dạo quanh Tuy Hòa hết rất ít tiền, lại không ồn ào khói bụi. Các bạn nên ghé qua homestay Hoa Vàng nhé, dịch vụ thân thiện môi trường lắm.',
        tour_name: 'Tour Phú Yên Biển Xanh 3N2Đ',
        destination: 'Phú Yên',
        image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        tour_description: 'Khám phá Phú Yên hoang sơ',
        days: 3,
        likes_count: 24,
        comments_count: 2,
        current_data: { tips: 'Nên đi bãi Xép vào buổi chiều để ngắm hoàng hôn cực đẹp.' }
      },
      {
        id: 'CUPtra000102',
        user_id: 'UG26tra0001',
        rating: 5,
        text: 'Đà Lạt mùa này mát mẻ đẹp lắm các bạn ơi! Mình đã đi tour chinh phục Langbiang bằng xe Jeep xanh và cắm trại qua đêm bên hồ Suối Vàng. Trải nghiệm vô cùng trong lành và thư giãn, giảm thiểu khí thải tuyệt vời!',
        tour_name: 'Chinh phục Langbiang & Thung Lũng Vàng 3N2Đ',
        destination: 'Đà Lạt',
        image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        tour_description: 'Khám phá Langbiang Đà Lạt',
        days: 3,
        likes_count: 45,
        comments_count: 0,
        current_data: { tips: 'Nên mang theo áo ấm dày vì đêm ở hồ Suối Vàng cực lạnh.' }
      }
    ]);

    await CommentPost.create({
      id: 'CEPtra00010002',
      user_id: 'UG26tra0001',
      tour_id: 'preset_dl_1',
      rating: 5,
      text: 'Tour thiết kế rất hợp lý cho gia đình. Bé nhà mình trượt máng Thác Datanla cực kỳ thích. Đồ ăn quán Tao Ngộ ngon miệng.',
      image_url: null
    });

    await CPSS.create({
      comment_id: 'CEPtra00010002',
      schedule_sample_id: 'preset_dl_1'
    });

    // Seed thêm user reviewer phục vụ dữ liệu chăm sóc khách hàng
    console.log('Seeding Reviewer Users...');
    await User.bulkCreate([
      {
        id: 'UG26rv10001',
        role: 'traveler',
        username: 'nguyenvana',
        password_hash: hashedPwd,
        fullname: 'Nguyễn Văn A',
        email: 'nguyenvana.traveler@gmail.com',
        phone: '0911 222 333',
        dob: '1990-03-15',
        gender: 'Nam',
        address: 'Quận 5, TP. Hồ Chí Minh',
        job: 'Kỹ sư phần mềm',
        last_interest: 'Phú Yên'
      },
      {
        id: 'UG26rv10002',
        role: 'traveler',
        username: 'tranthib',
        password_hash: hashedPwd,
        fullname: 'Trần Thị B',
        email: 'tranthib.travel@gmail.com',
        phone: '0922 333 444',
        dob: '1993-07-22',
        gender: 'Nữ',
        address: 'Quận Bình Thạnh, TP. Hồ Chí Minh',
        job: 'Giáo viên',
        last_interest: 'Đà Lạt'
      },
      {
        id: 'UG26rv10003',
        role: 'traveler',
        username: 'lecuong',
        password_hash: hashedPwd,
        fullname: 'Lê Cường',
        email: 'lecuong.travel@gmail.com',
        phone: '0933 444 555',
        dob: '1988-11-08',
        gender: 'Nam',
        address: 'Quận Tân Bình, TP. Hồ Chí Minh',
        job: 'Nhân viên kinh doanh',
        last_interest: 'Đà Lạt'
      },
      {
        id: 'UG26rv10004',
        role: 'traveler',
        username: 'hoanglinh',
        password_hash: hashedPwd,
        fullname: 'Hoàng Thị Linh',
        email: 'hoanglinh.travel@gmail.com',
        phone: '0944 555 666',
        dob: '1997-05-30',
        gender: 'Nữ',
        address: 'Quận 7, TP. Hồ Chí Minh',
        job: 'Marketing',
        last_interest: 'Đà Lạt'
      },
      {
        id: 'UG26rv10005',
        role: 'traveler',
        username: 'phamtuan',
        password_hash: hashedPwd,
        fullname: 'Phạm Minh Tuấn',
        email: 'phamtuan.eco@gmail.com',
        phone: '0955 666 777',
        dob: '1985-09-12',
        gender: 'Nam',
        address: 'Quận 1, TP. Hồ Chí Minh',
        job: 'Bác sĩ',
        last_interest: 'Đà Lạt'
      }
    ]);

    // Tạo ví cho reviewer users
    await Wallet.bulkCreate([
      { id: 'EW26rv10001', user_id: 'UG26rv10001', balance: 2000000.00, registered: true, green_points: 300 },
      { id: 'EW26rv10002', user_id: 'UG26rv10002', balance: 1500000.00, registered: true, green_points: 150 },
      { id: 'EW26rv10003', user_id: 'UG26rv10003', balance: 3000000.00, registered: true, green_points: 80 },
      { id: 'EW26rv10004', user_id: 'UG26rv10004', balance: 2500000.00, registered: true, green_points: 450 },
      { id: 'EW26rv10005', user_id: 'UG26rv10005', balance: 4000000.00, registered: true, green_points: 600 }
    ]);

    // Seed reviews cho dịch vụ của partner (Trần Văn A - vender_26par01)
    console.log('Seeding Service Reviews (CommentPost + CPGS)...');

    // Review 1: Nguyễn Văn A - 5 sao - Homestay Xanh Đà Lạt (srv_par_4)
    await CommentPost.create({
      id: 'CEPser00010001',
      user_id: 'UG26rv10001',
      service_id: 'srv_par_4',
      rating: 5,
      text: 'Gia đình tôi đã có một kỳ nghỉ tuyệt vời với tại Phú Yên. Hướng dẫn viên rất nhiệt tình và am hiểu địa phương. Đồ ăn hải sản tươi ngon. Tuy nhiên, xe đưa đón lúc về hơi chật một chút so với số lượng người. Nhìn chung rất hài lòng!',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPser00010001', service_id: 'srv_par_4' });

    // Review 2: Trần Thị B - 2 sao - Thác Datanla (Khiếu nại)
    await CommentPost.create({
      id: 'CEPser00010002',
      user_id: 'UG26rv10002',
      service_id: 'srv_par_2',
      rating: 2,
      text: 'Hướng dẫn viên đến trễ 30 phút mà không có thông báo trước. Máng trượt phải xếp hàng rất lâu, mặc dù đã đặt trước. Cần cải thiện dịch vụ.',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPser00010002', service_id: 'srv_par_2' });

    // Review 3: Lê Cường - Hỏi hỗ trợ - Homestay Xanh Đà Lạt
    await CommentPost.create({
      id: 'CEPser00010003',
      user_id: 'UG26rv10003',
      service_id: 'srv_par_4',
      rating: 4,
      text: 'Xin hỏi về thực đơn chay cho bữa trưa. Tôi có đặt phòng homestay ngày 25/07, nhưng cần biết trước có thể yêu cầu bữa ăn chay không ạ?',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPser00010003', service_id: 'srv_par_4' });

    // Review 4: Hoàng Thị Linh - 5 sao - Vườn hoa Đà Lạt (srv_par_3)
    await CommentPost.create({
      id: 'CEPser00010004',
      user_id: 'UG26rv10004',
      service_id: 'srv_par_3',
      rating: 5,
      text: 'Vườn hoa mùa này rực rỡ lắm! Chụp ảnh ra rất đẹp. Nhân viên ở đây rất thân thiện và nhiệt tình hướng dẫn. Sẽ quay lại lần tới!',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPser00010004', service_id: 'srv_par_3' });

    // Review 5: Phạm Minh Tuấn - 4 sao - Hồ Xuân Hương (srv_par_1)
    await CommentPost.create({
      id: 'CEPser00010005',
      user_id: 'UG26rv10005',
      service_id: 'srv_par_1',
      rating: 4,
      text: 'Không gian Hồ Xuân Hương rất trong lành và yên tĩnh vào buổi sáng. Thuê thuyền đạp nước cùng gia đình rất vui. Bãi đỗ xe hơi chật nhưng có thể chấp nhận được.',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPser00010005', service_id: 'srv_par_1' });

    // Review 6: Nguyễn Văn A - 3 sao - Thác Datanla (phản hồi thêm)
    await CommentPost.create({
      id: 'CEPser00010006',
      user_id: 'UG26rv10001',
      service_id: 'srv_par_2',
      rating: 3,
      text: 'Thác đẹp nhưng quá đông người. Nên đến sớm hơn vào 8h sáng thay vì buổi trưa để tránh đám đông.',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPser00010006', service_id: 'srv_par_2' });

    // Reviews cho dịch vụ của Dương (vender_26duo01)
    await CommentPost.create({
      id: 'CEPser00020001',
      user_id: 'UG26tra0001',
      service_id: 'srv_duong_3',
      rating: 5,
      text: 'Cắm trại đêm trên đồi mây cực kỳ lãng mạn! Nhìn thấy sao trời từ lều trại, không khí trong lành tuyệt vời. Chủ cắm trại chuẩn bị đồ ăn và lửa trại chu đáo. Trải nghiệm không thể quên!',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPser00020001', service_id: 'srv_duong_3' });

    await CommentPost.create({
      id: 'CEPser00020002',
      user_id: 'UG26rv10002',
      service_id: 'srv_duong_2',
      rating: 5,
      text: 'Bếp chay ở đây ngon không tưởng! Tôi không nghĩ ăn chay lại có thể ngon đến vậy. Nguyên liệu hoàn toàn hữu cơ từ vườn, không có chất bảo quản. Rất phù hợp với lối sống xanh!',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPser00020002', service_id: 'srv_duong_2' });

    // Review của traveler cho srv_par_4 (đã seed ở trên, giờ thêm CPGS)
    await CommentPost.create({
      id: 'CEPtra00010001',
      user_id: 'UG26tra0001',
      service_id: 'srv_par_4',
      rating: 5,
      text: 'Homestay sạch sẽ, không gian ngập tràn cây xanh mát mẻ. Chủ nhà thân thiện và chuẩn bị nước trà Atiso rất thơm ngon.',
      image_url: null
    });
    await CPGS.create({ comment_id: 'CEPtra00010001', service_id: 'srv_par_4' });

    // 12. Seed Custom Itinerary
    console.log('Seeding Active Custom Itinerary...');
    await Schedule.create({
      id: 'iti_1782683051702',
      tour_name: 'Hành trình Đà Lạt Xanh của Minh Anh',
      destination: 'Đà Lạt',
      days: 3,
      discount: 0,
      carbon: 4.0,
      image_url: 'image/1dc8619487310884c9d631d689ece1e7.jpg',
      tour_description: 'Lịch trình tự thiết kế đi Đà Lạt 3 ngày tối ưu phát thải CO2.'
    });

    await ScheduleCustom.create({
      id: 'iti_1782683051702',
      user_id: 'UG26tra0001',
      total_cost: 150000.00
    });

    await ScheduleActivity.bulkCreate([
      {
        id: 'act_1782683051702_1',
        schedule_id: 'iti_1782683051702',
        day_number: 1,
        time: '09:00',
        activity_name: 'Hồ Xuân Hương',
        activity_cost: 0,
        carbon: 1.0,
        icon: 'bi-tree-fill',
        type: 'attraction',
        coordinates: '11.9425, 108.4385'
      },
      {
        id: 'act_1782683051702_2',
        schedule_id: 'iti_1782683051702',
        day_number: 1,
        time: '12:00',
        activity_name: 'Lẩu bò Ba Toa quán gỗ',
        activity_cost: 150000,
        carbon: 3.0,
        icon: 'bi-cup-hot-fill',
        type: 'dining',
        coordinates: '11.9325, 108.4452'
      }
    ]);

    // 13. Seed Vouchers
    console.log('Seeding Commercial Vouchers...');
    await Voucher.bulkCreate([
      { id: 'VOU_GS_10', code: 'GREENSTEPS10', discount_percent: 10, status: 'active', user_id: 'UG26tra0001' },
      { id: 'VOU_ES_15', code: 'ECOSUMMER15', discount_percent: 15, status: 'active', user_id: 'UG26tra0001' },
      { id: 'VOU_OLD_01', code: 'PROMOOLD50', discount_percent: 50, status: 'used', user_id: 'UG26tra0001' }
    ]);

    // 14. Seed FAQs
    console.log('Seeding FAQs...');
    await FAQ.bulkCreate([
      {
        id: 'faq_1',
        question: 'GreenSteps là gì?',
        answer: 'GreenSteps là nền tảng du lịch sinh thái thông minh, hỗ trợ du khách tự thiết kế lịch trình cá nhân hóa, đo lường chỉ số carbon và tối ưu hóa chi phí di chuyển thân thiện với môi trường.'
      },
      {
        id: 'faq_2',
        question: 'Làm thế nào để tích lũy điểm xanh?',
        answer: 'Bạn sẽ tự động tích lũy Điểm thưởng xanh (Green Points) sau khi hoàn tất các dịch vụ du lịch sinh thái và được nhà cung cấp check-in thành công. Số điểm thưởng bằng Lượng carbon giảm thiểu (kg) nhân với 10.'
      },
      {
        id: 'faq_3',
        question: 'Tôi có thể đổi điểm xanh lấy gì?',
        answer: 'Bạn có thể sử dụng Điểm xanh tích lũy trong ví để đổi lấy các Voucher giảm giá 10% áp dụng trực tiếp khi thanh toán các dịch vụ du lịch tiếp theo (1000 điểm xanh đổi được 1 voucher giảm 10%).'
      },
      {
        id: 'faq_4',
        question: 'Ví tạm giữ Escrow hoạt động thế nào?',
        answer: 'Khi bạn đặt dịch vụ, số tiền cọc sẽ được giữ an toàn trong ví tạm giữ của sàn. Tiền chỉ được chuyển cho đối tác sau khi bạn đến check-in thành công tại quầy bằng mã E-Voucher du lịch. Nếu bạn hủy đơn trước hạn, bạn sẽ được hoàn trả 100% tiền cọc.'
      }
    ]);

    console.log('All realistic seed data inserted successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
