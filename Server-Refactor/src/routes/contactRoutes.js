const express = require('express');
const router = express.Router();
const {
    getContacts,
    addContact,
    deleteContact,
    unhideContact,
    searchUsers
} = require('../controllers/contactController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getContacts);
router.post('/', addContact);
router.delete('/:contactId', deleteContact);
router.patch('/:contactId/unhide', unhideContact);
router.get('/search', searchUsers);

module.exports = router;