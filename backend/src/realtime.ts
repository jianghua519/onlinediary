import type { Server } from "socket.io";

let realtime: Server | null = null;

export const setRealtimeServer = (server: Server) => {
  realtime = server;
};

export const getRealtimeServer = () => realtime;
