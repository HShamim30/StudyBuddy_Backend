const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    defaultTimerDuration: {
      type: Number,
      default: 25
    }
  },
  // Email verification
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationTokenHash: { type: String, select: false },
  emailVerificationExpiry: { type: Date, select: false },
  
  // Account status: active, deactivated, deleted
  accountStatus: {
    type: String,
    enum: ['active', 'deactivated', 'deleted'],
    default: 'active'
  },
  deactivatedAt: { type: Date, select: false },
  
  // Password reset
  resetTokenHash: { type: String, select: false },
  resetTokenExpiry: { type: Date, select: false },
  passwordChangedAt: { type: Date, select: false },
  
  // Refresh token tracking (hashed for security)
  refreshTokenHash: { type: String, select: false },
  refreshTokenExpiry: { type: Date, select: false },
  
  // Token version for invalidating all sessions
  tokenVersion: {
    type: Number,
    default: 0
  },
  
  // Security: track last login for alerts
  lastLoginAt: { type: Date },
  lastLoginIp: { type: String, select: false }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/** Ensures password and sensitive data are never included in JSON */
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetTokenHash;
  delete obj.resetTokenExpiry;
  delete obj.emailVerificationTokenHash;
  delete obj.emailVerificationExpiry;
  delete obj.refreshTokenHash;
  delete obj.refreshTokenExpiry;
  delete obj.lastLoginIp;
  delete obj.deactivatedAt;
  return obj;
};

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/** Generate short-lived access token (15 minutes) */
userSchema.methods.generateAccessToken = function() {
  return jwt.sign(
    { id: this._id, tokenVersion: this.tokenVersion, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

/** Generate long-lived refresh token (7 days) */
userSchema.methods.generateRefreshToken = function() {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  return jwt.sign(
    { id: this._id, tokenVersion: this.tokenVersion, type: 'refresh' },
    refreshSecret,
    { expiresIn: '7d' }
  );
};

/** Generate email verification token */
userSchema.methods.generateEmailVerificationToken = function() {
  const plainToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationTokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
  this.emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return plainToken;
};

/** Invalidate all sessions by incrementing token version */
userSchema.methods.invalidateAllSessions = function() {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  this.refreshTokenHash = undefined;
  this.refreshTokenExpiry = undefined;
};

module.exports = mongoose.model('User', userSchema);
