# 🚀 ARK Meet - Enterprise-Grade Video Collaboration

ARK Meet is a powerful, real-time video conferencing and collaboration platform built with modern web technologies. It enables seamless communication through high-quality video/audio calls, interactive whiteboards, and instant file sharing.

![ARK Meet Logo](https://img.shields.io/badge/ARK-Meet-6366f1?style=for-the-badge&logo=video)

## ✨ Features

- **📹 High-Quality Video & Audio**: Real-time communication powered by WebRTC (Simple-Peer) with minimal latency.
- **🎨 Interactive Whiteboard**: Collaborative drawing canvas using Fabric.js for brainstorming and visualization.
- **📁 Large File Sharing**: Transfer files up to 500MB directly within the meeting, backed by MongoDB GridFS.
- **💬 Real-Time Chat**: Instant messaging with persistent chat history during sessions.
- **🖥️ Screen Sharing**: Share your screen with participants for presentations and demos.
- **🛡️ Secure & Private**: End-to-end signaling and encrypted data channels.
- **📱 Responsive Design**: Fully optimized for desktop and mobile browsers.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS
- **Real-time**: Socket.io-client
- **WebRTC**: Simple-Peer
- **State Management**: Zustand
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose & GridFS)
- **Real-time**: Socket.io
- **Auth**: JSON Web Tokens (JWT) & Bcrypt

---

## 📁 Project Structure

```text
ARK/
├── client/          # Vite + React Frontend
│   ├── src/
│   │   ├── context/ # Socket & Global Context
│   │   ├── pages/   # Room, Home, etc.
│   │   └── lib/     # Utilities
│   └── vercel.json  # Vercel Deployment Config
└── server/          # Node.js + Express Backend
    ├── src/
    │   ├── config/  # Database Connection
    │   ├── routes/  # API Endpoints
    │   └── sockets/ # Socket.io Event Logic
    └── uploads/     # Local storage fallback
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account (or local MongoDB)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/ARK-meet.git
   cd ARK-meet
   ```

2. **Setup the Server**:
   ```bash
   cd server
   npm install
   # Create a .env file with:
   # MONGO_URI=your_mongodb_uri
   # JWT_SECRET=your_secret
   # PORT=3000
   npm run dev
   ```

3. **Setup the Client**:
   ```bash
   cd ../client
   npm install
   # Create a .env file with:
   # VITE_SERVER_URL=http://localhost:3000
   npm run dev
   ```

---

## 🌐 Deployment

### Backend (Render/Railway)
1. Set the root directory to `server`.
2. Add environment variables: `MONGO_URI`, `JWT_SECRET`.
3. Build command: `npm install`.
4. Start command: `npm start`.

### Frontend (Vercel)
1. Set the root directory to `client`.
2. Add environment variable: `VITE_SERVER_URL` (pointing to your deployed backend).
3. Vercel will automatically use the `vercel.json` for routing.

---

## 📜 License
Distributed under the ISC License.

---

**Developed by Adarsh Patnaik**
