const { Notification } = require('../models/index');

exports.getNotifications = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const list = await Notification.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']]
    });
    res.json(list);
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
    notif.read = true;
    await notif.save();
    res.json({ success: true, message: 'Đã đánh dấu đọc thông báo!' });
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
