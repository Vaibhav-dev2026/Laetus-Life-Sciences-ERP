const router = require('express').Router();
const mongoose = require('mongoose');

router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.status(200).json({ success: true, status: 'ok', database: dbState === 1 ? 'connected' : 'disconnected' });
});

module.exports = router;
