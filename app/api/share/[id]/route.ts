import { ensureUserId, jsonError } from '@/lib/server/session';
import { getShare, putShare } from '@/lib/server/store';
import { uid } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const share = await getShare(params.id);
  if (!share || share.revoked) return jsonError('This share link is invalid or has expired.', 404, { code: 'not_found' });
  return Response.json({ share });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const share = await getShare(params.id);
  if (!share) return jsonError('Share not found', 404, { code: 'not_found' });
  if (!share.allowComments) return jsonError('Comments are disabled on this share link.', 403, { code: 'comments_disabled' });
  const body = (await req.json().catch(() => ({}))) as { author?: string; text?: string; t?: number };
  const text = (body.text ?? '').trim();
  if (!text) return jsonError('Comment text is required', 400, { code: 'bad_request' });
  share.comments.push({ id: uid('c'), author: (body.author ?? 'Guest').slice(0, 60), text: text.slice(0, 1000), at: Date.now(), t: body.t });
  await putShare(share);
  return Response.json({ ok: true, comments: share.comments });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const userId = ensureUserId();
  const share = await getShare(params.id);
  if (!share) return Response.json({ ok: true });
  if (share.ownerId && share.ownerId !== userId) return jsonError('Only the owner can delete this share link.', 403, { code: 'forbidden' });
  share.revoked = true;
  await putShare(share);
  return Response.json({ ok: true });
}
