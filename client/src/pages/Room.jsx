import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MessageSquare, PhoneOff, Settings, Users, SquarePen, Paperclip } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import Peer from 'simple-peer';
import toast, { Toaster } from 'react-hot-toast';

const PeerVideo = ({ peer }) => {
  const ref = useRef();
  useEffect(() => {
    if (peer.stream && ref.current) {
      ref.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
};

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name');
  const mode = searchParams.get('mode') || 'meeting';
  const navigate = useNavigate();
  const socket = useSocket();

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState(mode === 'chat' ? 'chat' : 'video');
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [showSettings, setShowSettings] = useState(false);
  const [devices, setDevices] = useState({ audio: [], video: [] });

  const myVideo = useRef();
  const streamRef = useRef(null);   // always holds the latest stream
  const [stream, setStream] = useState(null);
  const peersRef = useRef({});

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize canvas
  useEffect(() => {
    if (activeTab === 'whiteboard' && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
    }
  }, [activeTab]);

  // keep streamRef in sync with stream state
  useEffect(() => { streamRef.current = stream; }, [stream]);

  // Sync local stream to video element
  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    let isMounted = true;
    if (!socket) return;

    if (mode === 'chat') {
      socket.emit('join-room', { roomId, userId: socket.id, userName: name });
    } else {
      // Request camera + mic only when meeting starts
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then((currentStream) => {
            if (!isMounted) {
              currentStream.getTracks().forEach(track => track.stop());
              return;
            }
            streamRef.current = currentStream;
            setStream(currentStream);
            if (myVideo.current) {
              myVideo.current.srcObject = currentStream;
              myVideo.current.muted = true; // force mute — React's JSX muted attr is unreliable
            }
            socket.emit('join-room', { roomId, userId: socket.id, userName: name });
          })
          .catch((err) => {
            console.error("Failed to get local stream", err);
            if (isMounted) socket.emit('join-room', { roomId, userId: socket.id, userName: name });
          });
      } else {
        console.warn("Media devices not supported (requires HTTPS or localhost).");
        toast.error("Camera/Mic access requires HTTPS. Please use localhost or a secure tunnel (ngrok).", {
          duration: 6000,
          style: { background: '#18181b', color: '#fff', border: '1px solid #ef4444' }
        });
        if (isMounted) socket.emit('join-room', { roomId, userId: socket.id, userName: name });
      }
    }

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(deviceInfos => {
        const audio = deviceInfos.filter(d => d.kind === 'audioinput');
        const video = deviceInfos.filter(d => d.kind === 'videoinput');
        setDevices({ audio, video });
      }).catch(err => console.error("Failed to enumerate devices", err));
    }

    socket.on('existing-users', (users) => {
      const peersData = users.map(u => {
        const peer = createPeer(u.userId, socket.id, streamRef.current);
        peersRef.current[u.userId] = peer;
        return u;
      });
      setPeers(peersData);
    });

    socket.on('user-connected', (newUser) => {
      console.log('User connected:', newUser.userName);
      setPeers((prev) => [...prev, newUser]);
    });

    socket.on('signal', ({ senderId, signal }) => {
      let peer = peersRef.current[senderId];
      if (!peer) {
        peer = addPeer(senderId, streamRef.current);
        peersRef.current[senderId] = peer;
      }
      if (peer) {
        peer.signal(signal);
      }
    });

    socket.on('user-disconnected', (userId) => {
       console.log('User disconnected:', userId);
       setPeers((prev) => prev.filter(p => p.userId !== userId));
       if (peersRef.current[userId]) {
         peersRef.current[userId].destroy();
         delete peersRef.current[userId];
       }
    });

    socket.on('user-toggled-audio', (userId, isMuted) => {
      setPeers((prev) => prev.map(p => p.userId === userId ? { ...p, isAudioMuted: isMuted } : p));
    });

    socket.on('user-toggled-video', (userId, isMuted) => {
      setPeers((prev) => prev.map(p => p.userId === userId ? { ...p, isVideoMuted: isMuted } : p));
    });

    socket.on('receive-message', (msgData) => {
      // For file messages, the server broadcasts after GridFS storage, so always add them.
      // For text messages, skip self (we add optimistically in sendMessage).
      let isFile = false;
      try { isFile = JSON.parse(msgData.message)?.type === 'file'; } catch (_) {}
      if (msgData.userId !== socket.id || isFile) {
        setMessages((prev) => [...prev, msgData]);
      }
    });

    socket.on('draw', ({ x, y, type, color }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const scaledX = x * canvas.width;
      const scaledY = y * canvas.height;

      if (type === 'start') {
        ctx.beginPath();
        ctx.moveTo(scaledX, scaledY);
      } else if (type === 'draw') {
        ctx.lineTo(scaledX, scaledY);
        ctx.strokeStyle = color || '#ffffff';
        ctx.stroke();
      }
    });

    // File upload progress/errors from server
    socket.on('file-upload-progress', ({ transferId, progress }) => {
      setUploadProgress(progress);
    });

    socket.on('file-upload-success', ({ transferId, fileId }) => {
      setIsUploading(false);
      setUploadProgress(0);
      toast.success('File uploaded successfully! 🎉', {
        duration: 4000,
        style: {
          background: '#18181b',
          color: '#fff',
          border: '1px solid #3f3f46',
          borderRadius: '12px',
        },
      });
    });

    socket.on('file-upload-error', ({ transferId, error }) => {
      alert(`File upload failed: ${error}`);
      setIsUploading(false);
      setUploadProgress(0);
    });

    return () => {
      isMounted = false;
      socket.off('existing-users');
      socket.off('user-connected');
      socket.off('signal');
      socket.off('user-disconnected');
      socket.off('user-toggled-audio');
      socket.off('user-toggled-video');
      socket.off('receive-message');
      socket.off('draw');
      socket.off('file-upload-progress');
      socket.off('file-upload-success');
      socket.off('file-upload-error');
      
      Object.values(peersRef.current).forEach(peer => peer.destroy());
      peersRef.current = {};

      // Release camera + mic when component unmounts (meeting ended / navigated away)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (myVideo.current && myVideo.current.srcObject) {
        myVideo.current.srcObject.getTracks().forEach(track => track.stop());
        myVideo.current.srcObject = null;
      }
    };
  }, [socket, roomId]);

  const createPeer = (userToSignal, callerID, stream) => {
    const options = {
      initiator: true,
      trickle: false,
    };
    if (stream) options.stream = stream;

    const peer = new Peer(options);

    peer.on('signal', signal => {
      socket.emit('signal', { targetId: userToSignal, signal });
    });

    peer.on('stream', currentStream => {
      setPeers(prev => prev.map(p => {
        if (p.userId === userToSignal) {
          return { ...p, stream: currentStream };
        }
        return p;
      }));
    });

    return peer;
  };

  const addPeer = (callerID, stream) => {
    const options = {
      initiator: false,
      trickle: false,
    };
    if (stream) options.stream = stream;

    const peer = new Peer(options);

    peer.on('signal', signal => {
      socket.emit('signal', { targetId: callerID, signal });
    });

    peer.on('stream', currentStream => {
      setPeers(prev => prev.map(p => {
        if (p.userId === callerID) {
          return { ...p, stream: currentStream };
        }
        return p;
      }));
    });

    return peer;
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Reset input so same file can be re-selected
    e.target.value = '';

    if (file.size > 500 * 1024 * 1024) {
      alert('File is larger than 500MB.');
      return;
    }
    
    if (!socket) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Unique ID for this transfer session
    const transferId = `${socket.id}-${Date.now()}`;
    const CHUNK_SIZE = 256 * 1024; // 256 KB per chunk — safe for socket message size

    // Signal start to the server
    socket.emit('file-transfer-start', {
      transferId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream'
    });

    // Read and send the file in sequential chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const buffer = await slice.arrayBuffer();

      socket.emit('file-chunk', {
        transferId,
        chunk: buffer,
        chunkIndex: i
      });

      // Update local progress bar in real time
      setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    // Signal that all chunks have been sent
    socket.emit('file-transfer-done', { transferId });
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);

    socket.emit('draw', { 
      x: x / canvas.width, 
      y: y / canvas.height, 
      type: 'start', 
      color: '#ffffff' 
    });
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    socket.emit('draw', { 
      x: x / canvas.width, 
      y: y / canvas.height, 
      type: 'draw', 
      color: '#ffffff' 
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const renderMessageContent = (msgString) => {
    try {
      const parsed = JSON.parse(msgString);
      if (parsed.type === 'file') {
        const sizeMb = (parsed.size / (1024 * 1024)).toFixed(2);
        // Construct the download URL using the GridFS file ID and server URL
        const serverBaseUrl = import.meta.env.VITE_SERVER_URL || '';
        const downloadUrl = `${serverBaseUrl}/api/files/${parsed.fileId}`;
        return (
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={parsed.name} className="flex items-center gap-3 p-2.5 mt-1 bg-black/20 hover:bg-black/40 rounded-xl transition-colors border border-white/10 group">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
              <Paperclip className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex flex-col max-w-[200px]">
              <span className="text-sm font-medium text-white truncate">{parsed.name}</span>
              <span className="text-xs text-zinc-400">{sizeMb} MB · Click to download</span>
            </div>
          </a>
        );
      }
    } catch (e) {
      return <span>{msgString}</span>;
    }
    return <span>{msgString}</span>;
  };

  const sendMessage = () => {
    if (newMessage.trim() && socket) {
      // Optimistic update — show immediately for the sender
      const localMsg = {
        userId: socket.id,
        userName: name,
        message: newMessage.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, localMsg]);
      socket.emit('send-message', newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleAudio = async () => {
    if (!stream) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !isVideoMuted });
        setStream(newStream);
        setIsAudioMuted(false);
        if (socket) socket.emit('toggled-audio', false);
        toast.success("Microphone started");
      } catch (err) {
        console.error("Failed to acquire audio on toggle:", err);
        toast.error("Could not access microphone.");
      }
      return;
    }

    setIsAudioMuted(prev => {
      const newMutedState = !prev;
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0) {
        toast.error("No audio track found");
        return prev;
      }
      tracks.forEach(track => {
        track.enabled = !newMutedState;
      });
      if (socket) socket.emit('toggled-audio', newMutedState);
      toast(newMutedState ? "Microphone Muted" : "Microphone Unmuted", {
        icon: newMutedState ? "🔇" : "🎙️",
        style: { background: '#18181b', color: '#fff', border: '1px solid #3f3f46' }
      });
      return newMutedState;
    });
  };

  const toggleVideo = async () => {
    if (!stream) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !isAudioMuted });
        setStream(newStream);
        setIsVideoMuted(false);
        if (socket) socket.emit('toggled-video', false);
        toast.success("Camera started");
      } catch (err) {
        console.error("Failed to acquire video on toggle:", err);
        toast.error("Could not access camera.");
      }
      return;
    }

    setIsVideoMuted(prev => {
      const newMutedState = !prev;
      const tracks = stream.getVideoTracks();
      if (tracks.length === 0) {
        toast.error("No video track found");
        return prev;
      }
      tracks.forEach(track => {
        track.enabled = !newMutedState;
      });
      if (socket) socket.emit('toggled-video', newMutedState);
      toast(newMutedState ? "Camera Off" : "Camera On", {
        icon: newMutedState ? "🚫" : "📹",
        style: { background: '#18181b', color: '#fff', border: '1px solid #3f3f46' }
      });
      return newMutedState;
    });
  };

  const toggleScreenShare = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert("Screen sharing is not supported on this browser or device.");
      return;
    }

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (myVideo.current) {
          myVideo.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);

        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error("Error sharing screen", err);
        if (err.name !== 'NotAllowedError') {
          alert("Could not start screen share: " + err.message);
        }
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (myVideo.current && myVideo.current.srcObject) {
      // Explicitly stop the screen share track
      myVideo.current.srcObject.getTracks().forEach(track => track.stop());
    }
    if (myVideo.current && stream) {
      myVideo.current.srcObject = stream;
      myVideo.current.muted = true;
    }
    setIsScreenSharing(false);
  };

  const changeDevice = async (kind, deviceId) => {
    // Stop current tracks before switching device
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    const constraints = {
      audio: kind === 'audioinput' ? { deviceId: { exact: deviceId } } : !isAudioMuted,
      video: kind === 'videoinput' ? { deviceId: { exact: deviceId } } : !isVideoMuted
    };
    try {
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;
      setStream(newStream);
      if (myVideo.current) {
        myVideo.current.srcObject = newStream;
        myVideo.current.muted = true;
      }
    } catch (err) {
      console.error("Error changing device", err);
    }
  };

  const leaveRoom = () => {
    // Explicitly stop all tracks — releases camera/mic indicator in browser
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (myVideo.current && myVideo.current.srcObject) {
      myVideo.current.srcObject.getTracks().forEach(track => track.stop());
      myVideo.current.srcObject = null;
    }
    setStream(null);
    navigate('/');
  };

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden relative">
      <Toaster position="top-center" />
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-6">
            <h2 className="text-xl font-semibold">Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Microphone</label>
                <select 
                  onChange={(e) => changeDevice('audioinput', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  {devices.audio.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0,5)}`}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Camera</label>
                <select 
                  onChange={(e) => changeDevice('videoinput', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  {devices.video.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,5)}`}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Meeting Code</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={roomId}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none"
                  />
                  <button 
                    onClick={() => navigator.clipboard.writeText(roomId)}
                    className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <VideoIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">ARK Meeting</h1>
            <p className="text-xs text-zinc-400">ID: {roomId}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {mode !== 'chat' && (
          <main className={`flex-1 p-4 flex flex-col ${activeTab !== 'video' ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden relative group">
              {/* Self Video */}
              {stream ? (
                <video 
                  ref={myVideo} 
                  autoPlay 
                  muted 
                  playsInline
                  className={`w-full h-full object-cover ${isScreenSharing ? '' : 'scale-x-[-1]'}`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                      {name ? name.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <p className="text-lg font-medium">{name || 'User'}</p>
                    <p className="text-sm text-zinc-400">Camera is off</p>
                  </div>
                </div>
              )}

              {/* Other Peers (Placeholder for now) */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 pb-20">
                 <div className="w-full h-full flex flex-wrap items-end justify-end gap-2 md:gap-4 pointer-events-auto">
                    {peers.map((peer) => (
                      <div key={peer.userId} className="w-28 h-28 md:w-48 md:h-36 bg-zinc-800 rounded-xl overflow-hidden relative shadow-lg border border-zinc-700 flex flex-col items-center justify-center shrink-0">
                        {peer.stream ? (
                          <PeerVideo peer={peer} />
                        ) : (
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-full flex items-center justify-center text-lg md:text-xl font-bold mb-1 md:mb-2">
                            {peer.userName ? peer.userName.charAt(0).toUpperCase() : 'A'}
                          </div>
                        )}
                        {!peer.stream && <p className="text-xs md:text-sm font-medium truncate w-full text-center px-2">{peer.userName}</p>}
                        <div className="absolute bottom-2 left-2 flex gap-1 z-10">
                          {peer.isAudioMuted && <div className="bg-zinc-900/80 p-1 rounded-full"><MicOff className="w-3 h-3 text-red-400" /></div>}
                          {peer.isVideoMuted && <div className="bg-zinc-900/80 p-1 rounded-full"><VideoOff className="w-3 h-3 text-red-400" /></div>}
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Overlay Controls */}
              <div className="absolute bottom-4 left-4 flex gap-2">
                <span className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10">
                  You (Host)
                </span>
              </div>
            </div>
          </main>
        )}

        {/* Sidebar Panel */}
        <aside className={`${mode === 'chat' ? 'w-full' : 'w-full md:w-[360px] border-l'} bg-zinc-900 border-zinc-800 flex flex-col ${activeTab === 'video' && mode !== 'chat' ? 'hidden' : 'flex'}`}>
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'chat' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-400 hover:text-white'}`}
            >
              Chat
            </button>
            <button 
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'participants' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-400 hover:text-white'}`}
            >
              People ({1 + peers.length})
            </button>
            <button 
              onClick={() => setActiveTab('whiteboard')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'whiteboard' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-zinc-400 hover:text-white'}`}
            >
              Whiteboard
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-hidden p-4 flex flex-col">
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.userId === socket.id ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-medium text-zinc-400">{msg.userName}</span>
                          <span className="text-[10px] text-zinc-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm break-words ${msg.userId === socket.id ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm border border-zinc-700/50'}`}>
                          {renderMessageContent(msg.message)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {isUploading && (
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2 overflow-hidden">
                    <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                )}
                <div className="mt-2 flex gap-2 items-center">
                  <label className={`p-2 rounded-xl transition-colors cursor-pointer ${isUploading ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Send File (up to 500MB)">
                    <Paperclip className="w-5 h-5" />
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..." 
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" 
                  />
                  <button 
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'participants' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm font-medium">
                      {name ? name.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{name || 'User'} (You)</p>
                      <p className="text-xs text-zinc-400">Host</p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-zinc-400">
                    {isAudioMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4" />}
                    {isVideoMuted ? <VideoOff className="w-4 h-4 text-red-400" /> : <VideoIcon className="w-4 h-4" />}
                  </div>
                </div>

                {peers.map((peer) => (
                  <div key={peer.userId} className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {peer.userName ? peer.userName.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{peer.userName}</p>
                        <p className="text-xs text-zinc-400">Participant</p>
                      </div>
                    </div>
                    <div className="flex gap-2 text-zinc-400">
                      {peer.isAudioMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4" />}
                      {peer.isVideoMuted ? <VideoOff className="w-4 h-4 text-red-400" /> : <VideoIcon className="w-4 h-4" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'whiteboard' && (
              <div className="h-full w-full bg-zinc-950 relative rounded-xl border border-zinc-800 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseOut={stopDrawing}
                  className="w-full h-full touch-none cursor-crosshair"
                />
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 pointer-events-none">
                  Collaborative Whiteboard
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom Controls Bar */}
      <footer className="h-auto min-h-[5rem] py-3 md:py-0 md:h-20 bg-zinc-900 border-t border-zinc-800 flex items-center justify-center px-2 md:px-4 relative overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 md:gap-4 min-w-max">
          {mode !== 'chat' && (
            <>
              <button 
                onClick={toggleAudio}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isAudioMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
              >
                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              <button 
                onClick={toggleVideo}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isVideoMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
              >
                {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
              </button>

              <div className="w-px h-6 md:h-8 bg-zinc-800 mx-1 md:mx-2"></div>

              <button 
                onClick={toggleScreenShare}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all ${isScreenSharing ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
              >
                <MonitorUp className="w-5 h-5" />
              </button>

              <div className="w-px h-6 md:h-8 bg-zinc-800 mx-1 md:mx-2 hidden md:block"></div>
            </>
          )}

          {/* Mobile Tab Toggles */}
          {mode !== 'chat' && (
            <>
              <button 
                onClick={() => setActiveTab(activeTab === 'chat' ? 'video' : 'chat')}
                className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              
              <button 
                onClick={() => setActiveTab(activeTab === 'participants' ? 'video' : 'participants')}
                className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'participants' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
              >
                <Users className="w-4 h-4" />
              </button>

              <div className="w-px h-6 bg-zinc-800 mx-1 md:hidden"></div>
            </>
          )}

          <button 
            onClick={leaveRoom}
            className="w-14 h-10 md:w-16 md:h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/20"
          >
            <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Desktop Right Controls */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-3">
          <button 
            onClick={() => setActiveTab(activeTab === 'participants' ? 'video' : 'participants')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'participants' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            <Users className="w-4 h-4" />
            People
          </button>
          <button 
            onClick={() => setActiveTab(activeTab === 'chat' ? 'video' : 'chat')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button 
            onClick={() => setActiveTab(activeTab === 'whiteboard' ? 'video' : 'whiteboard')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'whiteboard' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            <SquarePen className="w-4 h-4" />
            Whiteboard
          </button>
        </div>
      </footer>
    </div>
  );
}
