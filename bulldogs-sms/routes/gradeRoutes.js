const router = require('express').Router();
const c = require('../controllers/gradeController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.get('/', c.getAll);                       // scoped by role in the controller
router.post('/', requireRole('admin', 'professor'), c.create);
router.put('/:id', requireRole('admin', 'professor'), c.update);
router.delete('/:id', requireRole('admin', 'professor'), c.remove);

module.exports = router;
