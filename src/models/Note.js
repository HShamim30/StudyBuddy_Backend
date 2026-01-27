const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Note title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    default: ''
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  nextRevisionDate: {
    type: Date,
    default: null
  },
  revisionCount: {
    type: Number,
    default: 0
  },
  lastRevisedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

noteSchema.index({ userId: 1, subjectId: 1 });
noteSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });
noteSchema.index({ userId: 1, nextRevisionDate: 1 });

noteSchema.methods.calculateNextRevision = function() {
  const intervals = [1, 3, 7, 14, 30, 60, 120];
  const index = Math.min(this.revisionCount, intervals.length - 1);
  const daysUntilNext = intervals[index];
  
  this.revisionCount += 1;
  this.lastRevisedAt = new Date();
  this.nextRevisionDate = new Date(Date.now() + daysUntilNext * 24 * 60 * 60 * 1000);
  
  return this;
};

module.exports = mongoose.model('Note', noteSchema);
