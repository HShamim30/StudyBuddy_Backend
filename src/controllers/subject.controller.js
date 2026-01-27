const Subject = require('../models/Subject');
const Note = require('../models/Note');
const Flashcard = require('../models/Flashcard');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

exports.getSubjects = asyncHandler(async (req, res) => {
  const subjects = await Subject.find({ userId: req.user._id })
    .sort({ order: 1, createdAt: -1 });

  ApiResponse.success(res, { subjects });
});

exports.getSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!subject) {
    return ApiResponse.notFound(res, 'Subject not found');
  }

  ApiResponse.success(res, { subject });
});

exports.createSubject = asyncHandler(async (req, res) => {
  const { name, color, icon } = req.body;

  const count = await Subject.countDocuments({ userId: req.user._id });

  const subject = await Subject.create({
    userId: req.user._id,
    name,
    color,
    icon,
    order: count
  });

  ApiResponse.created(res, { subject }, 'Subject created');
});

exports.updateSubject = asyncHandler(async (req, res) => {
  const { name, color, icon, order } = req.body;

  const subject = await Subject.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { name, color, icon, order },
    { new: true, runValidators: true }
  );

  if (!subject) {
    return ApiResponse.notFound(res, 'Subject not found');
  }

  ApiResponse.success(res, { subject }, 'Subject updated');
});

exports.deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!subject) {
    return ApiResponse.notFound(res, 'Subject not found');
  }

  await Note.deleteMany({ subjectId: req.params.id });
  await Flashcard.deleteMany({ subjectId: req.params.id });

  ApiResponse.success(res, null, 'Subject and associated data deleted');
});

exports.reorderSubjects = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;

  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, userId: req.user._id },
      update: { order: index }
    }
  }));

  await Subject.bulkWrite(bulkOps);

  const subjects = await Subject.find({ userId: req.user._id })
    .sort({ order: 1 });

  ApiResponse.success(res, { subjects }, 'Subjects reordered');
});
