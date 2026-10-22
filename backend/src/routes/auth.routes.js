const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { softAuth } = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
router.post('/register/verify-otp', authController.verifyRegisterOtp);
router.post('/register/resend-otp', authController.resendRegisterOtp);
router.post('/login', authController.login);
router.post('/google-login', authController.googleLogin);
router.post('/request-checkout-otp', authController.requestCheckoutOtp);
router.post('/verify-checkout-otp', authController.verifyCheckoutOtp);
router.post('/logout', authController.logout);
router.post('/forgot-password/request-otp', authController.requestForgotPasswordOtp);
router.post('/forgot-password/verify-otp', authController.verifyForgotPasswordOtp);
router.post('/forgot-password/reset', authController.resetForgotPassword);
router.get('/profile', softAuth, authController.getProfile);
router.put('/profile', softAuth, authController.updateProfile);
router.put('/change-password', softAuth, authController.changePassword);
router.post('/track-interest', softAuth, authController.trackInterest);

// Legacy routes compatibility
router.get('/profile/:userId', softAuth, authController.getProfile);
router.put('/profile/:userId', softAuth, authController.updateProfile);
// Toggle user role maps to toggleRole in database (we can reuse toggleRole in auth.controller or write the toggle controller wrapper)
const authControllerMock = require('../controllers/auth.controller');
const { User, Vender } = require('../models/index');
router.post('/role/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }
    user.role = user.role === 'traveler' ? 'provider' : 'traveler';
    await user.save();

    if (user.role === 'provider') {
      const existingVender = await Vender.findOne({ where: { user_id: userId } });
      if (!existingVender) {
        await Vender.create({
          id: `provider_${userId}`,
          user_id: userId,
          registration_date: new Date()
        });
      }
    }
    res.json({ success: true, role: user.role });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi chuyển đổi vai trò!' });
  }
});

module.exports = router;
