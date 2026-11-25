const router = require('express').Router();
const c = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/register', c.register);
router.post('/login', c.login);
router.get('/me', authenticate, c.me);
router.put('/photo', authenticate, requireRole('student'), c.updatePhoto);

module.exports = router;
