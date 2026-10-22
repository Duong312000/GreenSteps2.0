const express = require('express');
const router = express.Router();
const { Schedule } = require('../models');

// 1. Lấy chi tiết lịch trình theo ID
router.get('/:id', async (req, res) => {
  try {
    const iti = await Schedule.findById(req.params.id);
    if (!iti) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình.' });
    }

    // Tổ chức mảng daysData theo định dạng ngày mà frontend schedule-editor.ts mong muốn
    const daysData = Array.from({ length: iti.days }, () => []);
    iti.activities.forEach(act => {
      const dayIdx = (act.day_number || 1) - 1;
      if (dayIdx >= 0 && dayIdx < iti.days) {
        daysData[dayIdx].push({
          id: act._id,
          time: act.time,
          name: act.name,
          cost: act.cost,
          carbon: act.carbon,
          type: act.type,
          service_id: act.service_id,
          coordinates: act.coordinates,
          is_shared: act.is_shared
        });
      }
    });

    return res.json({
      id: iti._id,
      _id: iti._id,
      name: iti.tour_name,
      destination: iti.destination,
      days: iti.days,
      totalCost: iti.total_cost,
      totalCarbon: iti.total_carbon,
      daysData,
      activities: iti.activities,
      user_id: iti.owner_id
    });
  } catch (error) {
    console.error('Get itinerary error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải lịch trình.' });
  }
});

// 2. Lưu hoặc cập nhật lịch trình
router.post('/', async (req, res) => {
  try {
    const { id, _id, name, destination, days, totalCost, totalCarbon, daysData, user_id, activities } = req.body;
    const targetId = id || _id;

    // Chuyển daysData (mảng 2 chiều theo ngày) sang danh sách activities phẳng
    let flatActivities = activities || [];
    if (daysData && Array.isArray(daysData)) {
      flatActivities = [];
      daysData.forEach((dayActs, dayIdx) => {
        if (Array.isArray(dayActs)) {
          dayActs.forEach(act => {
            flatActivities.push({
              day_number: dayIdx + 1,
              time: act.time || '08:00',
              name: act.name || 'Hoạt động',
              cost: Number(act.cost) || 0,
              carbon: Number(act.carbon) || 0,
              type: act.type || 'attraction',
              service_id: act.service_id || null,
              coordinates: act.coordinates || { lat: 0, lng: 0 },
              is_shared: !!act.is_shared
            });
          });
        }
      });
    }

    let schedule = null;
    if (targetId && targetId.toString().length === 24) {
      schedule = await Schedule.findById(targetId);
    }

    if (schedule) {
      if (name) schedule.tour_name = name;
      if (destination) schedule.destination = destination;
      if (days) schedule.days = Number(days);
      schedule.total_cost = Number(totalCost) || 0;
      schedule.total_carbon = Number(totalCarbon) || 0;
      schedule.activities = flatActivities;
      await schedule.save();
    } else {
      schedule = new Schedule({
        owner_id: user_id && user_id.length === 24 ? user_id : null,
        tour_name: name || `Lịch trình tự thiết kế ${destination || ''}`,
        destination: destination || 'Đà Lạt',
        days: Number(days) || 1,
        total_cost: Number(totalCost) || 0,
        total_carbon: Number(totalCarbon) || 0,
        is_sample: false,
        activities: flatActivities
      });
      await schedule.save();
    }

    return res.json({
      success: true,
      message: 'Lưu lịch trình thành công!',
      itinerary: {
        id: schedule._id,
        _id: schedule._id,
        name: schedule.tour_name,
        destination: schedule.destination,
        days: schedule.days,
        totalCost: schedule.total_cost,
        totalCarbon: schedule.total_carbon
      }
    });
  } catch (error) {
    console.error('Save itinerary error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lưu lịch trình.' });
  }
});

module.exports = router;
