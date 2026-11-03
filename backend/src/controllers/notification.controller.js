const { Notification } = require('../models/index');

exports.getNotifications = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const list = await Notification.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']]
    });
    const mapped = list.map(item => {
      const row = item.toJSON();
      return { ...row, link: row.link || row.link_url || null, createdAt: row.createdAt || row.created_at };
    });
    const staleQrNotices = mapped.filter(item => {
      const text = `${item.title || ''} ${item.message || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return item.type === 'booking'
        && /cho duyet giao dich|cho quan tri vien phe duyet/.test(text)
        && /qr|chuyen khoan/.test(text);
    });
    if (staleQrNotices.length) {
      await Promise.all(staleQrNotices.map(item => Notification.destroy({ where: { id: item.id, user_id: userId } })));
    }
    res.json(mapped.filter(item => !staleQrNotices.some(stale => stale.id === item.id)));
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  const { id } = req.params;
  try {
    const notif = await Notification.findByPk(id);
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo!' });
    }
    if (req.user && notif.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật thông báo này.' });
    }
    notif.read = true;
    await notif.save();
    res.json({ success: true, message: 'Đã đánh dấu đọc thông báo!' });
  } catch (error) {
    next(error);
  }
};

exports.deleteNotification = async (req, res, next) => {
  const { id } = req.params;
  try {
    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found.' });
    if (req.user && notif.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    await notif.destroy();
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  const { userId } = req.params;
  try {
    await Notification.update({ read: true }, { where: { user_id: userId } });
    res.json({ success: true, message: 'Đã đánh dấu đọc tất cả thông báo!' });
  } catch (error) {
    next(error);
  }
};

exports.clearNotifications = async (req, res, next) => {
  const { userId } = req.params;
  try {
    await Notification.destroy({ where: { user_id: userId } });
    res.json({ success: true, message: 'Đã xóa tất cả thông báo!' });
  } catch (error) {
    next(error);
  }
};
