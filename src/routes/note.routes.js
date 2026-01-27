const express = require('express');
const router = express.Router();
const { noteController } = require('../controllers');
const { protect } = require('../middleware');
const validate = require('../middleware/validate.middleware');
const { noteValidators, idValidator } = require('../utils/validators');

router.use(protect);

router.route('/')
  .get(noteController.getNotes)
  .post(noteValidators.create, validate, noteController.createNote);

router.get('/revision/due', noteController.getDueForRevision);

router.route('/:id')
  .get(idValidator, validate, noteController.getNote)
  .put(noteValidators.update, validate, noteController.updateNote)
  .delete(idValidator, validate, noteController.deleteNote);

router.patch('/:id/pin', idValidator, validate, noteController.togglePin);
router.post('/:id/revision', idValidator, validate, noteController.markRevised);
router.post('/:id/schedule-revision', idValidator, validate, noteController.scheduleRevision);

module.exports = router;
