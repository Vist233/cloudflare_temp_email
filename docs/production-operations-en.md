# Production Operations and Recovery

The production target in this repository is the `cloudflare-temp-email` Worker and the `temp-email-db` D1 database. Non-secret production configuration lives in `worker/wrangler.toml`; do not inject a complete Wrangler file through a GitHub Secret.

## Authentication and secrets

- Production admin access uses the Zhang Auth OIDC `owner` role, with `ENABLE_ADMIN_PASSWORD_AUTH = false`.
- `JWT_SECRET`, `ZHANG_AUTH_CLIENT_SECRET`, and `TMPMAIL_OIDC_COOKIE_SECRET` are managed only with `wrangler secret put`; never put their values in `[vars]`, Git, reports, or chat.
- If legacy `x-admin-auth` is temporarily required, explicitly set `ENABLE_ADMIN_PASSWORD_AUTH = true` and store `ADMIN_PASSWORDS` as a separate Worker Secret. It is disabled in production by default.

## Deployment

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm run build:worker
cd ../worker
pnpm install --frozen-lockfile
pnpm run lint
pnpm run deploy -- --message "<source-commit>"
```

After deployment, run only the credential-free health check:

```sh
curl --fail --silent --show-error https://tmpmail.zhangyvjing.com/health_check
```

GitHub Actions uses the same tracked `worker/wrangler.toml`, frozen-lockfile installs, visible deployment output, and the same health check. Production uses `keep_vars = false`; verify new non-secret variables are committed before deploying. Worker Secrets are not deleted by deployments.

## JWT rotation

Back up D1 first, then generate and set a new `JWT_SECRET`. Rotation invalidates existing mailbox JWTs, user JWTs, and role access tokens, but does not delete D1 data or OIDC accounts. After deployment, sign in again through Zhang Auth and obtain mailbox credentials again; do not delete the OIDC client or cookie secrets as cleanup.

## D1 recovery

Export D1 before schema changes and keep the export outside the repository:

```sh
wrangler d1 export temp-email-db --remote --output /secure/path/temp-email-db.sql
wrangler d1 migrations apply temp-email-db --remote
```

Review SQL before restoring with `wrangler d1 execute temp-email-db --remote --file /secure/path/temp-email-db.sql`; never commit mail bodies or business data. A code rollback does not roll back D1 schema or restore the previous JWT.

## Logs and rollback

Runtime logs record event types, routes, and status codes only; they do not record passwords, tokens, mail bodies, or webhook headers. Record the Cloudflare Worker version ID when rolling back. If JWT was rotated, rolled-back code must continue using the current Secret and users must sign in again.
