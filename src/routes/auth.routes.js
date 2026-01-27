const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authController } = require('../controllers');
const { protect } = require('../middleware');
const validate = require('../middleware/validate.middleware');
const { authValidators } = require('../utils/validators');

/** Rate limiting for login/register — 10 attempts per 15 min per IP */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

/** Rate limiting for forgot-password — 5 per 15 min per IP */
const forgotRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

/** Rate limiting for resend verification — 3 per 15 min per IP */
const resendRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

/** Rate limiting for account deletion — 3 per hour per IP */
const deleteRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Public routes
router.post('/register', authRateLimiter, authValidators.register, validate, authController.register);
router.post('/login', authRateLimiter, authValidators.login, validate, authController.login);
router.post('/forgot-password', forgotRateLimiter, authValidators.forgotPassword, validate, authController.forgotPassword);
router.post('/reset-password/:token', authValidators.resetPassword, validate, authController.resetPassword);

// Email verification routes
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', resendRateLimiter, authValidators.resendVerification, validate, authController.resendVerification);

// Token refresh (can be called without auth header, uses cookie)
router.post('/refresh-token', authController.refreshToken);

// Logout (works with or without valid token)
router.post('/logout', authController.logout);

// Protected routes (require valid access token)
router.get('/me', protect, authController.getMe);
router.put('/profile', protect, authValidators.updateProfile, validate, authController.updateProfile);
router.put('/password', protect, authValidators.updatePassword, validate, authController.updatePassword);

// Account lifecycle (protected)
router.post('/deactivate', protect, authController.deactivateAccount);
router.post('/delete-account', protect, deleteRateLimiter, authValidators.deleteAccount, validate, authController.deleteAccount);

module.exports = router;
