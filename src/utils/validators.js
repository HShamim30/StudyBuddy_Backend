const { body, param, query } = require('express-validator');

/** Strong password regex: min 8 chars, uppercase, lowercase, number, special char */
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{}|;:'",.<>\/\\`~])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{}|;:'",.<>\/\\`~]{8,}$/;
const PASSWORD_MSG = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';

const authValidators = {
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_MSG)
  ],
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
  ],
  updateProfile: [
    body('name')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters'),
    body('avatar')
      .optional()
      .isString(),
    body('preferences')
      .optional()
      .isObject(),
    body('preferences.theme')
      .optional()
      .isIn(['light', 'dark']).withMessage('Theme must be light or dark'),
    body('preferences.defaultTimerDuration')
      .optional()
      .isInt({ min: 1, max: 240 }).withMessage('Timer must be 1–240 minutes')
  ],
  updatePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_MSG)
  ],
  forgotPassword: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
  ],
  resetPassword: [
    param('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_MSG)
  ],
  resendVerification: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
  ],
  deleteAccount: [
    body('password')
      .notEmpty().withMessage('Password is required to delete account')
  ]
};

const subjectValidators = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Subject name is required')
      .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
    body('color')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Invalid hex color'),
    body('icon')
      .optional()
      .trim()
  ],
  update: [
    param('id').isMongoId().withMessage('Invalid subject ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
    body('color')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Invalid hex color'),
    body('icon')
      .optional()
      .trim()
  ],
  reorder: [
    body('orderedIds')
      .isArray().withMessage('orderedIds must be an array')
      .notEmpty().withMessage('orderedIds cannot be empty'),
    body('orderedIds.*')
      .isMongoId().withMessage('Each ID must be a valid Mongo ID')
  ]
};

const noteValidators = {
  create: [
    body('subjectId')
      .notEmpty().withMessage('Subject ID is required')
      .isMongoId().withMessage('Invalid subject ID'),
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('content')
      .optional()
      .trim(),
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
  ],
  update: [
    param('id').isMongoId().withMessage('Invalid note ID'),
    body('title')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('content')
      .optional()
      .trim(),
    body('isPinned')
      .optional()
      .isBoolean().withMessage('isPinned must be a boolean'),
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
  ]
};

const flashcardValidators = {
  create: [
    body('subjectId')
      .notEmpty().withMessage('Subject ID is required')
      .isMongoId().withMessage('Invalid subject ID'),
    body('front')
      .trim()
      .notEmpty().withMessage('Front content is required'),
    body('back')
      .trim()
      .notEmpty().withMessage('Back content is required'),
    body('noteId')
      .optional()
      .isMongoId().withMessage('Invalid note ID')
  ],
  update: [
    param('id').isMongoId().withMessage('Invalid flashcard ID'),
    body('front')
      .optional()
      .trim(),
    body('back')
      .optional()
      .trim()
  ],
  review: [
    param('id').isMongoId().withMessage('Invalid flashcard ID'),
    body('quality')
      .notEmpty().withMessage('Quality rating is required')
      .isInt({ min: 1, max: 5 }).withMessage('Quality must be between 1 and 5')
  ],
  createBulk: [
    body('subjectId')
      .notEmpty().withMessage('Subject ID is required')
      .isMongoId().withMessage('Invalid subject ID'),
    body('noteId')
      .optional()
      .isMongoId().withMessage('Invalid note ID'),
    body('cards')
      .isArray().withMessage('Cards must be an array')
      .notEmpty().withMessage('At least one card is required'),
    body('cards.*.front')
      .trim()
      .notEmpty().withMessage('Front content is required'),
    body('cards.*.back')
      .trim()
      .notEmpty().withMessage('Back content is required')
  ]
};

const sessionValidators = {
  create: [
    body('type')
      .notEmpty().withMessage('Session type is required')
      .isIn(['timer', 'flashcard', 'note_revision']).withMessage('Invalid session type'),
    body('duration')
      .notEmpty().withMessage('Duration is required')
      .isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
    body('startedAt')
      .notEmpty().withMessage('Start time is required')
      .isISO8601().withMessage('Invalid start time format'),
    body('endedAt')
      .notEmpty().withMessage('End time is required')
      .isISO8601().withMessage('Invalid end time format'),
    body('subjectId')
      .optional()
      .isMongoId().withMessage('Invalid subject ID'),
    body('cardsReviewed')
      .optional()
      .isInt({ min: 0 }).withMessage('Cards reviewed must be non-negative'),
    body('notesRevised')
      .optional()
      .isInt({ min: 0 }).withMessage('Notes revised must be non-negative')
  ]
};

const idValidator = [
  param('id').isMongoId().withMessage('Invalid ID format')
];

module.exports = {
  authValidators,
  subjectValidators,
  noteValidators,
  flashcardValidators,
  sessionValidators,
  idValidator
};
