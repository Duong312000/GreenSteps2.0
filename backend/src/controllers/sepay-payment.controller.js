const crypto = require('node:crypto');
const { store, ServiceBooking, TourBooking, SepayPaymentAttempt, Notification } = require('../models');
const sepay = require('../services/sepay-payment.service');

async function findBooking(id, transaction) {
  return await ServiceBooking.findByPk(id, transaction ? { transaction } : undefined)
    || await TourBooking.findByPk(id, transaction ? { transaction } : undefined);
}

function canAccessBooking(req, booking) {
  if (req.user?.id && String(req.user.id) === String(booking.user_id)) return true;
  if (req.user?.role === 'admin') return true;
  return sepay.matchesGuestCapability(req.headers?.['x-booking-payment-capability'], booking.sepay_capability_hash);
}

function isAwaitingPayment(booking) {
  return booking?.payment_method === 'sepay'
    && booking.status === 'pending'
    && ['pending', undefined, null].includes(booking.payment_status)
    && (!booking.payment_deadline || new Date(booking.payment_deadline) > new Date());
}

const providerOrderChecks = new Map();
const PROVIDER_ORDER_CHECK_INTERVAL_MS = 5000;

async function reconcileCapturedProviderOrder(booking, attempt) {
  if (!attempt || attempt.status !== 'pending' || !isAwaitingPayment(booking)) return;
  const invoice = String(attempt.order_invoice_number || '');
  if (!invoice) return;
  const now = Date.now();
  if (now - (providerOrderChecks.get(invoice) || 0) < PROVIDER_ORDER_CHECK_INTERVAL_MS) return;
  providerOrderChecks.set(invoice, now);
  if (providerOrderChecks.size > 5000) {
    for (const [key, checkedAt] of providerOrderChecks) {
      if (now - checkedAt > PROVIDER_ORDER_CHECK_INTERVAL_MS * 4) providerOrderChecks.delete(key);
    }
  }

  let order;
  try { order = await sepay.retrieveOrder(invoice); }
  catch { return; } // IPN remains the primary path when the provider API is unavailable.

  if (String(order?.order_invoice_number || '') !== invoice
    || String(order?.order_status || '').toUpperCase() !== 'CAPTURED'
    || String(order?.order_currency || '').toUpperCase() !== 'VND'
    || sepay.amountToMinorUnits(order?.order_amount) !== Number(attempt.amount) * 100) return;

  const transaction = (Array.isArray(order.transactions) ? order.transactions : []).find(row =>
    String(row.transaction_type || 'PAYMENT').toUpperCase() === 'PAYMENT'
    && String(row.transaction_status || '').toUpperCase() === 'APPROVED'
    && String(row.transaction_currency || '').toUpperCase() === 'VND'
    && sepay.amountToMinorUnits(row.transaction_amount) === Number(attempt.amount) * 100
    && (row.transaction_id || row.id));
  const transactionId = String(transaction?.transaction_id || transaction?.id || '');
  if (!transactionId) return;

  const reusedTransaction = await SepayPaymentAttempt.findOne({ where: { transaction_id: transactionId } });
  if (reusedTransaction && String(reusedTransaction.id) !== String(attempt.id)) return;

  await store.transaction(async session => {
    const currentAttempt = await SepayPaymentAttempt.findByPk(attempt.id, { transaction: session });
    const currentBooking = await findBooking(attempt.booking_id, session);
    if (!currentAttempt || !currentBooking || currentAttempt.status === 'succeeded') return;
    if (!isAwaitingPayment(currentBooking)) {
      currentAttempt.status = 'reconciliation_required';
      currentAttempt.reconciliation_required = true;
      currentAttempt.transaction_id = transactionId;
      currentAttempt.notification_type = 'ORDER_PAID';
      await currentAttempt.save({ transaction: session });
      return;
    }

    currentAttempt.status = 'succeeded';
    currentAttempt.transaction_id = transactionId;
    currentAttempt.notification_type = 'ORDER_PAID';
    await currentAttempt.save({ transaction: session });
    currentBooking.payment_status = 'deposit_paid';
    currentBooking.status = 'deposit';
    currentBooking.booking_status = 'deposit';
    currentBooking.payment_amount = Number(currentAttempt.amount);
    currentBooking.paid_at = new Date();
    currentBooking.payment_deadline = null;
    await currentBooking.save({ transaction: session });
    Object.assign(booking, currentBooking.toJSON ? currentBooking.toJSON() : currentBooking);
    Object.assign(attempt, currentAttempt.toJSON ? currentAttempt.toJSON() : currentAttempt);

    if (currentBooking.user_id) {
      await Notification.create({
        id: `notif_${crypto.randomUUID()}`,
        user_id: currentBooking.user_id,
        title: 'Thanh toán đã được xác nhận',
        message: `SePay đã xác nhận thanh toán cho đơn ${currentBooking.id}.`,
        type: 'booking',
        read: false
      }, { transaction: session });
    }
  });
}

