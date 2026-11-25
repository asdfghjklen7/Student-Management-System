const router = require('express').Router();
const c = require('../controllers/studentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.get('/', requireRole('admin', 'professor'), c.getAll);
router.post('/', requireRole('admin'), c.create);
router.put('/:id', requireRole('admin'), c.update);
router.delete('/:id', requireRole('admin'), c.remove);
router.put('/:id/enrollments', requireRole('admin'), c.setEnrollments);

module.exports = router;
