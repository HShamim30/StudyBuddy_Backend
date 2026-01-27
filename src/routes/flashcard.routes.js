const express = require('express');
const router = express.Router();
const { flashcardController } = require('../controllers');
const { protect } = require('../middleware');
const validate = require('../middleware/validate.middleware');
const { flashcardValidators, idValidator } = require('../utils/validators');

router.use(protect);

router.route('/')
  .get(flashcardController.getFlashcards)
  .post(flashcardValidators.create, validate, flashcardController.createFlashcard);

router.post('/bulk', flashcardValidators.createBulk, validate, flashcardController.createBulk);
router.get('/due', flashcardController.getDueCards);
router.get('/stats', flashcardController.getStats);

router.route('/:id')
  .get(idValidator, validate, flashcardController.getFlashcard)
  .put(flashcardValidators.update, validate, flashcardController.updateFlashcard)
  .delete(idValidator, validate, flashcardController.deleteFlashcard);

router.post('/:id/review', flashcardValidators.review, validate, flashcardController.reviewCard);
router.post('/:id/reset', idValidator, validate, flashcardController.resetProgress);

module.exports = router;
