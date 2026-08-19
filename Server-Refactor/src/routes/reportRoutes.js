const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createReport, listReports, isAppAdmin } = require('../controllers/reportController');

router.use(authenticateToken);
router.get('/status', (req, res) => {
    res.json({ admin: isAppAdmin(req.userId) });
});
router.post('/', createReport);
router.get('/', listReports);

module.exports = router;
