import { Hono } from 'hono';
import { db } from '../db/index.js';
import { socialPosts, socialPostLikes, socialPostComments, socialPostReactions, follows, users, projects, tracks } from '../db/schema.js';
import { eq, desc, and, ne, inArray, sql, count } from 'drizzle-orm';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { isR2Configured, uploadToR2, downloadFromR2 } from '../services/storage.js';

const socialRoutes = new Hono();
socialRoutes.use('*', authMiddleware);

// Batch-enriches posts with likes, comments, reactions in 4 queries instead of 3N+1
async function enrichPosts(rawPosts: any[], uid: string) {
  if (rawPosts.length === 0) return [];
  const postIds = rawPosts.map(p => p.id);

  // Batch load all related data in parallel (4 queries total, not 3N)
  const [allLikes, allCommentCounts, allReactions, allProjects] = await Promise.all([
    db.select().from(socialPostLikes).where(inArray(socialPostLikes.postId, postIds)).all(),
    db.select({ postId: socialPostComments.postId, count: count() }).from(socialPostComments).where(inArray(socialPostComments.postId, postIds)).groupBy(socialPostComments.postId).all(),
    db.select().from(socialPostReactions).where(inArray(socialPostReactions.postId, postIds)).all(),
    (() => {
      const projectIds = [...new Set(rawPosts.map(p => p.projectId).filter(Boolean))];
      if (projectIds.length === 0) return Promise.resolve([]);
      return db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)).all();
    })(),
  ]);

  // Index by postId for O(1) lookups
  const likesByPost = new Map<string, typeof allLikes>();
  for (const l of allLikes) {
    if (!likesByPost.has(l.postId)) likesByPost.set(l.postId, []);
    likesByPost.get(l.postId)!.push(l);
  }
  const commentCountByPost = new Map(allCommentCounts.map(c => [c.postId, c.count]));
  const reactionsByPost = new Map<string, typeof allReactions>();
  for (const r of allReactions) {
    if (!reactionsByPost.has(r.postId)) reactionsByPost.set(r.postId, []);
    reactionsByPost.get(r.postId)!.push(r);
  }
  const projectNameMap = new Map(allProjects.map(p => [p.id, p.name]));

  return rawPosts.map(p => {
    const likes = likesByPost.get(p.id) || [];
    const reactions = reactionsByPost.get(p.id) || [];
    const rc: Record<string, number> = {};
    const ur: string[] = [];
    for (const r of reactions) { rc[r.emoji] = (rc[r.emoji] || 0) + 1; if (r.userId === uid) ur.push(r.emoji); }
    return {
      ...p,
      likeCount: likes.length,
      commentCount: commentCountByPost.get(p.id) || 0,
      liked: likes.some(l => l.userId === uid),
      reactionCounts: rc,
      userReactions: ur,
      projectName: p.projectId ? (projectNameMap.get(p.projectId) || null) : null,
    };
  });
}

socialRoutes.get('/feed', async (c) => {
  const user = c.get('user') as AuthUser;
  const results = await db.select({ id: socialPosts.id, text: socialPosts.text, audioFileId: socialPosts.audioFileId, projectId: socialPosts.projectId, userId: socialPosts.userId, displayName: users.displayName, avatarUrl: users.avatarUrl, createdAt: socialPosts.createdAt })
    .from(socialPosts).innerJoin(users, eq(socialPosts.userId, users.id)).orderBy(desc(socialPosts.createdAt)).limit(50).all();
  return c.json({ success: true, data: await enrichPosts(results, user.id) });
});

socialRoutes.post('/posts', async (c) => {
  const user = c.get('user') as AuthUser;
  const { text, projectId, audioFileId } = await c.req.json();
  if (!text?.trim()) return c.json({ success: false, error: 'Text required' }, 400);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.insert(socialPosts).values({ id, userId: user.id, text: text.trim(), projectId: projectId || null, audioFileId: audioFileId || null, createdAt }).run();
  let projectName = null;
  if (projectId) { const [proj] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1).all(); projectName = proj?.name || null; }
  return c.json({ success: true, data: { id, text: text.trim(), projectId, audioFileId: audioFileId || null, userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt, likeCount: 0, commentCount: 0, liked: false, reactionCounts: {}, userReactions: [], projectName } });
});

socialRoutes.post('/posts/:postId/like', async (c) => {
  const user = c.get('user') as AuthUser;
  const postId = c.req.param('postId');
  const existing = await db.select().from(socialPostLikes).where(and(eq(socialPostLikes.postId, postId), eq(socialPostLikes.userId, user.id))).limit(1).all();
  if (existing.length > 0) { await db.delete(socialPostLikes).where(eq(socialPostLikes.id, existing[0].id)).run(); return c.json({ success: true, data: { liked: false } }); }
  await db.insert(socialPostLikes).values({ id: crypto.randomUUID(), postId, userId: user.id, createdAt: new Date().toISOString() }).run();
  return c.json({ success: true, data: { liked: true } });
});

