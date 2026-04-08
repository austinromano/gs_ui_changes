import { db } from '../db/index.js';
import { projectMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

/**
 * Asserts the user is a member of the project. Returns the membership record.
 * Throws 403 if not a member.
 */
export async function assertMember(projectId: string, userId: string) {
  const [membership] = await db.select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1)
    .all();

  if (!membership) throw new HTTPException(403, { message: 'Not a member of this project' });
  return membership;
}

/**
 * Asserts the user has editor or owner role. Returns the membership record.
 * Throws 403 if viewer or not a member.
 */
export async function assertEditor(projectId: string, userId: string) {
  const membership = await assertMember(projectId, userId);
  if (membership.role === 'viewer') {
    throw new HTTPException(403, { message: 'Editor role required' });
  }
  return membership;
}

/**
 * Checks membership without throwing. Returns the role or null.
 */
export async function getMemberRole(projectId: string, userId: string): Promise<string | null> {
  const [membership] = await db.select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1)
    .all();
  return membership?.role || null;
}
