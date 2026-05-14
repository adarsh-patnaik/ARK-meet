import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Keyboard, Users, Shield, Zap, LayoutDashboard } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const generateMeetingCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let code = '';
    for (let i = 0; i < 9; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6, 9)}`;
  };

  const createRoom = () => {
    if (!name) return;
    const newRoomId = generateMeetingCode();
    navigate(`/room/${newRoomId}?name=${encodeURIComponent(name)}`);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!name || !roomId) return;
    navigate(`/room/${roomId}?name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-indigo-500/30 overflow-hidden relative">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              ARK Meet
            </h1>
          </div>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-medium">
            Enterprise-grade video conferencing and real-time collaboration platform.
          </p>
        </motion.div>

        <div className="w-full max-w-md grid gap-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Your Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={createRoom}
                  disabled={!name}
                  className="w-full bg-white hover:bg-zinc-100 text-zinc-900 font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Video className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Start New Meeting
                </button>
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink-0 mx-4 text-sm text-zinc-500">or join existing</span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

              <form onSubmit={joinRoom} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Room Code</label>
                  <div className="relative">
                    <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="text"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="e.g. abc-def-ghi"
                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!roomId || !name}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700/50"
                >
                  Join Meeting
                </button>
              </form>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-4xl mx-auto w-full"
        >
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm hover:bg-zinc-900/50 transition-colors">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center mb-4 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Secure & Private</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              End-to-end encryption ensures your meetings stay private.
            </p>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm hover:bg-zinc-900/50 transition-colors">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4 text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Lightning Fast</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Built on WebRTC for minimal latency.
            </p>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm hover:bg-zinc-900/50 transition-colors">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 text-blue-400">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Rich Collaboration</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Integrated whiteboard, screen sharing, and peer-to-peer file transfers.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
