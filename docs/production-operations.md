# 生产部署与恢复说明

本仓库的生产目标是 `cloudflare-temp-email` Worker 与 `temp-email-db` D1。生产非秘密配置保存在 `worker/wrangler.toml`；不要再通过 GitHub Secret 注入完整的 Wrangler 文件。

## 认证与秘密

- 生产管理员入口使用 Zhang Auth OIDC 的 `owner` 角色，`ENABLE_ADMIN_PASSWORD_AUTH = false`。
- `JWT_SECRET`、`ZHANG_AUTH_CLIENT_SECRET` 和 `TMPMAIL_OIDC_COOKIE_SECRET` 只通过 `wrangler secret put` 管理，不写入 `[vars]`、Git、报告或聊天。
- 如需临时兼容旧版 `x-admin-auth`，必须显式设置 `ENABLE_ADMIN_PASSWORD_AUTH = true`，并把 `ADMIN_PASSWORDS` 作为单独的 Worker Secret 设置；生产默认不启用。

## 发布

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm run build:worker
cd ../worker
pnpm install --frozen-lockfile
pnpm run lint
pnpm run deploy -- --message "<source-commit>"
```

发布后只做不带凭据的健康检查：

```sh
curl --fail --silent --show-error https://tmpmail.zhangyvjing.com/health_check
```

GitHub Actions 使用同一份 `worker/wrangler.toml`，固定 lockfile 安装，保留部署输出并执行健康检查。生产配置使用 `keep_vars = false`，因此发布前确认新增的非秘密变量已经提交；Worker Secrets 不会被部署删除。

## JWT 轮换

轮换前先备份 D1，再生成新值并设置 `JWT_SECRET`。轮换会让已有地址 JWT、用户 JWT 和角色访问令牌失效，但不会删除 D1 数据或 OIDC 账号。部署完成后，使用 Zhang Auth OIDC 重新登录并重新获取邮箱凭证；不要删除 OIDC client secret 或 cookie secret 作为“清理”。

## D1 恢复

迁移前导出数据库，并把导出文件放在仓库外的受限目录：

```sh
wrangler d1 export temp-email-db --remote --output /secure/path/temp-email-db.sql
wrangler d1 migrations apply temp-email-db --remote
```

恢复前必须人工审查 SQL，再使用 `wrangler d1 execute temp-email-db --remote --file /secure/path/temp-email-db.sql`，避免把邮件正文或业务数据提交到 Git。部署代码回滚不会自动回滚 D1 schema，也不会恢复旧 JWT。

## 日志与回滚

运行日志只记录事件类型、路由、状态码等诊断字段，不记录密码、令牌、邮件正文或 webhook 请求头。回滚时记录 Cloudflare Worker version ID；如果 JWT 已轮换，回滚代码仍应继续使用当前 Secret，并要求用户重新登录。
