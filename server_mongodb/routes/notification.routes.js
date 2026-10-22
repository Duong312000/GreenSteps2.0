const express = require('express');
const router = express.Router();
const { Notification } = require('../models');

// GET /api/notifications - Lấy thông báo của người dùng
router.get('/', async (req, res) => {
  try {
    const currentUserId = req.session?.user?.id || req.query.user_id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để xem thông báo' });
    }

    const { unread_only, limit = 30 } = req.query;
    const filter = { user_id: currentUserId };
    if (unread_only === 'true') {
      filter.read = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ user_id: currentUserId, read: false });

    res.json({
      success: true,
      data: notifications,
      unread_count: unreadCount
    });
  } catch (error) {
    console.error('Error in GET /notifications:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// PUT /api/notifications/:id/read - Đánh dấu 1 thông báo là đã đọc
router.put('/:id/read', async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }
    res.json({ success: true, message: 'Đã đánh dấu đã đọc', data: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// PUT /api/notifications/read-all - Đánh dấu tất cả thông báo của user là đã đọc
router.put('/read-all', async (req, res) => {
  try {
    const currentUserId = req.session?.user?.id || req.body.user_id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    await Notification.updateMany(
      { user_id: currentUserId, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, message: 'Tất cả thông báo đã được đánh dấu đã đọc' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// POST /api/notifications - Tạo thông báo mới (Admin / Hệ thống)
router.post('/', async (req, res) => {
  try {
    const { user_id, title, message, type, link_url } = req.body;
    if (!user_id || !title || !message) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin người nhận, tiêu đề hoặc nội dung' });
    }

    const notif = new Notification({
      user_id,
      title,
      message,
      type: type || 'system',
      link_url: link_url || ''
    });

    await notif.save();
    res.status(201).json({ success: true, message: 'Tạo thông báo thành công', data: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

// DELETE /api/notifications/:id - Xoá thông báo
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }
    res.json({ success: true, message: 'Đã xoá thông báo' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
});

module.exports = router;
