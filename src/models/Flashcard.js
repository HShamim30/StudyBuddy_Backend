const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
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
  noteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    default: null
  },
  front: {
    type: String,
    required: [true, 'Front content is required'],
    trim: true
  },
  back: {
    type: String,
    required: [true, 'Back content is required'],
    trim: true
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  easeFactor: {
    type: Number,
    default: 2.5,
    min: 1.3
  },
  interval: {
    type: Number,
    default: 1
  },
  nextReviewDate: {
    type: Date,
    default: Date.now
  },
  reviewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

flashcardSchema.index({ userId: 1, subjectId: 1 });
flashcardSchema.index({ userId: 1, nextReviewDate: 1 });

flashcardSchema.methods.processReview = function(quality) {
  this.reviewCount += 1;
  
  if (quality < 3) {
    this.interval = 1;
  } else {
    if (this.reviewCount === 1) {
      this.interval = 1;
    } else if (this.reviewCount === 2) {
      this.interval = 6;
    } else {
      this.interval = Math.round(this.interval * this.easeFactor);
    }
  }
  
  this.easeFactor = Math.max(
    1.3,
    this.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );
  
  this.difficulty = quality;
  this.nextReviewDate = new Date(Date.now() + this.interval * 24 * 60 * 60 * 1000);
  
  return this;
};

module.exports = mongoose.model('Flashcard', flashcardSchema);
