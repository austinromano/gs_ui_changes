import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import { projects, tracks, files } from '../db/schema.js';
import { eq, inArray, and } from 'drizzle-orm';
import { isR2Configured, downloadFromR2 } from '../services/storage.js';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';

// Public, no-auth read-only endpoints for shared projects. Anyone holding
// a project's shareToken can fetch its arrangement + tracks + audio files
// via these. The token itself is the bearer of access; revoking the token
// (DELETE /projects/:id/share) immediately invalidates every link.
const publicShareRoutes = new Hono();

// GET /:token — project metadata + tracks (with inline peaks) + arrangement
// Returns a SHAPE compatible with the regular GET /projects/:id response so
// the viewer can reuse the existing audioStore + arrangement plumbing.
publicShareRoutes.get('/:token', async (c) => {
  const token = c.req.param('token');
  const [project] = await db.select().from(projects)
    .where(eq(projects.shareToken, token)).limit(1).all();
  if (!project) throw new HTTPException(404, { message: 'Share link not found or revoked' });

  const projectTracks = await db.select().from(tracks)
    .where(eq(tracks.projectId, project.id))
    .orderBy(tracks.position).all();

  const fileIds = Array.from(new Set(projectTracks.map((t) => t.fileId).filter((id): id is string => !!id)));
  const fileMeta = new Map<string, {
    peaks: any; detectedBpm: number | null; bpmConfidence: number | null;
    firstBeatOffset: number | null; beats: number[] | null;
    sampleCharacter: string | null; crestFactor: number | null;
  }>();
  if (fileIds.length > 0) {
    const rows = await db.select({
      id: files.id, peaks: files.peaks,
      detectedBpm: files.detectedBpm, bpmConfidence: files.bpmConfidence,
      firstBeatOffset: files.firstBeatOffset, beatsJson: files.beatsJson,
      sampleCharacter: files.sampleCharacter, crestFactor: files.crestFactor,
    }).from(files).where(inArray(files.id, fileIds)).all();
    for (const r of rows) {
      let peaks = null;
      if (r.peaks) { try { peaks = JSON.parse(r.peaks); } catch { /* skip */ } }
      let beats: number[] | null = null;
      if (r.beatsJson) { try { beats = JSON.parse(r.beatsJson); } catch { /* skip */ } }
      fileMeta.set(r.id, {
        peaks,
        detectedBpm: r.detectedBpm ?? null,
        bpmConfidence: r.bpmConfidence ?? null,
        firstBeatOffset: r.firstBeatOffset ?? null,
        beats,
        sampleCharacter: r.sampleCharacter ?? null,
        crestFactor: r.crestFactor ?? null,
      });
    }
  }
  const tracksWithPeaks = projectTracks.map((t) => {
    const meta = t.fileId ? fileMeta.get(t.fileId) : undefined;
    return {
      ...t,
      peaks: meta?.peaks ?? null,
      detectedBpm: meta?.detectedBpm ?? null,
      bpmConfidence: meta?.bpmConfidence ?? null,
      firstBeatOffset: meta?.firstBeatOffset ?? null,
      beats: meta?.beats ?? null,
      sampleCharacter: meta?.sampleCharacter ?? null,
      crestFactor: meta?.crestFactor ?? null,
    };
  });

  // Strip the shareToken from the public response — viewers don't need it
  // and we don't want it sitting in their browser history / network tab.
  const { shareToken: _t, ...publicProject } = project;
  return c.json({ success: true, data: { ...publicProject, members: [], tracks: tracksWithPeaks } });
});

// GET /:token/files/:fileId/download — stream an audio file IF it belongs
// to a project whose shareToken matches. Mirrors the auth'd download
// endpoint (`/projects/:id/files/:fileId/download`) but gated by token.
publicShareRoutes.get('/:token/files/:fileId/download', async (c) => {
  const token = c.req.param('token');
  const fileId = c.req.param('fileId');

  // Single join: only return the file if its project's shareToken matches.
  const [file] = await db.select({
    id: files.id, fileName: files.fileName, mimeType: files.mimeType, s3Key: files.s3Key,
  }).from(files)
    .innerJoin(projects, eq(projects.id, files.projectId))
    .where(and(eq(files.id, fileId), eq(projects.shareToken, token)))
    .limit(1).all();
  if (!file) throw new HTTPException(404, { message: 'File not found for this share link' });

  const isS3Path = file.s3Key.startsWith('projects/');
  if (isS3Path && isR2Configured()) {
    try {
      const { stream, contentLength, contentType } = await downloadFromR2(file.s3Key);
      return new Response(stream, {
        headers: {
          'Content-Type': contentType || file.mimeType || 'audio/wav',
          'Content-Disposition': `inline; filename="${file.fileName}"`,
          'Content-Length': contentLength.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      throw new HTTPException(404, { message: 'File not found in storage' });
    }
  }

  try {
    const fileStat = await stat(file.s3Key);
    const stream = createReadStream(file.s3Key);
    c.header('Content-Type', file.mimeType || 'audio/wav');
    c.header('Content-Disposition', `inline; filename="${file.fileName}"`);
    c.header('Content-Length', fileStat.size.toString());
    c.header('Accept-Ranges', 'bytes');
    c.header('Cache-Control', 'public, max-age=86400');
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: c.res.headers,
    });
  } catch {
    throw new HTTPException(404, { message: 'File not found on disk' });
  }
});

export default publicShareRoutes;
