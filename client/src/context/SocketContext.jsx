import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let SERVER_URL = import.meta.env.VITE_SERVER_URL;
    
    // If no server URL is provided, fallback to current origin (useful for same-domain deployments)
    if (!SERVER_URL) {
      SERVER_URL = window.location.origin;
    }

    // Special case for development: If testing on a mobile device via IP and SERVER_URL is localhost,
    // we need to use the current hostname to connect to the local dev server.
    if (SERVER_URL.includes('localhost') && window.location.hostname !== 'localhost') {
      SERVER_URL = `http://${window.location.hostname}:3000`;
    }

    const newSocket = io(SERVER_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'] // Ensure compatibility
    });
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