socialRoutes.get('/posts/:postId/comments', async (c) => {
  const postId = c.req.param('postId');
  const results = await db.select({ id: socialPostComments.id, text: socialPostComments.text, userId: socialPostComments.userId, displayName: users.displayName, avatarUrl: users.avatarUrl, createdAt: socialPostComments.createdAt })
    .from(socialPostComments).innerJoin(users, eq(socialPostComments.userId, users.id)).where(eq(socialPostComments.postId, postId)).orderBy(socialPostComments.createdAt).all();
  return c.json({ success: true, data: results });
});

socialRoutes.post('/posts/:postId/comments', async (c) => {
  const user = c.get('user') as AuthUser;
  const postId = c.req.param('postId');
  const { text } = await c.req.json();
  if (!text?.trim()) return c.json({ success: false, error: 'Text required' }, 400);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.insert(socialPostComments).values({ id, postId, userId: user.id, text: text.trim(), createdAt }).run();
  return c.json({ success: true, data: { id, text: text.trim(), userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt } });
});

socialRoutes.post('/posts/:postId/reactions', async (c) => {
  const user = c.get('user') as AuthUser;
  const postId = c.req.param('postId');
  const { emoji } = await c.req.json();
  if (!['🔥', '🎧', '🎤', '💯', '❤️'].includes(emoji)) return c.json({ success: false, error: 'Invalid emoji' }, 400);
  const existing = await db.select().from(socialPostReactions).where(and(eq(socialPostReactions.postId, postId), eq(socialPostReactions.userId, user.id), eq(socialPostReactions.emoji, emoji))).limit(1).all();
  if (existing.length > 0) { await db.delete(socialPostReactions).where(eq(socialPostReactions.id, existing[0].id)).run(); return c.json({ success: true, data: { reacted: false, emoji } }); }
  await db.insert(socialPostReactions).values({ id: crypto.randomUUID(), postId, userId: user.id, emoji, createdAt: new Date().toISOString() }).run();
  return c.json({ success: true, data: { reacted: true, emoji } });
});

socialRoutes.post('/follow/:userId', async (c) => {
  const user = c.get('user') as AuthUser;
  const targetId = c.req.param('userId');
  if (targetId === user.id) return c.json({ success: false, error: 'Cannot follow yourself' }, 400);
  const existing = await db.select().from(follows).where(and(eq(follows.followerId, user.id), eq(follows.followingId, targetId))).limit(1).all();
  if (existing.length > 0) { await db.delete(follows).where(and(eq(follows.followerId, user.id), eq(follows.followingId, targetId))).run(); return c.json({ success: true, data: { following: false } }); }
  await db.insert(follows).values({ followerId: user.id, followingId: targetId, createdAt: new Date().toISOString() }).run();
  return c.json({ success: true, data: { following: true } });
});

// Upload audio for social post
socialRoutes.post('/upload', async (c) => {
  const user = c.get('user') as AuthUser;
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ success: false, error: 'No file' }, 400);

  const fileId = crypto.randomUUID();
  const buf = Buffer.from(await file.arrayBuffer());

  if (isR2Configured()) {
    const key = `social/${fileId}_${file.name}`;
    await uploadToR2(key, buf, file.type || 'audio/wav');
    return c.json({ success: true, data: { fileId, fileName: file.name, filePath: key } });
  } else {
    const { mkdir } = await import('node:fs/promises');
    const { resolve, join } = await import('node:path');
    const SOCIAL_UPLOADS = resolve(import.meta.dirname, '../../uploads/social');
    await mkdir(SOCIAL_UPLOADS, { recursive: true });
    const filePath = join(SOCIAL_UPLOADS, `${fileId}_${file.name}`);
    const fsp = await import('node:fs/promises');
    await fsp.writeFile(filePath, buf);
    return c.json({ success: true, data: { fileId, fileName: file.name, filePath } });
  }
});

// Stream social audio
socialRoutes.get('/audio/:fileId', async (c) => {
  const fileId = c.req.param('fileId');

  if (isR2Configured()) {
    // Try to find the file in R2 by listing with prefix
    // Since we store as social/{fileId}_{name}, we search by prefix
    try {
      // We need to find the full key. Try a common pattern:
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT,
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY || '', secretAccessKey: process.env.S3_SECRET_KEY || '' },
      });
      const list = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET || 'ghost-session-files', Prefix: `social/${fileId}`, MaxKeys: 1 }));
      const key = list.Contents?.[0]?.Key;
      if (!key) return c.json({ success: false, error: 'Not found' }, 404);

      const { stream, contentLength } = await downloadFromR2(key);
      return new Response(stream, {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
          'Content-Length': contentLength.toString(),
        },
      });
    } catch {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
  }

  // Local fallback
  const { resolve, join } = await import('node:path');
  const SOCIAL_UPLOADS = resolve(import.meta.dirname, '../../uploads/social');
  const fsp = await import('node:fs/promises');
  const fs = await import('node:fs');
  const allFiles = await fsp.readdir(SOCIAL_UPLOADS).catch(() => []);
  const match = (allFiles as string[]).find((f: string) => f.startsWith(fileId));
  if (!match) return c.json({ success: false, error: 'Not found' }, 404);

  const filePath = join(SOCIAL_UPLOADS, match);
  const fileStat = await fsp.stat(filePath);
  const stream = fs.createReadStream(filePath);
  const { Readable } = await import('node:stream');

  c.header('Content-Type', 'audio/wav');
  c.header('Content-Disposition', `inline; filename="${match}"`);
  c.header('Content-Length', fileStat.size.toString());
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers: c.res.headers });
});

