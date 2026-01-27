const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const subjectRoutes = require('./subject.routes');
const noteRoutes = require('./note.routes');
const flashcardRoutes = require('./flashcard.routes');
const studySessionRoutes = require('./studySession.routes');

router.use('/auth', authRoutes);
router.use('/subjects', subjectRoutes);
router.use('/notes', noteRoutes);
router.use('/flashcards', flashcardRoutes);
router.use('/sessions', studySessionRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
