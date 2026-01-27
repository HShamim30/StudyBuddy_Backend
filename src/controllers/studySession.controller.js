const StudySession = require('../models/StudySession');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

exports.getSessions = asyncHandler(async (req, res) => {
  const { type, subjectId, startDate, endDate, limit = 50 } = req.query;

  const query = { userId: req.user._id };

  if (type) query.type = type;
  if (subjectId) query.subjectId = subjectId;
  if (startDate || endDate) {
    query.startedAt = {};
    if (startDate) query.startedAt.$gte = new Date(startDate);
    if (endDate) query.startedAt.$lte = new Date(endDate);
  }

  const sessions = await StudySession.find(query)
    .populate('subjectId', 'name color icon')
    .sort({ startedAt: -1 })
    .limit(parseInt(limit));

  ApiResponse.success(res, { sessions, count: sessions.length });
});

exports.createSession = asyncHandler(async (req, res) => {
  const { type, duration, startedAt, endedAt, subjectId, cardsReviewed, notesRevised } = req.body;

  const session = await StudySession.create({
    userId: req.user._id,
    type,
    duration,
    startedAt,
    endedAt,
    subjectId,
    cardsReviewed,
    notesRevised
  });

  await session.populate('subjectId', 'name color icon');

  ApiResponse.created(res, { session }, 'Session recorded');
});

exports.getDailyStats = asyncHandler(async (req, res) => {
  const stats = await StudySession.getDailyStats(req.user._id);

  ApiResponse.success(res, { stats });
});

exports.getWeeklyStats = asyncHandler(async (req, res) => {
  const stats = await StudySession.getWeeklyStats(req.user._id);

  const weekDays = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    weekDays.push(date.toISOString().split('T')[0]);
  }

  const filledStats = weekDays.map(day => {
    const existing = stats.find(s => s._id === day);
    return existing || {
      _id: day,
      totalMinutes: 0,
      sessions: 0,
      cardsReviewed: 0,
      notesRevised: 0
    };
  });

  ApiResponse.success(res, { stats: filledStats });
});

exports.getMonthlyStats = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  
  const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth() + 1) - 1, 1);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

  const stats = await StudySession.aggregate([
    {
      $match: {
        userId: req.user._id,
        startedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
        totalMinutes: { $sum: '$duration' },
        sessions: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  ApiResponse.success(res, { stats, month: startDate.getMonth() + 1, year: startDate.getFullYear() });
});

exports.getOverview = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [dailyStats, weeklyStats, totalStats] = await Promise.all([
    StudySession.getDailyStats(userId),
    StudySession.getWeeklyStats(userId),
    StudySession.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$duration' },
          totalSessions: { $sum: 1 },
          totalCardsReviewed: { $sum: '$cardsReviewed' },
          totalNotesRevised: { $sum: '$notesRevised' }
        }
      }
    ])
  ]);

  const weeklyTotal = weeklyStats.reduce((acc, day) => acc + day.totalMinutes, 0);

  ApiResponse.success(res, {
    today: dailyStats,
    weeklyTotal,
    weeklyBreakdown: weeklyStats,
    allTime: totalStats[0] || {
      totalMinutes: 0,
      totalSessions: 0,
      totalCardsReviewed: 0,
      totalNotesRevised: 0
    }
  });
});

exports.getSubjectBreakdown = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const breakdown = await StudySession.aggregate([
    {
      $match: {
        userId: req.user._id,
        startedAt: { $gte: startDate },
        subjectId: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$subjectId',
        totalMinutes: { $sum: '$duration' },
        sessions: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subject'
      }
    },
    { $unwind: '$subject' },
    {
      $project: {
        _id: 1,
        totalMinutes: 1,
        sessions: 1,
        name: '$subject.name',
        color: '$subject.color'
      }
    },
    { $sort: { totalMinutes: -1 } }
  ]);

  ApiResponse.success(res, { breakdown });
});
