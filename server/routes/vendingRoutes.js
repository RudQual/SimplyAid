const router = require('express').Router();
const { vendingLogin, vendingDispense } = require('../controllers/vendingController');

router.post('/login', vendingLogin);
router.post('/dispense', vendingDispense);

module.exports = router;
