import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB, { getBucket } from './config/db.js';
import setupSockets from './sockets/index.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import { ObjectId } from 'mongodb';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, true),
    methods: ["GET", "POST"],
    credentials: true
  },
  // Allow up to 50MB per socket message (for file chunks)
  maxHttpBufferSize: 50 * 1024 * 1024
});

// Middleware
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true
}));
app.use(express.json());

// Database connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// ── GridFS File Download Route ──────────────────────────────────────────────
// Files are uploaded via Socket.IO chunks and stored in MongoDB GridFS.
// This endpoint lets clients download/view stored files by their GridFS ID.
app.get('/api/files/:fileId', async (req, res) => {
  try {
    const bucket = getBucket();
    if (!bucket) {
      return res.status(503).json({ error: 'Storage not ready' });
    }

    const fileId = new ObjectId(req.params.fileId);

    // Find file metadata
    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // Set headers so the browser knows the file type and filename
    res.set('Content-Type', file.metadata?.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.set('Content-Length', file.length);

    // Stream the file from GridFS directly to the response
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', (err) => {
      console.error('GridFS download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    });

  } catch (err) {
    console.error('File download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Socket.io Setup
setupSockets(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
