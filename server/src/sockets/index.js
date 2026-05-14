import { getBucket } from '../config/db.js';
import { Readable } from 'stream';

// In-memory buffer to accumulate chunks per transfer session
const fileTransfers = {};

const roomState = {};

export default function setupSockets(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userName }) => {
      const userId = socket.id;
      socket.join(roomId);
      
      if (!roomState[roomId]) {
        roomState[roomId] = [];
      }
      
      const newUser = { userId, userName, isAudioMuted: false, isVideoMuted: false };
      roomState[roomId].push(newUser);

      // Send existing users to the newly joined user
      const existingUsers = roomState[roomId].filter(u => u.userId !== userId);
      socket.emit('existing-users', existingUsers);

      socket.to(roomId).emit('user-connected', newUser);

      socket.on('disconnect', () => {
        if (roomState[roomId]) {
          roomState[roomId] = roomState[roomId].filter(u => u.userId !== userId);
        }
        socket.to(roomId).emit('user-disconnected', userId);
        // Cleanup any incomplete transfers from this socket
        Object.keys(fileTransfers).forEach(key => {
          if (key.startsWith(socket.id)) {
            delete fileTransfers[key];
          }
        });
      });

      socket.on('toggled-audio', (isMuted) => {
        if (roomState[roomId]) {
          const user = roomState[roomId].find(u => u.userId === userId);
          if (user) user.isAudioMuted = isMuted;
        }
        socket.to(roomId).emit('user-toggled-audio', userId, isMuted);
      });

      socket.on('toggled-video', (isMuted) => {
        if (roomState[roomId]) {
          const user = roomState[roomId].find(u => u.userId === userId);
          if (user) user.isVideoMuted = isMuted;
        }
        socket.to(roomId).emit('user-toggled-video', userId, isMuted);
      });

      socket.on('send-message', (message) => {
        io.to(roomId).emit('receive-message', {
          userId,
          userName,
          message,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('signal', ({ targetId, signal }) => {
        io.to(targetId).emit('signal', {
          senderId: socket.id,
          signal
        });
      });

      socket.on('draw', (data) => {
        socket.to(roomId).emit('draw', data);
      });

      // ── File Transfer via Socket.IO (bypasses HTTP proxy limits) ──────────

      // Client signals start of a new file transfer
      socket.on('file-transfer-start', ({ transferId, fileName, fileSize, fileType }) => {
        fileTransfers[transferId] = {
          fileName,
          fileSize,
          fileType,
          chunks: [],
          received: 0,
          roomId,
          userId,
          userName
        };
        console.log(`File transfer started: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      });

      // Client sends a chunk of the file as an ArrayBuffer
      socket.on('file-chunk', ({ transferId, chunk, chunkIndex }) => {
        const transfer = fileTransfers[transferId];
        if (!transfer) return;

        transfer.chunks[chunkIndex] = Buffer.from(chunk);
        transfer.received += chunk.byteLength;

        const progress = Math.round((transfer.received / transfer.fileSize) * 100);
        // Send progress back to the sender only
        socket.emit('file-upload-progress', { transferId, progress });
      });

      // Client signals all chunks have been sent
      socket.on('file-transfer-done', async ({ transferId }) => {
        const transfer = fileTransfers[transferId];
        if (!transfer) return;

        try {
          const bucket = getBucket();
          if (!bucket) {
            socket.emit('file-upload-error', { transferId, error: 'Storage not ready' });
            return;
          }

          // Combine all chunks into a single Buffer
          const fullBuffer = Buffer.concat(transfer.chunks);

          // Create a readable stream from the buffer and upload to GridFS
          const readable = Readable.from(fullBuffer);
          const uploadStream = bucket.openUploadStream(transfer.fileName, {
            metadata: {
              contentType: transfer.fileType,
              uploadedBy: transfer.userName,
              uploadedAt: new Date(),
              roomId: transfer.roomId
            }
          });

          readable.pipe(uploadStream);

          uploadStream.on('finish', () => {
            const fileId = uploadStream.id.toString();
            console.log(`File stored in GridFS: ${transfer.fileName} (id: ${fileId})`);

            const fileMsgData = JSON.stringify({
              type: 'file',
              name: transfer.fileName,
              size: transfer.fileSize,
              fileType: transfer.fileType,
              fileId: fileId
            });

            // Broadcast the file message to everyone in the room
            io.to(transfer.roomId).emit('receive-message', {
              userId: transfer.userId,
              userName: transfer.userName,
              message: fileMsgData,
              timestamp: new Date().toISOString()
            });

            socket.emit('file-upload-success', { transferId, fileId });
            delete fileTransfers[transferId];
          });

          uploadStream.on('error', (err) => {
            console.error('GridFS upload error:', err);
            socket.emit('file-upload-error', { transferId, error: err.message });
            delete fileTransfers[transferId];
          });

        } catch (err) {
          console.error('File transfer error:', err);
          socket.emit('file-upload-error', { transferId, error: err.message });
          delete fileTransfers[transferId];
        }
      });

    });
  });
}
