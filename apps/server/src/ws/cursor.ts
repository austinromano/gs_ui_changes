import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@ghost/protocol';

type GhostSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerCursorHandlers(io: Server, socket: GhostSocket) {
  socket.on('cursor-move', ({ projectId, x, y }) => {
    const room = `project:${projectId}`;
    socket.to(room).emit('cursor-move', {
      userId: socket.data.userId,
      displayName: socket.data.displayName,
      colour: socket.data.colour,
      x,
      y,
    });
  });
}
