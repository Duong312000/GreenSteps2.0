const { OperationsAssignment, ServiceBooking, TourBooking, GreenService, Vender } = require('../models/index');
const { Op } = require('sequelize');

// 1. Get assignments
exports.getAssignments = async (req, res, next) => {
  const { providerId } = req.query;
  try {
    let bookingIds = [];
    if (providerId) {
      const vender = await Vender.findOne({ where: { user_id: providerId } });
      const venderId = vender ? vender.id : '';
      const services = await GreenService.findAll({ where: { vender_id: venderId } });
      const serviceIds = services.map(s => s.id);
      
      const sBookings = await ServiceBooking.findAll({ where: { service_id: { [Op.in]: serviceIds } } });
      bookingIds = sBookings.map(b => b.id);
    }
    
    const list = await OperationsAssignment.findAll({
      where: providerId ? { booking_id: { [Op.in]: bookingIds } } : {}
    });
    
    const mapped = [];
    let allBookings = [];
    if (providerId) {
      const vender = await Vender.findOne({ where: { user_id: providerId } });
      const venderId = vender ? vender.id : '';
      const services = await GreenService.findAll({ where: { vender_id: venderId } });
      const serviceIds = services.map(s => s.id);
      allBookings = await ServiceBooking.findAll({
        where: { service_id: { [Op.in]: serviceIds } },
        order: [['booking_date', 'ASC']]
      });
    } else {
      allBookings = await ServiceBooking.findAll({ order: [['booking_date', 'ASC']] });
    }
    
    for (const b of allBookings) {
      let assignment = list.find(a => a.booking_id === b.id);
      if (!assignment) {
        mapped.push({
          id: 'placeholder_' + b.id,
          booking_id: b.id,
          booking_type: 'service',
          assigned_staff: '',
          assigned_vehicle: '',
          checklist: [
            { label: 'Chuẩn bị phòng/chỗ ngồi', done: false },
            { label: 'Kiểm tra thông tin liên lạc khách hàng', done: false },
            { label: 'Xác nhận dịch vụ trước 24h', done: false }
          ],
          status: 'preparing',
          incidents: '',
          notes: '',
          booking: {
            id: b.id,
            fullname: b.fullname,
            service: b.name_service,
            guests: b.guests,
            date: b.booking_date,
            booking_status: b.booking_status,
            payment_status: b.payment_status,
            operation_status: b.operation_status
          }
        });
      } else {
        mapped.push({
          ...assignment.toJSON(),
          booking: {
            id: b.id,
            fullname: b.fullname,
            service: b.name_service,
            guests: b.guests,
            date: b.booking_date,
            booking_status: b.booking_status,
            payment_status: b.payment_status,
            operation_status: b.operation_status
          }
        });
      }
    }
    
    res.json(mapped);
  } catch (error) {
    next(error);
  }
};

// 2. Assign staff/vehicle
exports.assignStaffAndVehicle = async (req, res, next) => {
  const { bookingId } = req.params;
  const { assigned_staff, assigned_vehicle, checklist, notes } = req.body;
  try {
    let assignment = await OperationsAssignment.findOne({ where: { booking_id: bookingId } });
    if (!assignment) {
      assignment = await OperationsAssignment.create({
        id: 'op_' + Date.now(),
        booking_id: bookingId,
        booking_type: 'service',
        assigned_staff: assigned_staff || '',
        assigned_vehicle: assigned_vehicle || '',
        checklist: checklist || [
          { label: 'Chuẩn bị phòng/chỗ ngồi', done: false },
          { label: 'Kiểm tra thông tin liên lạc khách hàng', done: false },
          { label: 'Xác nhận dịch vụ trước 24h', done: false }
        ],
        status: 'preparing',
        notes: notes || ''
      });
    } else {
      if (assigned_staff !== undefined) assignment.assigned_staff = assigned_staff;
      if (assigned_vehicle !== undefined) assignment.assigned_vehicle = assigned_vehicle;
      if (checklist !== undefined) assignment.checklist = checklist;
      if (notes !== undefined) assignment.notes = notes;
      await assignment.save();
    }
    res.json({ success: true, message: 'Phân công vận hành thành công!', assignment });
  } catch (error) {
    next(error);
  }
};

// 3. Update checklist item status
exports.updateChecklistItem = async (req, res, next) => {
  const { bookingId } = req.params;
  const { itemLabel, done } = req.body;
  try {
    let assignment = await OperationsAssignment.findOne({ where: { booking_id: bookingId } });
    if (!assignment) {
      assignment = await OperationsAssignment.create({
        id: 'op_' + Date.now(),
        booking_id: bookingId,
        booking_type: 'service',
        assigned_staff: '',
        assigned_vehicle: '',
        checklist: [
          { label: 'Chuẩn bị phòng/chỗ ngồi', done: false },
          { label: 'Kiểm tra thông tin liên lạc khách hàng', done: false },
          { label: 'Xác nhận dịch vụ trước 24h', done: false }
        ],
        status: 'preparing'
      });
    }
    
    const checklist = assignment.checklist || [];
    const item = checklist.find(i => i.label === itemLabel);
    if (item) {
      item.done = done;
      assignment.checklist = [...checklist];
      assignment.changed('checklist', true);
      await assignment.save();
    }
    res.json({ success: true, message: 'Cập nhật checklist thành công!', assignment });
  } catch (error) {
    next(error);
  }
};

// 4. Update assignment status
exports.updateAssignmentStatus = async (req, res, next) => {
  const { bookingId } = req.params;
  const { status, incidents } = req.body;
  try {
    let assignment = await OperationsAssignment.findOne({ where: { booking_id: bookingId } });
    if (!assignment) {
      assignment = await OperationsAssignment.create({
        id: 'op_' + Date.now(),
        booking_id: bookingId,
        booking_type: 'service',
        assigned_staff: '',
        assigned_vehicle: '',
        checklist: [],
        status: status || 'preparing',
        incidents: incidents || ''
      });
    } else {
      if (status !== undefined) assignment.status = status;
      if (incidents !== undefined) assignment.incidents = incidents;
      await assignment.save();
    }
    
    let booking = await ServiceBooking.findByPk(bookingId);
    if (!booking) {
      booking = await TourBooking.findByPk(bookingId);
    }
    if (booking) {
      booking.operation_status = status === 'incident' ? 'preparing' : status; 
      if (status === 'completed') {
        booking.booking_status = 'accepted';
        booking.payment_status = 'fully_paid';
        booking.status = 'completed';
      }
      await booking.save();
    }
    
    res.json({ success: true, message: 'Cập nhật trạng thái vận hành thành công!', assignment });
  } catch (error) {
    next(error);
  }
};
