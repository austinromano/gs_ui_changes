import { Hono } from 'hono';
import { db } from '../db/index.js';
import { communityMessages, users } from '../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

const communityRoutes = new Hono();
communityRoutes.use('*', authMiddleware);

const KNOWN_ROOMS = new Set(['girl-producers', 'fl-studio-gang', 'ableton-lab', 'hip-hop-cypher']);

// GET /communities/:roomId/messages — return the most recent 200 messages
// hydrated with the sender's display name + avatar. Reversed so the client
// can append directly (oldest first).
communityRoutes.get('/:roomId/messages', async (c) => {
  const roomId = c.req.param('roomId');
  if (!KNOWN_ROOMS.has(roomId)) return c.json({ success: true, data: [] });

  const rows = await db.select({
    id: communityMessages.id,
    userId: communityMessages.userId,
    text: communityMessages.text,
    createdAt: communityMessages.createdAt,
  })
    .from(communityMessages)
    .where(eq(communityMessages.roomId, roomId))
    .orderBy(desc(communityMessages.createdAt))
    .limit(200)
    .all();

  if (rows.length === 0) return c.json({ success: true, data: [] });

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const profiles = await db.select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users).where(inArray(users.id, userIds)).all();
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const data = rows.reverse().map((r) => {
    const p = profileMap.get(r.userId);
    return {
      id: r.id,
      roomId,
      userId: r.userId,
      displayName: p?.displayName || 'Unknown',
      avatarUrl: p?.avatarUrl || null,
      text: r.text,
      createdAt: r.createdAt,
    };
  });

  return c.json({ success: true, data });
});

export default communityRoutes;