exports.config = (_req, res) => res.json(sepay.getReadiness());

exports.create = async (req, res, next) => {
  try {
    const readiness = sepay.getReadiness();
    if (!readiness.configured) return res.status(503).json({ success: false, message: 'SePay sandbox chưa được cấu hình đầy đủ.', missing: readiness.missing });
    const bookingId = String(req.body?.bookingId || '');
    const booking = await findBooking(bookingId);
    if (!booking || booking.payment_method !== 'sepay') return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ SePay.' });
    if (!canAccessBooking(req, booking)) return res.status(403).json({ success: false, message: 'Bạn không có quyền thanh toán đơn này.' });
    if (!isAwaitingPayment(booking)) return res.status(409).json({ success: false, message: 'Đơn đặt chỗ không còn chờ thanh toán.' });
    if (!sepay.isValidAmount(booking.value)) return res.status(400).json({ success: false, message: 'Số tiền đơn đặt chỗ không hợp lệ.' });

    let attempt = await SepayPaymentAttempt.findOne({ where: { booking_id: booking.id, status: 'pending' } });
    if (!attempt) {
      const invoice = `${booking.id}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
      const checkout = sepay.createCheckout({
        bookingId: String(booking.id),
        invoice,
        amount: Number(booking.value),
        description: `GreenSteps booking ${booking.id}`,
        customerId: booking.user_id || undefined
      });
      try {
        attempt = await SepayPaymentAttempt.create({
          id: crypto.randomUUID(),
          booking_id: String(booking.id),
          order_invoice_number: invoice,
          amount: Number(booking.value),
          status: 'pending',
          checkout_fields: checkout.fields
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        attempt = await SepayPaymentAttempt.findOne({ where: { booking_id: booking.id, status: 'pending' } });
        if (!attempt) throw error;
      }
    }

    const client = new (require('sepay-pg-node').SePayPgClient)({
      env: sepay.getReadiness().environment,
      merchant_id: process.env.SEPAY_MERCHANT_ID.trim(),
      secret_key: process.env.SEPAY_MERCHANT_SECRET.trim()
    });
    return res.json({ success: true, bookingId: booking.id, checkoutUrl: client.checkout.initCheckoutUrl(), fields: attempt.checkout_fields });
  } catch (error) { next(error); }
};

exports.status = async (req, res, next) => {
  try {
    const booking = await findBooking(String(req.params.bookingId || ''));
    if (!booking || booking.payment_method !== 'sepay') return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt chỗ SePay.' });
    if (!canAccessBooking(req, booking)) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn này.' });
    const attempt = await SepayPaymentAttempt.findOne({ where: { booking_id: booking.id }, order: [['createdAt', 'DESC']] });
    await reconcileCapturedProviderOrder(booking, attempt);
    return res.json({
      success: true,
      booking: {
        id: booking.id,
        status: booking.status,
        payment_status: booking.payment_status,
        payment_method: booking.payment_method,
        paid_amount: Number(booking.payment_amount || 0)
      },
      payment: attempt ? { status: attempt.status, amount: attempt.amount, transactionId: attempt.transaction_id || null, reconciliationRequired: Boolean(attempt.reconciliation_required) } : null
    });
  } catch (error) { next(error); }
};

exports.ipn = async (req, res, next) => {
  const payload = req.body || {};
  const expectedSecret = process.env.SEPAY_IPN_SECRET || '';
  if (!sepay.safeSecretEqual(req.get('x-secret-key'), expectedSecret)) {
    return res.status(401).json({ success: false, message: 'IPN authentication failed.' });
  }

  try {
    const invoice = String(payload.order?.order_invoice_number || '');
    const providerAmount = sepay.amountToMinorUnits(payload.order?.order_amount);
    const transactionAmount = sepay.amountToMinorUnits(payload.transaction?.transaction_amount);
    if (!invoice || !payload.order || !payload.transaction || !Number.isSafeInteger(providerAmount) || !Number.isSafeInteger(transactionAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid IPN payload.' });
    }
    const attempt = await SepayPaymentAttempt.findOne({ where: { order_invoice_number: invoice } });
    if (!attempt) return res.status(404).json({ success: false, message: 'Payment attempt not found.' });
    if (providerAmount !== Number(attempt.amount) * 100 || transactionAmount !== Number(attempt.amount) * 100
      || String(payload.order.order_currency || '').toUpperCase() !== 'VND'
      || String(payload.transaction.transaction_currency || '').toUpperCase() !== 'VND') {
      return res.status(400).json({ success: false, message: 'Payment amount or currency does not match.' });
    }
    if (attempt.status === 'succeeded') return res.json({ success: true, duplicate: true });

    const event = String(payload.notification_type || '');
    const transactionId = String(payload.transaction.transaction_id || payload.transaction.id || '');
    if (!transactionId || !['ORDER_PAID', 'TRANSACTION_VOID'].includes(event)) {
      return res.status(400).json({ success: false, message: 'Unsupported IPN event.' });
    }
    const reusedTransaction = await SepayPaymentAttempt.findOne({ where: { transaction_id: transactionId } });
    if (reusedTransaction && String(reusedTransaction.id) !== String(attempt.id)) {
      return res.status(409).json({ success: false, message: 'Transaction is already linked to another order.' });
    }

    let settled = false;
    await store.transaction(async transaction => {
      const currentAttempt = await SepayPaymentAttempt.findByPk(attempt.id, { transaction });
      const booking = await findBooking(attempt.booking_id, transaction);
      if (!currentAttempt || !booking) throw Object.assign(new Error('Payment booking was not found.'), { statusCode: 404 });
      if (currentAttempt.status === 'succeeded') return;
      currentAttempt.transaction_id = transactionId;
      currentAttempt.notification_type = event;

      if (event === 'TRANSACTION_VOID') {
        if (currentAttempt.status === 'pending') currentAttempt.status = 'void';
        await currentAttempt.save({ transaction });
        return;
      }

      if (payload.order.order_status !== 'CAPTURED' || payload.transaction.transaction_status !== 'APPROVED') {
        currentAttempt.status = 'failed';
        await currentAttempt.save({ transaction });
        return;
      }
      if (!isAwaitingPayment(booking)) {
        currentAttempt.status = 'reconciliation_required';
        currentAttempt.reconciliation_required = true;
        await currentAttempt.save({ transaction });
        return;
      }

      currentAttempt.status = 'succeeded';
      await currentAttempt.save({ transaction });
      booking.payment_status = 'deposit_paid';
      booking.status = 'deposit';
      booking.booking_status = 'deposit';
      booking.payment_amount = Number(currentAttempt.amount);
      booking.paid_at = new Date();
      await booking.save({ transaction });
      settled = true;
      if (booking.user_id) {
        await Notification.create({
          id: `notif_${crypto.randomUUID()}`,
          user_id: booking.user_id,
          title: 'Thanh toán đã được xác nhận',
          message: `SePay đã xác nhận thanh toán cho đơn ${booking.id}.`,
          type: 'booking',
          read: false
        }, { transaction });
      }
    });

    return res.json({ success: true, settled });
  } catch (error) { next(error); }
};
