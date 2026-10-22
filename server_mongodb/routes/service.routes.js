const express = require('express');
const router = express.Router();
const { Service } = require('../models');

// 1. Lấy danh sách dịch vụ (Hỗ trợ lọc theo loại, điểm đến, tìm kiếm)
router.get('/', async (req, res) => {
  try {
    const { type, dest, destination, search, minCost, maxCost } = req.query;
    const filter = { status: 'active' };

    if (type && type !== 'all') {
      filter.type = type;
    }

    const targetDest = dest || destination;
    if (targetDest && targetDest !== 'all') {
      filter.destination = new RegExp(targetDest, 'i');
    }

    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { destination: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    if (minCost || maxCost) {
      filter.cost = {};
      if (minCost) filter.cost.$gte = Number(minCost);
      if (maxCost) filter.cost.$lte = Number(maxCost);
    }

    const services = await Service.find(filter).sort({ rating: -1, created_at: -1 });

    // Format dữ liệu tương thích ngược cho frontend models.ts
    const mapped = services.map(s => ({
      id: s._id,
      _id: s._id,
      name: s.name,
      name_service: s.name,
      type: s.type,
      cost: s.cost,
      destination: s.destination,
      carbon: s.carbon,
      image: s.images && s.images[0] ? s.images[0] : '',
      image_url: s.images && s.images[0] ? s.images[0] : '',
      images: s.images,
      rating: s.rating,
      bookings_count: s.bookings_count,
      amenities: s.amenities,
      description: s.description,
      badges: s.badges
    }));

    return res.json(mapped);
  } catch (error) {
    console.error('Get services error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi tải danh sách dịch vụ.' });
  }
});

// 2. Lấy chi tiết một dịch vụ theo ID
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate('provider_id');
    if (!service) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ.' });
    }

    return res.json({
      id: service._id,
      _id: service._id,
      name: service.name,
      name_service: service.name,
      type: service.type,
      cost: service.cost,
      destination: service.destination,
      address: service.address,
      location: service.location,
      carbon: service.carbon,
      capacity: service.capacity,
      image: service.images && service.images[0] ? service.images[0] : '',
      images: service.images,
      rating: service.rating,
      reviews_count: service.reviews_count,
      bookings_count: service.bookings_count,
      amenities: service.amenities,
      description: service.description,
      green_criteria: service.green_criteria,
      badges: service.badges
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết dịch vụ.' });
  }
});

// 3. Thêm mới một dịch vụ (HTTP POST - Chuẩn Chương VII Slide 66)
router.post('/', async (req, res) => {
  try {
    const serviceData = req.body;
    const service = new Service(serviceData);
    await service.save();
    return res.status(201).json({ success: true, message: 'Thêm mới dịch vụ thành công!', service });
  } catch (error) {
    console.error('Create service error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi thêm mới dịch vụ.' });
  }
});

// 4. Cập nhật một dịch vụ (HTTP PUT - Chuẩn Chương VII Slide 81)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Service.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ để cập nhật.' });
    }
    return res.json({ success: true, message: 'Cập nhật dịch vụ thành công!', service: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật dịch vụ.' });
  }
});

// 5. Xóa một dịch vụ (HTTP DELETE - Chuẩn Chương VII Slide 93)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Service.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ để xóa.' });
    }
    return res.json({ success: true, message: 'Đã xóa dịch vụ thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa dịch vụ.' });
  }
});

module.exports = router;
