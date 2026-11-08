const router = require('express').Router();
const { authMiddleware, checkRole } = require('../middlewares/auth.middleware');
const { GreenService, ScheduleSample, Schedule, PartnerCampaign, ServiceBooking, TourBooking } = require('../models');

// Read the same collections used by the customer and partner APIs.
router.get('/catalog/:kind', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    let rows;
    switch (req.params.kind) {
      case 'services':
        rows = (await GreenService.findAll()).map(s => ({ id: s.id, name: s.name_service, detail: s.destination, type: s.type, value: s.cost, status: s.status, createdAt: s.createdAt }));
        break;
      case 'tours':
        rows = (await ScheduleSample.findAll({ include: [{ model: Schedule }] })).map(t => ({ id: t.id, name: t.Schedule?.tour_name, detail: t.Schedule?.destination, value: t.cost, createdAt: t.createdAt }));
        break;
      case 'promotions':
        rows = (await PartnerCampaign.findAll()).map(p => ({ id: p.id, name: p.name, detail: [p.type, p.code].filter(Boolean).join(' · '), status: p.status, start_at: p.start_at, end_at: p.end_at, discount_type: p.discount_type, discount_value: p.discount_value, createdAt: p.createdAt }));
        break;
      case 'allBookings': {
        const [services, tours] = await Promise.all([ServiceBooking.findAll(), TourBooking.findAll()]);
        rows = [...services.map(b => ({ id: b.id, name: b.fullname, detail: b.name_service, type: 'service', value: b.value, status: b.status, createdAt: b.createdAt })),
          ...tours.map(b => ({ id: b.id, name: b.fullname, detail: b.tour_name || b.schedule_id, type: 'tour', value: b.value, status: b.status, createdAt: b.createdAt }))];
        break;
      }
      case 'refunds': {
        const [services, tours] = await Promise.all([ServiceBooking.findAll(), TourBooking.findAll()]);
        const all = [...services, ...tours];
        const refundItems = all.filter(b =>
          b.status === 'refunded' ||
          b.escrow_status === 'refund_pending' ||
          b.escrow_status === 'refunded' ||
          (b.rejection_reason && (b.rejection_reason.includes('hoàn tiền') || b.rejection_reason.includes('REFUND')))
        );
        rows = refundItems.map(b => ({
          id: b.id,
          name: b.fullname,
          detail: b.tour_name || b.name_service || 'Dịch vụ',
          reason: b.rejection_reason || 'Yêu cầu hoàn tiền',
          value: b.value,
          status: b.status === 'refunded' ? 'Đã hoàn tiền' : 'Chờ hoàn tiền',
          createdAt: b.createdAt
        }));
        break;
      }
      default: return res.status(404).json({ message: 'Unknown catalog' });
    }
    res.json(rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  } catch (error) { next(error); }
});

router.post('/refunds/:id/approve', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    const id = req.params.id;
    let b = await TourBooking.findByPk(id);
    if (!b) b = await ServiceBooking.findByPk(id);
    if (!b) return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });

    b.status = 'refunded';
    b.escrow_status = 'refunded';
    b.rejection_reason = (b.rejection_reason ? b.rejection_reason + ' | ' : '') + 'Quản trị viên đã xác nhận hoàn tiền chuyển khoản thành công.';
    await b.save();

    res.json({ success: true, message: 'Đã xác nhận hoàn tiền thành công' });
  } catch (error) { next(error); }
});

router.post('/refunds/:id/reject', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const { note } = req.body || {};
    let b = await TourBooking.findByPk(id);
    if (!b) b = await ServiceBooking.findByPk(id);
    if (!b) return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });

    b.rejection_reason = (b.rejection_reason ? b.rejection_reason + ' | ' : '') + `Từ chối hoàn tiền: ${note || 'Không đủ điều kiện'}`;
    await b.save();

    res.json({ success: true, message: 'Đã từ chối hoàn tiền' });
  } catch (error) { next(error); }
});

module.exports = router;
