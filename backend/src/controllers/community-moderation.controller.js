const { createHash } = require('node:crypto');
const { randomUUID } = require('node:crypto');
const { store, CommunityPost, CommentPost, CommunityReport, User, Notification } = require('../models');

const standards = [
  { id: 'harassment', title: 'Tôn trọng mọi người', description: 'Không xúc phạm, bắt nạt, đe dọa hoặc công kích cá nhân.' },
  { id: 'hate', title: 'Không kích động thù ghét', description: 'Không kỳ thị hoặc kích động bạo lực nhắm vào cá nhân và cộng đồng.' },
  { id: 'violence', title: 'Không đăng nội dung bạo lực hoặc tình dục', description: 'Không chia sẻ nội dung tình dục, hình ảnh bạo lực gây sốc hoặc nội dung gây hại cho trẻ em.' },
  { id: 'scam', title: 'Trung thực và an toàn', description: 'Không lừa đảo, giả mạo, phát tán liên kết độc hại hoặc thông tin gây hiểu lầm.' },
  { id: 'spam', title: 'Không spam, quảng cáo tràn lan', description: 'Không đăng lặp lại, câu tương tác hoặc quảng cáo không liên quan đến du lịch.' },
  { id: 'privacy', title: 'Tôn trọng quyền riêng tư và bản quyền', description: 'Không công khai thông tin cá nhân của người khác hoặc sử dụng nội dung khi chưa có quyền.' },
  { id: 'environment', title: 'Du lịch có trách nhiệm', description: 'Không cổ vũ phá hoại thiên nhiên, ngược đãi động vật hoặc xâm phạm văn hóa địa phương.' },
  { id: 'other', title: 'Vi phạm khác', description: 'Mô tả rõ nội dung cần được quản trị viên xem xét.' }
];
exports.getStandards = (_req, res) => res.json(standards);
const modelFor = type => type === 'post' ? CommunityPost : type === 'comment' ? CommentPost : null;

exports.report = async (req, res, next) => {
  try {
    const { targetType, targetId, reason } = req.body;
    const details = String(req.body.details || '').trim();
    const Model = modelFor(targetType);
    if (!Model || typeof targetId !== 'string' || !targetId || !standards.some(s => s.id === reason) || details.length > 1000 || (reason === 'other' && details.length < 10)) {
      return res.status(400).json({ message: 'Chọn lý do hợp lệ; mô tả tối đa 1.000 ký tự, lý do khác cần ít nhất 10 ký tự.' });
    }
    const target = await Model.findByPk(targetId);
    if (!target || target.moderation_status === 'hidden' || (targetType === 'comment' && !target.post_id)) return res.status(404).json({ message: 'Nội dung không còn khả dụng.' });
    if (targetType === 'comment') {
      const post = await CommunityPost.findByPk(target.post_id);
      if (!post || post.moderation_status === 'hidden') return res.status(404).json({ message: 'Nội dung không còn khả dụng.' });
    }
    if (target.user_id === req.user.id) return res.status(400).json({ message: 'Bạn không thể báo cáo nội dung của mình.' });
    const id = createHash('sha256').update(JSON.stringify([req.user.id, targetType, targetId])).digest('hex');
    const [report, created] = await CommunityReport.findOrCreate({ where: { id }, defaults: {
      id, reporter_id: req.user.id, target_type: targetType, target_id: targetId, reason, details, snapshot: target.text, status: 'pending'
    } });
    res.status(created ? 201 : 200).json({ success: true, duplicate: !created, status: report.status, message: created ? 'Đã gửi báo cáo. Quản trị viên sẽ xem xét nội dung.' : 'Bạn đã báo cáo nội dung này trước đó.' });
  } catch (error) { next(error); }
};

exports.listReports = async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const reports = await CommunityReport.findAll({ order: [['createdAt', 'DESC']] });
    res.json(await Promise.all(reports.map(async r => {
      const target = await modelFor(r.target_type).findByPk(r.target_id);
      const author = target && await User.findByPk(target.user_id);
      return { id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason,
        reasonLabel: standards.find(s => s.id === r.reason)?.title || r.reason, details: r.details,
        text: target?.text || r.snapshot, snapshot: r.snapshot, images: target?.image_urls?.length ? target.image_urls : target?.image_url ? [target.image_url] : [], video: target?.video_url || '',
        author: author?.fullname || author?.username || 'Thành viên', status: r.status, hidden: target?.moderation_status === 'hidden',
        deleted: !target, createdAt: r.createdAt, reviewedAt: r.reviewed_at, reviewNote: r.review_note, history: r.history || [] };
    })));
  } catch (error) { next(error); }
};

exports.review = async (req, res, next) => {
  const action = req.body.action;
  const note = String(req.body.note || '').trim();
  if (!['hide', 'dismiss', 'restore'].includes(action) || note.length < 5 || note.length > 1000) return res.status(400).json({ message: 'Chọn quyết định và nhập lý do từ 5 đến 1.000 ký tự.' });
  let tx;
  try {
    tx = await store.transaction();
    const report = await CommunityReport.findByPk(req.params.id, { transaction: tx });
    if (!report) { await tx.rollback(); return res.status(404).json({ message: 'Không tìm thấy báo cáo.' }); }
    const Model = modelFor(report.target_type);
    const target = await Model.findByPk(report.target_id, { transaction: tx });
    if (action !== 'dismiss' && !target) { await tx.rollback(); return res.status(404).json({ message: 'Nội dung đã bị tác giả xóa.' }); }
    if (action === 'restore' && target.moderation_status !== 'hidden') { await tx.rollback(); return res.status(409).json({ message: 'Nội dung hiện không bị ẩn.' }); }
    if (action === 'dismiss' && report.status !== 'pending') { await tx.rollback(); return res.status(409).json({ message: 'Báo cáo đã được xử lý. Vui lòng tải lại danh sách.' }); }
    if (action !== 'dismiss') {
      target.moderation_status = action === 'hide' ? 'hidden' : 'visible';
      // Legacy posts may predate these required fields.
      if (report.target_type === 'post' && !target.post_type) target.post_type = 'post';
      await target.save({ transaction: tx });
    }
    const related = action === 'dismiss' ? [report] : await CommunityReport.findAll({ where: { target_type: report.target_type, target_id: report.target_id }, transaction: tx });
    for (const row of related) {
      row.status = action === 'hide' ? 'hidden' : action === 'restore' ? 'restored' : 'dismissed';
      row.reviewed_by = req.user.id; row.reviewed_at = new Date(); row.review_note = note;
      row.history = [...(row.history || []), { action, note, adminId: req.user.id, at: new Date().toISOString() }];
      await row.save({ transaction: tx });
    }
    if (action !== 'dismiss' && target.user_id) await Notification.create({
      id: `notif_${randomUUID()}`, user_id: target.user_id, type: 'community', read: false,
      title: action === 'hide' ? 'Nội dung đã bị ẩn' : 'Nội dung đã được khôi phục',
      message: `${report.target_type === 'post' ? 'Bài viết' : 'Bình luận'} của bạn ${action === 'hide' ? 'đã bị ẩn theo tiêu chuẩn cộng đồng' : 'đã được khôi phục'}. Lý do: ${note}`
    }, { transaction: tx });
    await tx.commit();
    res.json({ success: true });
  } catch (error) { if (tx && !tx.finished) await tx.rollback(); next(error); }
};
