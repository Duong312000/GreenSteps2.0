const express = require('express');
const router = express.Router();
const { Service, Schedule } = require('../models');

// POST /api/ai/plan-trip - AI Travel Planner: Tạo lịch trình xanh cá nhân hoá
router.post('/plan-trip', async (req, res) => {
  try {
    const {
      destination = 'Đà Lạt',
      days = 3,
      budget_level = 'standard', // eco, standard, luxury
      travel_style = 'eco',      // eco, adventure, relax, culture
      interests = ['thiên nhiên', 'ẩm thực xanh', 'xe điện']
    } = req.body;

    const numDays = Math.min(Math.max(parseInt(days) || 3, 1), 7);

    // Lấy các dịch vụ có sẵn trong CSDL theo điểm đến để nhúng vào lịch trình
    const matchedServices = await Service.find({
      $or: [
        { destination: new RegExp(destination, 'i') },
        { location: new RegExp(destination, 'i') }
      ],
      is_eco_certified: true
    }).limit(10);

    // Xây dựng lịch trình sinh thái thông minh theo ngày
    const daysPlan = [];
    const activitiesPool = [
      {
        time: '08:00 - 11:30',
        title: `Khám phá rừng nguyên sinh & văn hóa bản địa ${destination}`,
        type: 'activity',
        co2_saved_kg: 8.5,
        desc: 'Trekking nhẹ nhàng dưới tán rừng, lắng nghe hướng dẫn viên địa phương giới thiệu về hệ sinh thái và bảo tồn đa dạng sinh học.',
        cost: 250000
      },
      {
        time: '12:00 - 13:30',
        title: 'Bữa trưa Farm-to-Table tại Nông trại hữu cơ',
        type: 'dining',
        co2_saved_kg: 3.2,
        desc: 'Thưởng thức ẩm thực hữu cơ chế biến từ rau củ quả thu hoạch trực tiếp tại vườn, nói không với bao bì nhựa một lần.',
        cost: 150000
      },
      {
        time: '14:30 - 17:00',
        title: 'Trải nghiệm chèo SUP / Đạp xe khám phá vùng ngoại ô',
        type: 'transport',
        co2_saved_kg: 6.0,
        desc: 'Di chuyển bằng xe đạp thể thao hoặc chèo SUP ngắm hoàng hôn, rèn luyện sức khoẻ và không xả khí thải.',
        cost: 200000
      },
      {
        time: '18:30 - 21:00',
        title: 'Thưởng trà thảo mộc & Giao lưu cộng đồng xanh',
        type: 'leisure',
        co2_saved_kg: 1.5,
        desc: 'Giao lưu văn hoá với đồng bào địa phương bên bếp lửa không khói, thưởng thức đặc sản trà bản địa.',
        cost: 100000
      }
    ];

    let totalEstimatedCost = 0;
    let totalCo2Saved = 0;

    for (let dayIndex = 1; dayIndex <= numDays; dayIndex++) {
      const dayActivities = activitiesPool.map((act, idx) => {
        const itemCost = act.cost * (budget_level === 'luxury' ? 1.8 : budget_level === 'eco' ? 0.75 : 1.0);
        totalEstimatedCost += Math.round(itemCost);
        totalCo2Saved += act.co2_saved_kg;
        return {
          id: `d${dayIndex}_a${idx + 1}`,
          time: act.time,
          title: `[Ngày ${dayIndex}] ${act.title}`,
          type: act.type,
          description: act.desc,
          estimated_cost: Math.round(itemCost),
          co2_saved_kg: act.co2_saved_kg,
          eco_badge: 'GreenSteps Verified'
        };
      });

      daysPlan.push({
        day_number: dayIndex,
        title: `Ngày ${dayIndex}: Hòa mình cùng thiên nhiên ${destination}`,
        activities: dayActivities
      });
    }

    // Gợi ý chỗ ở homestay sinh thái
    const suggestedStays = matchedServices.filter(s => s.service_type === 'stay').slice(0, 3);

    res.json({
      success: true,
      data: {
        destination,
        days: numDays,
        budget_level,
        travel_style,
        summary: `Lịch trình sinh thái ${numDays} ngày tại ${destination} được thiết kế đặc biệt nhằm tối ưu trải nghiệm và giảm thiểu tối đa dấu chân carbon.`,
        days_plan: daysPlan,
        total_estimated_cost: totalEstimatedCost,
        total_co2_saved_kg: Math.round(totalCo2Saved * 10) / 10,
        green_points_earned: Math.round(totalCo2Saved * 10),
        recommended_services: matchedServices.slice(0, 4),
        suggested_stays: suggestedStays
      }
    });
  } catch (error) {
    console.error('Error in POST /ai/plan-trip:', error);
    res.status(500).json({ success: false, message: 'Lỗi lập lịch trình AI', error: error.message });
  }
});