socialRoutes.get('/explore', async (c) => {
  const user = c.get('user') as AuthUser;

  // 4 queries total instead of 2N
  const [allUsers, myFollows, followerCounts, postCounts] = await Promise.all([
    db.select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, createdAt: users.createdAt }).from(users).where(ne(users.id, user.id)).all(),
    db.select({ followingId: follows.followingId }).from(follows).where(eq(follows.followerId, user.id)).all(),
    db.select({ userId: follows.followingId, count: count() }).from(follows).groupBy(follows.followingId).all(),
    db.select({ userId: socialPosts.userId, count: count() }).from(socialPosts).groupBy(socialPosts.userId).all(),
  ]);

  const myFollowSet = new Set(myFollows.map(f => f.followingId));
  const followerMap = new Map(followerCounts.map(f => [f.userId, f.count]));
  const postMap = new Map(postCounts.map(p => [p.userId, p.count]));

  const data = allUsers.map(u => ({
    ...u,
    followerCount: followerMap.get(u.id) || 0,
    postCount: postMap.get(u.id) || 0,
    isFollowing: myFollowSet.has(u.id),
  }));
  return c.json({ success: true, data });
});

socialRoutes.get('/profile/:userId', async (c) => {
  const cur = c.get('user') as AuthUser;
  const tid = c.req.param('userId');
  const [tu] = await db.select().from(users).where(eq(users.id, tid)).limit(1).all();
  if (!tu) return c.json({ success: false, error: 'User not found' }, 404);
  const userPosts = await db.select({ id: socialPosts.id, text: socialPosts.text, projectId: socialPosts.projectId, userId: socialPosts.userId, displayName: users.displayName, avatarUrl: users.avatarUrl, createdAt: socialPosts.createdAt })
    .from(socialPosts).innerJoin(users, eq(socialPosts.userId, users.id)).where(eq(socialPosts.userId, tid)).orderBy(desc(socialPosts.createdAt)).limit(20).all();
  const [followerResult, followingResult, isFollowingResult] = await Promise.all([
    db.select({ count: count() }).from(follows).where(eq(follows.followingId, tid)).all(),
    db.select({ count: count() }).from(follows).where(eq(follows.followerId, tid)).all(),
    db.select().from(follows).where(and(eq(follows.followerId, cur.id), eq(follows.followingId, tid))).limit(1).all(),
  ]);
  const followerCount = followerResult[0]?.count || 0;
  const followingCount = followingResult[0]?.count || 0;
  const isFollowing = isFollowingResult.length > 0;
  return c.json({ success: true, data: {
    id: tu.id, displayName: tu.displayName, avatarUrl: tu.avatarUrl, createdAt: tu.createdAt,
    followerCount, followingCount, postCount: userPosts.length, isFollowing,
    posts: await enrichPosts(userPosts, cur.id),
  } });
});

socialRoutes.get('/activity', async (c) => {
  const recentTracks = await db.select({ trackName: tracks.name, trackType: tracks.type, userId: tracks.ownerId, displayName: users.displayName, avatarUrl: users.avatarUrl, projectId: tracks.projectId, createdAt: tracks.createdAt })
    .from(tracks).innerJoin(users, eq(tracks.ownerId, users.id)).orderBy(desc(tracks.createdAt)).limit(20).all();

  // Batch load project names (1 query instead of N)
  const projectIds = [...new Set(recentTracks.map(t => t.projectId).filter(Boolean))];
  const projectNames = projectIds.length > 0
    ? new Map((await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)).all()).map(p => [p.id, p.name]))
    : new Map();

  const activities = recentTracks.map(t => ({
    type: 'upload',
    message: `uploaded "${t.trackName}" to ${projectNames.get(t.projectId) || 'a project'}`,
    userId: t.userId, displayName: t.displayName, avatarUrl: t.avatarUrl, createdAt: t.createdAt,
  }));
  return c.json({ success: true, data: activities });
});

// View a shared project (read-only)
socialRoutes.get('/project/:projectId', async (c) => {
  const pid = c.req.param('projectId');
  const [proj] = await db.select().from(projects).where(eq(projects.id, pid)).limit(1).all();
  if (!proj) return c.json({ success: false, error: 'Project not found' }, 404);
  const trackList = await db.select().from(tracks).where(eq(tracks.projectId, pid)).all();
  const [owner] = await db.select({ displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, proj.ownerId)).limit(1).all();
  return c.json({ success: true, data: { ...proj, tracks: trackList, ownerName: owner?.displayName, ownerAvatar: owner?.avatarUrl } });
});

export default socialRoutes;
