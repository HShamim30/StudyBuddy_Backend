const jwt = require('jsonwebtoken');
const User = require('../models/User');

/** Safe 401 message — does not reveal whether token was missing, invalid, or expired */
const UNAUTHORIZED_MSG = 'Not authorized to access this route';

/**
 * Protect routes - validates access token
 * Checks: token presence, signature, type, expiry, token version, user status
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: UNAUTHORIZED_MSG });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ensure it's an access token (not refresh)
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ success: false, message: UNAUTHORIZED_MSG });
    }

    const user = await User.findById(decoded.id)
      .select('+passwordChangedAt +tokenVersion +accountStatus');

    if (!user) {
      return res.status(401).json({ success: false, message: UNAUTHORIZED_MSG });
    }

    // Check account status
    if (user.accountStatus !== 'active') {
      return res.status(401).json({ success: false, message: UNAUTHORIZED_MSG });
    }

    // Check token version for session invalidation
    if (typeof decoded.tokenVersion === 'number' && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ success: false, message: UNAUTHORIZED_MSG });
    }

    // Check if password was changed after token was issued
    if (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return res.status(401).json({ success: false, message: UNAUTHORIZED_MSG });
    }

    req.user = user;
    next();
  } catch (_err) {
    return res.status(401).json({ success: false, message: UNAUTHORIZED_MSG });
  }
};

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type && decoded.type !== 'access') {
      return next();
    }

    const user = await User.findById(decoded.id).select('+tokenVersion +accountStatus');

    if (user && user.accountStatus === 'active') {
      if (typeof decoded.tokenVersion !== 'number' || decoded.tokenVersion === user.tokenVersion) {
        req.user = user;
      }
    }
  } catch (_err) {
    // Token invalid, continue without user
  }

  next();
};

module.exports = { protect, optionalAuth };
