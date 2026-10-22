const express = require('express');
const router = express.Router();
const { Schedule } = require('../models');

// 1. Lấy danh sách Tour trọn gói mẫu
router.get('/', async (req, res) => {
  try {
    const { destination, days, search } = req.query;
    const filter = { is_sample: true };

    if (destination && destination !== 'all') {
      filter.destination = new RegExp(destination, 'i');
    }

    if (days) {
      filter.days = Number(days);
    }

    if (search) {
      filter.$or = [
        { tour_name: new RegExp(search, 'i') },
        { destination: new RegExp(search, 'i') }
      ];
    }

    const tours = await Schedule.find(filter).sort({ 'sample_details.rating': -1, created_at: -1 });

    const mapped = tours.map(t => ({
      id: t._id,
      _id: t._id,
      title: t.tour_name,
      tour_name: t.tour_name,
      destination: t.destination,
      days: t.days,
      cost: t.total_cost,
      oldCost: t.sample_details.old_cost,
      old_cost: t.sample_details.old_cost,
      carbon: t.total_carbon,
      rating: t.sample_details.rating,
      votes_count: t.sample_details.votes_count,
      image: t.sample_details.image_url,
      image_url: t.sample_details.image_url,
      tour_description: t.sample_details.tour_description,
      activities: t.activities
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('Get tours error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải danh sách tour.' });
  }
});

// 2. Chi tiết một Tour theo ID
router.get('/:id', async (req, res) => {
  try {
    const tour = await Schedule.findById(req.params.id);
    if (!tour) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tour.' });
    }

    return res.json({
      id: tour._id,
      _id: tour._id,
      title: tour.tour_name,
      tour_name: tour.tour_name,
      destination: tour.destination,
      days: tour.days,
      cost: tour.total_cost,
      oldCost: tour.sample_details.old_cost,
      old_cost: tour.sample_details.old_cost,
      carbon: tour.total_carbon,
      rating: tour.sample_details.rating,
      votes_count: tour.sample_details.votes_count,
      image: tour.sample_details.image_url,
      image_url: tour.sample_details.image_url,
      tour_description: tour.sample_details.tour_description,
      activities: tour.activities
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết tour.' });
  }
});

module.exports = router;
