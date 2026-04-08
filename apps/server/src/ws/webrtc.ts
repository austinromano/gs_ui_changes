import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@ghost/protocol';

type GhostSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Track all sockets per userId to support multiple tabs
const userSockets = new Map<string, Set<GhostSocket>>();

function addSocket(userId: string, socket: GhostSocket) {
  let sockets = userSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    userSockets.set(userId, sockets);
  }
  sockets.add(socket);
}

function removeSocket(userId: string, socket: GhostSocket) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socket);
    if (sockets.size === 0) userSockets.delete(userId);
  }
}

function emitToUser(userId: string, event: string, data: any) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const s of sockets) {
      (s.emit as any)(event, data);
    }
  }
}

export function registerWebRTCHandlers(io: Server, socket: GhostSocket) {
  addSocket(socket.data.userId, socket);

  socket.on('webrtc-offer', ({ projectId, targetUserId, offer, streamType }) => {
    emitToUser(targetUserId, 'webrtc-offer', {
      fromUserId: socket.data.userId,
      offer,
      streamType,
    });
  });

  socket.on('webrtc-answer', ({ projectId, targetUserId, answer, streamType }) => {
    emitToUser(targetUserId, 'webrtc-answer', {
      fromUserId: socket.data.userId,
      answer,
      streamType,
    });
  });

  socket.on('webrtc-ice-candidate', ({ projectId, targetUserId, candidate, streamType }) => {
    emitToUser(targetUserId, 'webrtc-ice-candidate', {
      fromUserId: socket.data.userId,
      candidate,
      streamType,
    });
  });

  socket.on('webrtc-leave', ({ projectId, streamType }) => {
    const room = `project:${projectId}`;
    socket.to(room).emit('webrtc-user-left', {
      userId: socket.data.userId,
      streamType,
    });
  });

  socket.on('disconnect', () => {
    removeSocket(socket.data.userId, socket);
  });
}
