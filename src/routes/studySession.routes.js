const express = require('express');
const router = express.Router();
const { studySessionController } = require('../controllers');
const { protect } = require('../middleware');
const validate = require('../middleware/validate.middleware');
const { sessionValidators } = require('../utils/validators');

router.use(protect);

router.route('/')
  .get(studySessionController.getSessions)
  .post(sessionValidators.create, validate, studySessionController.createSession);

router.get('/stats/daily', studySessionController.getDailyStats);
router.get('/stats/weekly', studySessionController.getWeeklyStats);
router.get('/stats/monthly', studySessionController.getMonthlyStats);
router.get('/stats/overview', studySessionController.getOverview);
router.get('/stats/subjects', studySessionController.getSubjectBreakdown);

module.exports = router;
