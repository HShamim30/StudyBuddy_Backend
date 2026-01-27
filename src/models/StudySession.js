const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    default: null
  },
  type: {
    type: String,
    enum: ['timer', 'flashcard', 'note_revision'],
    required: [true, 'Session type is required']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  startedAt: {
    type: Date,
    required: true
  },
  endedAt: {
    type: Date,
    required: true
  },
  cardsReviewed: {
    type: Number,
    default: 0
  },
  notesRevised: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

studySessionSchema.index({ userId: 1, startedAt: -1 });
studySessionSchema.index({ userId: 1, type: 1 });

studySessionSchema.statics.getWeeklyStats = async function(userId) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startedAt: { $gte: weekAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$startedAt' }
        },
        totalMinutes: { $sum: '$duration' },
        sessions: { $sum: 1 },
        cardsReviewed: { $sum: '$cardsReviewed' },
        notesRevised: { $sum: '$notesRevised' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

studySessionSchema.statics.getDailyStats = async function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startedAt: { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: '$duration' },
        sessions: { $sum: 1 },
        cardsReviewed: { $sum: '$cardsReviewed' },
        notesRevised: { $sum: '$notesRevised' }
      }
    }
  ]);

  return result[0] || { totalMinutes: 0, sessions: 0, cardsReviewed: 0, notesRevised: 0 };
};

module.exports = mongoose.model('StudySession', studySessionSchema);
