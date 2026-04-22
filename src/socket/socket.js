import { io }      from "socket.io-client";
import { getToken, logout } from "../utils/auth.js";

// Singleton socket
let socket = null;

export const getSocket = () => {
  if (!socket) {
    const token = getToken();

    socket = io("http://localhost:5000", {
      transports:          ["websocket"],
      autoConnect:         true,
      reconnectionAttempts: 5,
      reconnectionDelay:   2000,
      // Send JWT token with every connection + reconnect
      auth: { token },
    });

    // If server rejects socket due to invalid/expired token
    socket.on("connect_error", (err) => {
      if (
        err.message.includes("No token") ||
        err.message.includes("Invalid") ||
        err.message.includes("expired")
      ) {
        console.warn("Socket auth failed:", err.message);
        logout(true); // auto logout + redirect /login
      }
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};