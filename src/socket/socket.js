import { io } from "socket.io-client";
import { getToken, logout } from "../utils/auth.js";

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const token = getToken();

    socket = io(import.meta.env.VITE_WS_URL, {
      transports: ["websocket"],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: { token },
    });

    socket.on("connect_error", (err) => {
      if (
        err.message.includes("No token") ||
        err.message.includes("Invalid") ||
        err.message.includes("expired")
      ) {
        console.warn("Socket auth failed:", err.message);
        logout(true);
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