import { Hono } from 'hono';
import { db } from '../db/index.js';
import { users, follows } from '../db/schema.js';
import { ne, eq, and } from 'drizzle-orm';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';

const userRoutes = new Hono();
userRoutes.use('*', authMiddleware);

// List all users (excluding current user) — for search/invite
userRoutes.get('/', async (c) => {
  const user = c.get('user') as AuthUser;
  const result = await db.select({
    id: users.id,
    displayName: users.displayName,
    email: users.email,
    avatarUrl: users.avatarUrl,
  }).from(users).where(ne(users.id, user.id)).all();
  return c.json({ success: true, data: result });
});

// List friends only (users you follow)
userRoutes.get('/friends', async (c) => {
  const user = c.get('user') as AuthUser;
  const result = await db.select({
    id: users.id,
    displayName: users.displayName,
    email: users.email,
    avatarUrl: users.avatarUrl,
  })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(eq(follows.followerId, user.id))
    .all();
  return c.json({ success: true, data: result });
});

// Add friend
userRoutes.post('/:id/friend', async (c) => {
  const user = c.get('user') as AuthUser;
  const friendId = c.req.param('id');
  if (friendId === user.id) return c.json({ error: 'Cannot friend yourself' }, 400);

  // Check if already friends
  const existing = await db.select().from(follows)
    .where(and(eq(follows.followerId, user.id), eq(follows.followingId, friendId)))
    .limit(1).all();

  if (existing.length > 0) {
    return c.json({ success: true, data: { message: 'Already friends' } });
  }

  await db.insert(follows).values({
    followerId: user.id,
    followingId: friendId,
    createdAt: new Date().toISOString(),
  }).run();

  return c.json({ success: true, data: { message: 'Friend added' } });
});

// Remove friend
userRoutes.delete('/:id/friend', async (c) => {
  const user = c.get('user') as AuthUser;
  const friendId = c.req.param('id');

  await db.delete(follows)
    .where(and(eq(follows.followerId, user.id), eq(follows.followingId, friendId)))
    .run();

  return c.json({ success: true, data: { message: 'Friend removed' } });
});

export default userRoutes;
