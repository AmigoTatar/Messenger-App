const express = require('express');
const router = express.Router();
const {
    getContacts,
    addContact,
    deleteContact,
    searchUsers
} = require('../controllers/contactController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getContacts);
router.post('/', addContact);
router.delete('/:contactId', deleteContact);
router.get('/search', searchUsers);

module.exports = router;