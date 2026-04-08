import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@ghost/protocol';
import { db } from '../db/index.js';
import { chatMessages, projectMembers, projects, notifications } from '../db/schema.js';
import { eq, and, ne } from 'drizzle-orm';

type GhostSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerChatHandlers(io: Server, socket: GhostSocket) {
  socket.on('chat-message', ({ projectId, text }) => {
    const room = `project:${projectId}`;
    const timestamp = Date.now();

    const messageId = crypto.randomUUID();
    const msg = {
      id: messageId,
      userId: socket.data.userId,
      displayName: socket.data.displayName,
      colour: socket.data.colour,
      text,
      timestamp,
    };

    // Persist to database first, then broadcast
    (async () => {
      try {
        await db.insert(chatMessages).values({
          id: messageId,
          projectId,
          userId: socket.data.userId,
          displayName: socket.data.displayName,
          colour: socket.data.colour,
          text,
          createdAt: new Date(timestamp).toISOString(),
        }).run();

        // Broadcast after successful persistence
        io.to(room).emit('chat-message', msg);

        const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1).all();
        const projectName = project?.name || 'a project';

        const members = await db.select({ userId: projectMembers.userId })
          .from(projectMembers)
          .where(and(eq(projectMembers.projectId, projectId), ne(projectMembers.userId, socket.data.userId)))
          .all();

        const now = new Date().toISOString();
        for (const member of members) {
          await db.insert(notifications).values({
            id: crypto.randomUUID(),
            userId: member.userId,
            type: 'chat',
            message: `${socket.data.displayName} in ${projectName}: ${text.length > 50 ? text.slice(0, 50) + '...' : text}`,
            createdAt: now,
          }).run();
        }
      } catch (err) {
        console.error('Failed to persist chat message:', err);
      }
    })();
  });

  socket.on('delete-chat-message', ({ projectId, timestamp, messageId }: any) => {
    const room = `project:${projectId}`;

    (async () => {
      try {
        if (messageId) {
          // Preferred: delete by message ID (exact match)
          await db.delete(chatMessages)
            .where(and(eq(chatMessages.id, messageId), eq(chatMessages.userId, socket.data.userId)))
            .run();
        } else {
          // Fallback: delete by timestamp (backwards compatibility)
          const ts = new Date(timestamp).toISOString();
          await db.delete(chatMessages)
            .where(and(eq(chatMessages.projectId, projectId), eq(chatMessages.userId, socket.data.userId), eq(chatMessages.createdAt, ts)))
            .run();
        }

        // Broadcast deletion after successful DB delete
        io.to(room).emit('delete-chat-message', { timestamp, messageId });
      } catch (err) {
        console.error('Failed to delete chat message:', err);
      }
    })();
  });
}
