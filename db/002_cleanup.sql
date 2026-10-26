-- ═══════════════════════════════════════════════════════════════════════════
--  PRISM — maintenance
--  Run periodically (pg_cron, Vercel Cron or a scheduled job).
-- ═══════════════════════════════════════════════════════════════════════════

-- Trim each user's run history to the newest 60 entries and usage to 2,000
-- (the app also does this in code; this keeps rows small in long-lived installs).
update prism_users u
set data = jsonb_set(
      jsonb_set(u.data, '{runs}',
        coalesce((select jsonb_agg(r order by (r->>'at')::bigint desc)
                  from (select r from jsonb_array_elements(coalesce(u.data->'runs','[]'::jsonb)) r
                        order by (r->>'at')::bigint desc limit 60) s), '[]'::jsonb), true),
      '{usage}',
        coalesce((select jsonb_agg(x order by (x->>'at')::bigint desc)
                  from (select x from jsonb_array_elements(coalesce(u.data->'usage','[]'::jsonb)) x
                        order by (x->>'at')::bigint desc limit 2000) s), '[]'::jsonb), true)
where u.data ? 'runs';

-- Drop audit rows older than 90 days.
delete from prism_audit where at < now() - interval '90 days';

-- Share snapshots are immutable; remove revoked links older than a year.
delete from prism_shares where revoked = true and updated_at < now() - interval '365 days';
