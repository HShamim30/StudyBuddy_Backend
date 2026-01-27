const crypto = require('crypto');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Note = require('../models/Note');
const Flashcard = require('../models/Flashcard');
const StudySession = require('../models/StudySession');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountDeactivatedEmail,
  sendAccountDeletedEmail,
  sendLoginAlertEmail
} = require('../utils/email');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/** Helper to get client IP */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.ip ||
    'Unknown';
}

/** Helper to set auth tokens */
function setAuthTokens(res, user) {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  
  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
  
  return { accessToken, refreshToken };
}

/** POST /api/auth/register */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    return ApiResponse.badRequest(res, 'Email already registered');
  }

  const user = new User({ name, email, password });
  const verificationToken = user.generateEmailVerificationToken();
  await user.save();

  // Send verification email
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const verifyLink = `${frontendUrl}/verify-email/${verificationToken}`;
  
  try {
    await sendVerificationEmail(user.email, verifyLink);
  } catch (emailErr) {
    console.error('Failed to send verification email:', emailErr.message);
  }

  ApiResponse.created(res, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isEmailVerified: user.isEmailVerified
    },
    message: 'Please check your email to verify your account'
  }, 'Registration successful. Please verify your email.');
});

/** POST /api/auth/login */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+password +accountStatus +deactivatedAt +lastLoginIp');

  if (!user) {
    return ApiResponse.unauthorized(res, 'Invalid credentials');
  }

  // Check account status
  if (user.accountStatus === 'deleted') {
    return ApiResponse.unauthorized(res, 'Invalid credentials');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return ApiResponse.unauthorized(res, 'Invalid credentials');
  }

  // Check email verification
  if (!user.isEmailVerified) {
    return ApiResponse.error(res, 'Please verify your email before signing in', 403);
  }

  // Reactivate deactivated account
  if (user.accountStatus === 'deactivated') {
    user.accountStatus = 'active';
    user.deactivatedAt = undefined;
  }

  // Update login tracking
  const clientIp = getClientIp(req);
  const previousIp = user.lastLoginIp;
  user.lastLoginAt = new Date();
  user.lastLoginIp = clientIp;
  
  // Hash and store refresh token
  const { accessToken, refreshToken } = setAuthTokens(res, user);
  user.refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  await user.save({ validateBeforeSave: false });

  // Send login alert if IP changed (skip in development)
  if (process.env.NODE_ENV === 'production' && previousIp && previousIp !== clientIp) {
    try {
      await sendLoginAlertEmail(user.email, user.name, clientIp, req.headers['user-agent']);
    } catch (emailErr) {
      console.error('Failed to send login alert:', emailErr.message);
    }
  }

  ApiResponse.success(res, {
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      preferences: user.preferences,
      isEmailVerified: user.isEmailVerified
    }
  }, 'Login successful');
});

/** POST /api/auth/refresh-token */
exports.refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  
  if (!token) {
    return ApiResponse.unauthorized(res, 'Refresh token required');
  }

  // Verify refresh token
  const jwt = require('jsonwebtoken');
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  
  let decoded;
  try {
    decoded = jwt.verify(token, refreshSecret);
  } catch (_err) {
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    return ApiResponse.unauthorized(res, 'Invalid or expired refresh token');
  }

  if (decoded.type !== 'refresh') {
    return ApiResponse.unauthorized(res, 'Invalid token type');
  }

  const user = await User.findById(decoded.id)
    .select('+refreshTokenHash +refreshTokenExpiry +tokenVersion +accountStatus');

  if (!user || user.accountStatus !== 'active') {
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    return ApiResponse.unauthorized(res, 'User not found or inactive');
  }

  // Validate token version (for session invalidation)
  if (decoded.tokenVersion !== user.tokenVersion) {
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    return ApiResponse.unauthorized(res, 'Session invalidated. Please sign in again.');
  }

  // Validate stored refresh token hash
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  if (!user.refreshTokenHash || user.refreshTokenHash !== tokenHash) {
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    return ApiResponse.unauthorized(res, 'Refresh token has been revoked');
  }

  // Check expiry
  if (user.refreshTokenExpiry && new Date() > user.refreshTokenExpiry) {
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    return ApiResponse.unauthorized(res, 'Refresh token expired');
  }

  // Issue new tokens (token rotation)
  const { accessToken, refreshToken: newRefreshToken } = setAuthTokens(res, user);
  user.refreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  ApiResponse.success(res, { accessToken }, 'Token refreshed');
});

/** POST /api/auth/logout */
exports.logout = asyncHandler(async (req, res) => {
  // Clear refresh token from database if user is authenticated
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { refreshTokenHash: 1, refreshTokenExpiry: 1 }
    });
  }

  // Clear cookie
  res.clearCookie('refreshToken', COOKIE_OPTIONS);

  ApiResponse.success(res, null, 'Logged out successfully');
});

/** GET /api/auth/verify-email/:token */
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token || typeof token !== 'string') {
    return ApiResponse.badRequest(res, 'Invalid verification link');
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiry: { $gt: new Date() }
  }).select('+emailVerificationTokenHash +emailVerificationExpiry');

  if (!user) {
    return ApiResponse.badRequest(res, 'Invalid or expired verification link');
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  ApiResponse.success(res, null, 'Email verified successfully. You can now sign in.');
});

