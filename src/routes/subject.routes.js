const express = require('express');
const router = express.Router();
const { subjectController } = require('../controllers');
const { protect } = require('../middleware');
const validate = require('../middleware/validate.middleware');
const { subjectValidators, idValidator } = require('../utils/validators');

router.use(protect);

router.route('/')
  .get(subjectController.getSubjects)
  .post(subjectValidators.create, validate, subjectController.createSubject);

router.put('/reorder', subjectValidators.reorder, validate, subjectController.reorderSubjects);

router.route('/:id')
  .get(idValidator, validate, subjectController.getSubject)
  .put(subjectValidators.update, validate, subjectController.updateSubject)
  .delete(idValidator, validate, subjectController.deleteSubject);

module.exports = router;
