const { protect, optionalAuth } = require('./auth.middleware');
const errorHandler = require('./error.middleware');
const validate = require('./validate.middleware');

module.exports = {
  protect,
  optionalAuth,
  errorHandler,
  validate
};
