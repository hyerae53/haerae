import {
  db,
  error,
  json,
  requireAdminEmailAllowlist,
  requireAuth,
  router,
} from '@appdeploy/sdk';

const ADMIN_EMAILS = ['johaerae@gmail.com'];
const TABLE = 'portfolio';
const MAX_HTML_BYTES = 220_000;
interface PortfolioRecord {
  html: string;
  updatedAt: string;
  updatedBy: string;
}
async function getPortfolioRecord() {
  const { items } = await db.list<PortfolioRecord>(TABLE, { limit: 1 });
  return items[0] ?? null;
}
export const handler = router({
  'GET /api/portfolio': [
    async () => {
      const record = await getPortfolioRecord();
      return json(
        record
          ? { html: record.html, updatedAt: record.updatedAt }
          : { html: null, updatedAt: null }
      );
    },
  ],
  'PUT /api/portfolio': [
    requireAuth(),
    requireAdminEmailAllowlist(ADMIN_EMAILS),
    async ctx => {
      const body = ctx.body as { html?: unknown };
      if (typeof body.html !== 'string' || !body.html.includes('<html'))
        return error('Invalid portfolio HTML.', 400);
      if (new TextEncoder().encode(body.html).byteLength > MAX_HTML_BYTES)
        return error('Portfolio HTML is too large.', 413);
      const record: PortfolioRecord = {
        html: body.html,
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.user?.email ?? ctx.user?.userId ?? 'unknown',
      };
      const existing = await getPortfolioRecord();
      if (existing) {
        const [updated] = await db.update(TABLE, [{ id: existing.id, record }]);
        if (!updated) return error('Failed to publish portfolio.', 500);
      } else {
        const [id] = await db.add(TABLE, [record]);
        if (!id) return error('Failed to publish portfolio.', 500);
      }
      return json({ ok: true, updatedAt: record.updatedAt });
    },
  ],
});
