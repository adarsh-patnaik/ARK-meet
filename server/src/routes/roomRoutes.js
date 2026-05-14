import express from 'express';

const router = express.Router();

router.post('/create', (req, res) => res.json({ roomId: 'test-room-id' }));
router.get('/:roomId', (req, res) => res.json({ roomId: req.params.roomId }));

export default router;
