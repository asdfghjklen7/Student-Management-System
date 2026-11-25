const router = require('express').Router();
const c = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));
router.get('/', c.list);
router.patch('/:id/status', c.setStatus);
router.delete('/:id', c.remove);

module.exports = router;
