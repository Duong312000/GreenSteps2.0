const { Op } = require('sequelize');
const { ChangeRequest, ServiceBooking, TourBooking, GreenService, Vender } = require('../models/index');

// 1. Get all change requests
exports.getChangeRequests = async (req, res, next) => {
  const { providerId, customerId } = req.query;
  try {
    let where = {};
    if (providerId) {
      const vender = await Vender.findOne({ where: { user_id: providerId } });
      const venderId = vender ? vender.id : '';
      const services = await GreenService.findAll({ where: { vender_id: venderId } });
      const serviceIds = services.map(s => s.id);
      
      const sBookings = await ServiceBooking.findAll({ where: { service_id: { [Op.in]: serviceIds } } });
      const bookingIds = sBookings.map(b => b.id);
      
      where.booking_id = { [Op.in]: bookingIds };
    } else if (customerId) {
      const sBookings = await ServiceBooking.findAll({ where: { user_id: customerId } });
      const tBookings = await TourBooking.findAll({ where: { user_id: customerId } });
      const bookingIds = [...sBookings.map(b => b.id), ...tBookings.map(b => b.id)];
      where.booking_id = { [Op.in]: bookingIds };
    }
    
    const list = await ChangeRequest.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    
    const mapped = [];
    for (const item of list) {
      let booking = await ServiceBooking.findByPk(item.booking_id);
      if (!booking) {
        booking = await TourBooking.findByPk(item.booking_id);
      }
      mapped.push({
        ...item.toJSON(),
        booking: booking ? {
          id: booking.id,
          fullname: booking.fullname,
          service: booking.name_service || booking.tour_name,
          guests: booking.guests,
          value: booking.value,
          date: booking.booking_date
        } : null
      });
    }
    
    res.json(mapped);
  } catch (error) {
    next(error);
  }
};

// 2. Create change request
exports.createChangeRequest = async (req, res, next) => {
  const { booking_id, booking_type, type, old_content, new_content, notes } = req.body;
  try {
    let booking = await ServiceBooking.findByPk(booking_id);
    if (!booking) {
      booking = await TourBooking.findByPk(booking_id);
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking không tồn tại!' });
    }
    
    const id = 'cr_' + Date.now();
    
    let priceDiff = 0;
    if (type === 'guests_change' && new_content && new_content.guests !== undefined) {
      const oldGuests = booking.guests || 1;
      const newGuests = Number(new_content.guests);
      const perGuestCost = booking.value / oldGuests;
      priceDiff = perGuestCost * (newGuests - oldGuests);
    }

    const cr = await ChangeRequest.create({
      id,
      booking_id,
      booking_type: booking_type || 'service',
      type,
      old_content: old_content || {
        date: booking.booking_date,
        guests: booking.guests
      },
      new_content,
      status: 'pending',
      price_diff: priceDiff,
      notes
    });

    res.json({ success: true, message: 'Tạo yêu cầu thay đổi thành công!', changeRequest: cr });
  } catch (error) {
    next(error);
  }
};

// 3. Approve change request
exports.approveChangeRequest = async (req, res, next) => {
  const { id } = req.params;
  try {
    const cr = await ChangeRequest.findByPk(id);
    if (!cr) {
      return res.status(404).json({ success: false, message: 'Yêu cầu thay đổi không tồn tại!' });
    }
    
    let booking = await ServiceBooking.findByPk(cr.booking_id);
    if (!booking) {
      booking = await TourBooking.findByPk(cr.booking_id);
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking liên quan không tồn tại!' });
    }

    if (cr.type === 'date_change' && cr.new_content?.date) {
      booking.booking_date = cr.new_content.date;
    } else if (cr.type === 'time_change' && cr.new_content?.time) {
      const curData = booking.current_data || {};
      curData.time = cr.new_content.time;
      booking.current_data = { ...curData };
      booking.changed('current_data', true);
    } else if (cr.type === 'guests_change' && cr.new_content?.guests) {
      booking.guests = Number(cr.new_content.guests);
      booking.value += cr.price_diff;
    } else if (cr.type === 'info_change' && cr.new_content?.fullname) {
      booking.fullname = cr.new_content.fullname;
    } else if (cr.type === 'cancel_booking' || cr.type === 'refund') {
      booking.booking_status = 'cancelled';
      booking.payment_status = 'refunded';
      booking.status = 'refunded';
    }

    cr.status = 'completed';
    await cr.save();
    await booking.save();

    res.json({ success: true, message: 'Đã phê duyệt và áp dụng yêu cầu thay đổi!', changeRequest: cr, booking });
  } catch (error) {
    next(error);
  }
};

// 4. Reject change request
exports.rejectChangeRequest = async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const cr = await ChangeRequest.findByPk(id);
    if (!cr) {
      return res.status(404).json({ success: false, message: 'Yêu cầu thay đổi không tồn tại!' });
    }
    cr.status = 'rejected';
    cr.rejection_reason = reason || 'Không khả dụng vào thời điểm này';
    await cr.save();
    res.json({ success: true, message: 'Đã từ chối yêu cầu thay đổi!', changeRequest: cr });
  } catch (error) {
    next(error);
  }
};

// 5. Propose alternative plan
exports.proposeAlternativeChangeRequest = async (req, res, next) => {
  const { id } = req.params;
  const { propose_date, propose_notes, price_diff } = req.body;
  try {
    const cr = await ChangeRequest.findByPk(id);
    if (!cr) {
      return res.status(404).json({ success: false, message: 'Yêu cầu thay đổi không tồn tại!' });
    }
    cr.status = 'pending_customer_confirm';
    cr.notes = propose_notes || cr.notes;
    if (propose_date) {
      cr.new_content = { ...(cr.new_content || {}), date: propose_date };
    }
    if (price_diff !== undefined) {
      cr.price_diff = Number(price_diff);
    }
    await cr.save();
    res.json({ success: true, message: 'Đã đề xuất phương án thay đổi khác cho khách hàng!', changeRequest: cr });
  } catch (error) {
    next(error);
  }
};