/** POST /api/auth/resend-verification */
exports.resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

  // Always return success to prevent email enumeration
  const genericMsg = 'If this email exists and is unverified, a new verification link has been sent.';

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isEmailVerified: false,
    accountStatus: { $ne: 'deleted' }
  });

  if (user) {
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verifyLink = `${frontendUrl}/verify-email/${verificationToken}`;
    try {
      await sendVerificationEmail(user.email, verifyLink);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
    }
  }

  ApiResponse.success(res, null, genericMsg);
});

/** GET /api/auth/me */
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  ApiResponse.success(res, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      preferences: user.preferences,
      isEmailVerified: user.isEmailVerified,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt
    }
  });
});

/** PUT /api/auth/profile */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, avatar, preferences } = req.body;

  const updateData = {};
  if (name) updateData.name = name;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (preferences && typeof preferences === 'object') {
    if (preferences.theme && ['light', 'dark'].includes(preferences.theme)) {
      updateData['preferences.theme'] = preferences.theme;
    }
    if (typeof preferences.defaultTimerDuration === 'number' && 
        preferences.defaultTimerDuration >= 1 && 
        preferences.defaultTimerDuration <= 240) {
      updateData['preferences.defaultTimerDuration'] = preferences.defaultTimerDuration;
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  );

  ApiResponse.success(res, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      preferences: user.preferences
    }
  }, 'Profile updated');
});

/** PUT /api/auth/password */
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return ApiResponse.badRequest(res, 'Current password is incorrect');
  }

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  user.invalidateAllSessions();
  await user.save();

  // Issue new tokens
  const { accessToken } = setAuthTokens(res, user);
  user.refreshTokenHash = crypto.createHash('sha256').update(req.cookies?.refreshToken || '').digest('hex');
  user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  // Send security alert email
  try {
    await sendPasswordChangedEmail(user.email);
  } catch (emailErr) {
    console.error('Failed to send password changed email:', emailErr.message);
  }

  ApiResponse.success(res, { accessToken }, 'Password updated. All other sessions have been signed out.');
});

/** POST /api/auth/forgot-password */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

  const user = await User.findOne({
    email: (email || '').toLowerCase().trim(),
    accountStatus: { $ne: 'deleted' }
  });

  if (user) {
    const plainToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      resetTokenHash,
      resetTokenExpiry
    });

    const resetLink = `${frontendUrl}/reset-password/${plainToken}`;
    try {
      await sendPasswordResetEmail(user.email, resetLink);
    } catch (emailErr) {
      console.error('Failed to send password reset email:', emailErr.message);
    }
  }

  // Always return generic success to prevent email enumeration
  ApiResponse.success(res, null, 'If this email exists, a reset link has been sent.');
});

/** POST /api/auth/reset-password/:token */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token || typeof token !== 'string') {
    return ApiResponse.badRequest(res, 'Invalid or expired reset link');
  }

  const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetTokenHash,
    resetTokenExpiry: { $gt: new Date() },
    accountStatus: { $ne: 'deleted' }
  }).select('+password +resetTokenHash +resetTokenExpiry');

  if (!user) {
    return ApiResponse.badRequest(res, 'Invalid or expired reset link');
  }

  user.password = password;
  user.passwordChangedAt = new Date();
  user.invalidateAllSessions();
  await user.save();

  // Clear reset token
  await User.updateOne(
    { _id: user._id },
    { $unset: { resetTokenHash: 1, resetTokenExpiry: 1 } }
  );

  // Send password changed alert
  try {
    await sendPasswordChangedEmail(user.email);
  } catch (emailErr) {
    console.error('Failed to send password changed email:', emailErr.message);
  }

  ApiResponse.success(res, null, 'Password has been reset. Please sign in with your new password.');
});

/** POST /api/auth/deactivate */
exports.deactivateAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  user.accountStatus = 'deactivated';
  user.deactivatedAt = new Date();
  user.invalidateAllSessions();
  await user.save({ validateBeforeSave: false });

  // Clear cookie
  res.clearCookie('refreshToken', COOKIE_OPTIONS);

  // Send notification
  try {
    await sendAccountDeactivatedEmail(user.email, user.name);
  } catch (emailErr) {
    console.error('Failed to send deactivation email:', emailErr.message);
  }

  ApiResponse.success(res, null, 'Account deactivated. You can reactivate by signing in.');
});

/** POST /api/auth/delete-account */
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return ApiResponse.badRequest(res, 'Incorrect password');
  }

  const userEmail = user.email;
  const userName = user.name;

  // Delete all user data
  await Promise.all([
    Flashcard.deleteMany({ userId: user._id }),
    Note.deleteMany({ userId: user._id }),
    Subject.deleteMany({ userId: user._id }),
    StudySession.deleteMany({ userId: user._id }),
    User.findByIdAndDelete(user._id)
  ]);

  // Clear cookie
  res.clearCookie('refreshToken', COOKIE_OPTIONS);

  // Send deletion confirmation
  try {
    await sendAccountDeletedEmail(userEmail, userName);
  } catch (emailErr) {
    console.error('Failed to send deletion email:', emailErr.message);
  }

  ApiResponse.success(res, null, 'Account and all data permanently deleted.');
});
