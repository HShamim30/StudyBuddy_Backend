const Note = require('../models/Note');
const Subject = require('../models/Subject');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { escapeRegex, asMongoId } = require('../utils/sanitize');

exports.getNotes = asyncHandler(async (req, res) => {
  const { subjectId, isPinned, search, tag } = req.query;

  const query = { userId: req.user._id };

  const sid = asMongoId(subjectId);
  if (sid) query.subjectId = sid;
  if (isPinned === 'true' || isPinned === 'false') query.isPinned = isPinned === 'true';
  if (typeof tag === 'string' && tag.length <= 50) query.tags = tag;
  if (typeof search === 'string' && search.length <= 200) {
    const safe = escapeRegex(search);
    query.$or = [
      { title: { $regex: safe, $options: 'i' } },
      { content: { $regex: safe, $options: 'i' } }
    ];
  }

  const notes = await Note.find(query)
    .populate('subjectId', 'name color icon')
    .sort({ isPinned: -1, updatedAt: -1 });

  ApiResponse.success(res, { notes, count: notes.length });
});

exports.getNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user._id
  }).populate('subjectId', 'name color icon');

  if (!note) {
    return ApiResponse.notFound(res, 'Note not found');
  }

  ApiResponse.success(res, { note });
});

exports.createNote = asyncHandler(async (req, res) => {
  const { subjectId, title, content, tags } = req.body;

  const subject = await Subject.findOne({
    _id: subjectId,
    userId: req.user._id
  });

  if (!subject) {
    return ApiResponse.badRequest(res, 'Invalid subject');
  }

  const note = await Note.create({
    userId: req.user._id,
    subjectId,
    title,
    content,
    tags
  });

  await note.populate('subjectId', 'name color icon');

  ApiResponse.created(res, { note }, 'Note created');
});

exports.updateNote = asyncHandler(async (req, res) => {
  const { title, content, isPinned, tags } = req.body;

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (isPinned !== undefined) updateData.isPinned = isPinned;
  if (tags !== undefined) updateData.tags = tags;

  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    updateData,
    { new: true, runValidators: true }
  ).populate('subjectId', 'name color icon');

  if (!note) {
    return ApiResponse.notFound(res, 'Note not found');
  }

  ApiResponse.success(res, { note }, 'Note updated');
});

exports.deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!note) {
    return ApiResponse.notFound(res, 'Note not found');
  }

  ApiResponse.success(res, null, 'Note deleted');
});

exports.togglePin = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!note) {
    return ApiResponse.notFound(res, 'Note not found');
  }

  note.isPinned = !note.isPinned;
  await note.save();

  ApiResponse.success(res, { note }, `Note ${note.isPinned ? 'pinned' : 'unpinned'}`);
});

exports.getDueForRevision = asyncHandler(async (req, res) => {
  const now = new Date();

  const notes = await Note.find({
    userId: req.user._id,
    nextRevisionDate: { $lte: now }
  })
    .populate('subjectId', 'name color icon')
    .sort({ nextRevisionDate: 1 });

  ApiResponse.success(res, { notes, count: notes.length });
});

exports.markRevised = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!note) {
    return ApiResponse.notFound(res, 'Note not found');
  }

  note.calculateNextRevision();
  await note.save();

  await note.populate('subjectId', 'name color icon');

  ApiResponse.success(res, { note }, 'Revision recorded');
});

exports.scheduleRevision = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!note) {
    return ApiResponse.notFound(res, 'Note not found');
  }

  note.nextRevisionDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  note.revisionCount = 0;
  await note.save();

  ApiResponse.success(res, { note }, 'Revision scheduled');
});