// POST /api/ai/estimate-carbon - Tính toán lượng giảm phát thải CO2 so sánh với du lịch thông thường
router.post('/estimate-carbon', (req, res) => {
  try {
    const { distance_km = 100, passengers = 1, days = 3, transport_type = 'electric_vehicle' } = req.body;

    // Hệ số phát thải CO2 (kg CO2 / km / người)
    // Xe xăng thông thường: ~0.19 kg/km
    // Xe điện VinFast: ~0.04 kg/km (giảm 79%)
    // Xe đạp / đi bộ: 0 kg/km
    // Khách sạn thường: ~28 kg/ngày/phòng
    // Eco-homestay: ~8 kg/ngày/phòng (giảm 71%)

    const dist = Number(distance_km);
    const numPass = Number(passengers);
    const numDays = Number(days);

    const conventionalTransportCO2 = dist * 0.192 * numPass;
    const ecoTransportCO2 = transport_type === 'bike' ? 0 : dist * 0.045 * numPass;
    const transportSaved = Math.max(0, conventionalTransportCO2 - ecoTransportCO2);

    const conventionalHotelCO2 = numDays * 28.5;
    const ecoHotelCO2 = numDays * 8.2;
    const hotelSaved = conventionalHotelCO2 - ecoHotelCO2;

    const totalSavedKg = Math.round((transportSaved + hotelSaved) * 10) / 10;
    const equivalentTreesPlanted = Math.round((totalSavedKg / 22) * 10) / 10; // 1 cây hấp thụ ~22kg CO2/năm

    res.json({
      success: true,
      data: {
        distance_km: dist,
        passengers: numPass,
        days: numDays,
        conventional_co2_kg: Math.round((conventionalTransportCO2 + conventionalHotelCO2) * 10) / 10,
        greensteps_co2_kg: Math.round((ecoTransportCO2 + ecoHotelCO2) * 10) / 10,
        co2_saved_kg: totalSavedKg,
        equivalent_trees_planted: equivalentTreesPlanted,
        percent_reduced: Math.round((totalSavedKg / (conventionalTransportCO2 + conventionalHotelCO2)) * 100),
        green_points_bonus: Math.round(totalSavedKg * 10)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi tính toán carbon', error: error.message });
  }
});

// GET /api/ai/recommendations - Đề xuất tour & dịch vụ phù hợp nhất
router.get('/recommendations', async (req, res) => {
  try {
    const popularTours = await Schedule.find({ is_preset_tour: true })
      .populate('provider_id', 'business_name')
      .limit(4);

    const ecoServices = await Service.find({ is_eco_certified: true })
      .limit(6);

    res.json({
      success: true,
      data: {
        recommended_tours: popularTours,
        eco_services: ecoServices,
        trending_destinations: [
          { name: 'Đà Lạt', title: 'Thành phố ngàn hoa Net-Zero', image: '/images/destinations/dalat.jpg' },
          { name: 'Phú Yên', title: 'Xứ sở hoa vàng cỏ xanh', image: '/images/destinations/phuyen.jpg' },
          { name: 'Hội An', title: 'Phố cổ xanh không rác nhựa', image: '/images/destinations/hoian.jpg' }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

module.exports = router;
