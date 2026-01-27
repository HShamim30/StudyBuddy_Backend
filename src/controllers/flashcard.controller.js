const Flashcard = require('../models/Flashcard');
const Subject = require('../models/Subject');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { asMongoId } = require('../utils/sanitize');

exports.getFlashcards = asyncHandler(async (req, res) => {
  const { subjectId, noteId } = req.query;

  const query = { userId: req.user._id };
  const sid = asMongoId(subjectId);
  if (sid) query.subjectId = sid;
  const nid = asMongoId(noteId);
  if (nid) query.noteId = nid;

  const flashcards = await Flashcard.find(query)
    .populate('subjectId', 'name color icon')
    .sort({ createdAt: -1 });

  ApiResponse.success(res, { flashcards, count: flashcards.length });
});

exports.getFlashcard = asyncHandler(async (req, res) => {
  const flashcard = await Flashcard.findOne({
    _id: req.params.id,
    userId: req.user._id
  }).populate('subjectId', 'name color icon');

  if (!flashcard) {
    return ApiResponse.notFound(res, 'Flashcard not found');
  }

  ApiResponse.success(res, { flashcard });
});

exports.createFlashcard = asyncHandler(async (req, res) => {
  const { subjectId, noteId, front, back } = req.body;

  const subject = await Subject.findOne({
    _id: subjectId,
    userId: req.user._id
  });

  if (!subject) {
    return ApiResponse.badRequest(res, 'Invalid subject');
  }

  const flashcard = await Flashcard.create({
    userId: req.user._id,
    subjectId,
    noteId,
    front,
    back
  });

  await flashcard.populate('subjectId', 'name color icon');

  ApiResponse.created(res, { flashcard }, 'Flashcard created');
});

exports.createBulk = asyncHandler(async (req, res) => {
  const { subjectId, noteId, cards } = req.body;

  const subject = await Subject.findOne({
    _id: subjectId,
    userId: req.user._id
  });

  if (!subject) {
    return ApiResponse.badRequest(res, 'Invalid subject');
  }

  const flashcards = await Flashcard.insertMany(
    cards.map(card => ({
      userId: req.user._id,
      subjectId,
      noteId,
      front: card.front,
      back: card.back
    }))
  );

  ApiResponse.created(res, { flashcards, count: flashcards.length }, 'Flashcards created');
});

exports.updateFlashcard = asyncHandler(async (req, res) => {
  const { front, back } = req.body;

  const flashcard = await Flashcard.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { front, back },
    { new: true, runValidators: true }
  ).populate('subjectId', 'name color icon');

  if (!flashcard) {
    return ApiResponse.notFound(res, 'Flashcard not found');
  }

  ApiResponse.success(res, { flashcard }, 'Flashcard updated');
});

exports.deleteFlashcard = asyncHandler(async (req, res) => {
  const flashcard = await Flashcard.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!flashcard) {
    return ApiResponse.notFound(res, 'Flashcard not found');
  }

  ApiResponse.success(res, null, 'Flashcard deleted');
});

exports.getDueCards = asyncHandler(async (req, res) => {
  const { subjectId, limit } = req.query;
  const now = new Date();

  const query = {
    userId: req.user._id,
    nextReviewDate: { $lte: now }
  };

  const sid = asMongoId(subjectId);
  if (sid) query.subjectId = sid;

  const lim = Math.min(Math.max(1, parseInt(limit, 10) || 20), 200);

  const flashcards = await Flashcard.find(query)
    .populate('subjectId', 'name color icon')
    .sort({ nextReviewDate: 1 })
    .limit(lim);

  ApiResponse.success(res, { flashcards, count: flashcards.length });
});

exports.reviewCard = asyncHandler(async (req, res) => {
  const { quality } = req.body;

  const flashcard = await Flashcard.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!flashcard) {
    return ApiResponse.notFound(res, 'Flashcard not found');
  }

  flashcard.processReview(quality);
  await flashcard.save();

  await flashcard.populate('subjectId', 'name color icon');

  ApiResponse.success(res, { flashcard }, 'Review recorded');
});

exports.resetProgress = asyncHandler(async (req, res) => {
  const flashcard = await Flashcard.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!flashcard) {
    return ApiResponse.notFound(res, 'Flashcard not found');
  }

  flashcard.easeFactor = 2.5;
  flashcard.interval = 1;
  flashcard.reviewCount = 0;
  flashcard.nextReviewDate = new Date();
  await flashcard.save();

  ApiResponse.success(res, { flashcard }, 'Progress reset');
});

exports.getStats = asyncHandler(async (req, res) => {
  const { subjectId } = req.query;
  const now = new Date();

  const query = { userId: req.user._id };
  if (subjectId) query.subjectId = subjectId;

  const total = await Flashcard.countDocuments(query);
  const dueCount = await Flashcard.countDocuments({
    ...query,
    nextReviewDate: { $lte: now }
  });
  const masteredCount = await Flashcard.countDocuments({
    ...query,
    interval: { $gte: 21 }
  });

  ApiResponse.success(res, {
    total,
    due: dueCount,
    mastered: masteredCount,
    learning: total - masteredCount
  });
});
