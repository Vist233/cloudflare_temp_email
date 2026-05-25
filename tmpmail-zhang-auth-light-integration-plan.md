# Tmpmail x ZhangYvJing 轻量接入改造方案

Updated: 2026-05-24

## 目标

对 `tmpmail.zhangyvjing.com` 做一次轻量收口，不推翻现有系统，不重做整套 temp mail，只完成三件事：

1. 保留核心收件能力，去掉极简模式和普通用户无关的噪音入口
2. 接入 `zhang-auth`，把登录入口统一到 `auth.zhangyvjing.com`
3. 增加用户地址配额规则：
   - `zhangyvjing@outlook.com`：无限个地址
   - 其他新注册用户：最多 2 个地址

这次方案刻意选择最轻量路径，不做“彻底重构 tmpmail 认证体系”。

## 现状判断

当前 `tmpmail` 不是一个单纯的收件页面，而是一套功能完整的系统：

- 有自己的用户注册/登录
- 有自己的 `user_api`
- 有自己的用户 JWT
- 有自己的 `users` / `user_roles` / `users_address`
- 有自己的地址绑定和地址数量限制逻辑
- 有普通模式和极简模式两套入口

这意味着：

- 去掉极简模式很容易
- 做“2 个 / 无限个”地址配额也很容易
- 真正复杂的是“如何接入 zhang-auth，同时不把现有 tmpmail 打碎”

## 总体策略

采用：

**统一身份源 + tmpmail 本地用户映射**

而不是：

**彻底删除 tmpmail 自己的用户层**

### 为什么这样做

`tmpmail` 现有很多功能都依赖本地用户表和本地角色：

- 地址绑定
- 地址数量限制
- 用户角色限制
- 后续管理后台查询

如果一次性把这些全改成直接依赖 `zhang-auth` 数据库，会让改造面明显放大，而且没有必要。

因此最小成本路径是：

- `zhang-auth` 负责“用户是谁”
- `tmpmail` 负责“这个用户在 tmpmail 里有什么地址、角色、限制”

## 改造后的认证架构

```text
用户
  -> auth.zhangyvjing.com 登录 / 注册
  -> 获取 zhang-auth access token
  -> tmpmail 前端带 token 进入 tmpmail
  -> tmpmail Worker 验证 zhang-auth JWT / JWKS
  -> tmpmail 按 auth user id / email 建立或查找本地用户
  -> tmpmail 继续沿用本地 users / user_roles / users_address
  -> tmpmail 再签发自己的轻量 user session token
```

## 为什么不直接复用 zhang-auth JWT 贯穿 tmpmail 全部内部逻辑

可以做，但不建议第一阶段这么做。

原因：

- `tmpmail` 现有 `/user_api/*` 和前端状态都已经默认依赖本地 `x-user-token`
- 地址绑定、角色、设置页、用户信息查询等逻辑都围绕本地 payload 设计
- 全部换成直接使用 `zhang-auth` token 会让中间件和前端状态一起重写

因此第一阶段建议：

- **外部登录入口统一**
- **内部 session 先兼容旧结构**

也就是：

- 用户通过 `zhang-auth` 完成登录
- `tmpmail` 验证外部 JWT
- `tmpmail` 建立本地用户映射
- `tmpmail` 继续发自己当前兼容的 `x-user-token`

这是“用户体验统一，工程改动最小”的方案。

## 需要保留的东西

这些保留，不重做：

- `tmpmail` 的 D1 数据结构
- `users`
- `user_roles`
- `users_address`
- 收件箱逻辑
- 邮件展示逻辑
- 地址绑定逻辑
- 地址数量限制逻辑
- 管理后台

## 需要替换或收口的东西

### 1. 认证入口

逐步取消普通用户直接走 `tmpmail` 自己的注册/登录作为主入口。

改成：

- 登录：跳转到 `auth.zhangyvjing.com/sign-in`
- 注册：跳转到 `auth.zhangyvjing.com/sign-up`

### 2. tmpmail 增加 auth bootstrap

新增一个轻量桥接流程，例如：

- `GET /auth/callback`
- `POST /open_api/auth/bootstrap`

功能：

1. 接收 `zhang-auth` access token
2. 验证 JWT
3. 从 payload 读取：
   - `sub`
   - `email`
   - `role`
4. 在 tmpmail 本地查找或创建对应用户
5. 生成 tmpmail 本地 `x-user-token`
6. 前端进入 `/user`

### 3. 前端页面收口

普通用户侧收成一个“收件工具”。

保留：

- 登录入口
- 当前地址
- 地址创建
- 地址列表
- 收件箱
- 邮件正文
- 删除邮件
- 基础账户设置

移除或隐藏：

- 极简模式
- 普通用户发件入口
- sendbox
- webhook
- auto reply
- 关于页面中无关内容
- appearance 中与当前产品主流程无关的切换项
- 其他不影响收件的扩展功能

## 地址配额设计

当前项目已经有：

- `isAddressCountLimitReached`
- `ROLE_ADDRESS_CONFIG_KEY`
- `user_roles`

所以不需要新造一套限制体系。

### 配额规则

- `owner`：
  `maxAddressCount = 0`
- `member`：
  `maxAddressCount = 2`

当前逻辑里：

- `maxAddressCount <= 0` 代表不限

因此无需改底层计数规则，只要统一角色分配即可。

### 角色映射规则

第一次通过 `zhang-auth` 进入 tmpmail 时：

- 如果 `email === zhangyvjing@outlook.com`
  -> 分配 `owner`
- 否则
  -> 分配 `member`

## 需要增加的数据映射

建议在 `tmpmail.users` 表层面增加一个外部身份映射字段：

- `auth_user_id`

最小目标：

- 能把 `zhang-auth.sub` 和 tmpmail 本地用户关联起来

如果现在不方便立即改表，也可以临时先用 `user_email` 做唯一映射，但长期更稳的是加 `auth_user_id`。

### 推荐顺序

第一阶段可先用：

- `user_email` 作为唯一映射

第二阶段再补：

- `auth_user_id`

这样可以最快把链路跑通。

## 最轻量实施顺序

### 阶段 1：产品表面收口

1. 去掉极简模式开关与入口
2. 调整普通用户页面结构
3. 隐藏普通用户不需要的高级功能
4. 保持收件能力不变

### 阶段 2：接入 zhang-auth

1. 新增 auth bootstrap / callback
2. 验证 `zhang-auth` JWT
3. 建立 tmpmail 本地用户映射
4. 继续签发 tmpmail 本地 session token
5. 前端改成优先走 `zhang-auth`

### 阶段 3：接入角色配额

1. 默认新用户映射为 `member`
2. Outlook 主账号映射为 `owner`
3. 配置 role 地址数量：
   - `member = 2`
   - `owner = unlimited`
4. 验证新建地址和绑定地址都受限

### 阶段 4：设计系统收口

1. 用 `zhang-auth` 的设计语言整理 `tmpmail`
2. 降低后台感和功能堆叠感
3. 强化“收件工具”而不是“功能平台”的体验

## 前端改造原则

这次不建议把 tmpmail 前端重写成一个新系统。

建议：

- 保留 Vue + Naive UI 现有技术栈
- 在现有页面结构上做减法和重排
- 引入更统一的设计 token / 视觉语言

### 设计目标

- 更安静
- 更聚焦
- 更少 tabs
- 更少无关设置
- 更明显的地址 / 收件 / 邮件正文主流程

## 风险控制

### 低风险项

- 去掉极简模式
- 普通用户页面减法
- 角色配额改成 2 / 无限

### 中风险项

- zhang-auth JWT 验签接入
- tmpmail 本地用户映射

### 暂不做的高风险项

- 完全删除 tmpmail 自己的用户表
- 完全删除 tmpmail 自己的 user token
- 把所有 user_api 全量改成直接信任外部 JWT

## 验收标准

完成后至少要通过这些路径：

1. 主账号登录 tmpmail
2. 主账号可无限创建地址
3. 新用户注册并登录
4. 新用户最多只能创建 2 个地址
5. 新用户第 3 次创建地址被正确拒绝
6. 收件功能正常
7. 查看邮件正文正常
8. 删除邮件正常
9. 旧有邮件数据不丢
10. 普通用户界面不再出现极简模式和多余高噪音功能

## 本次执行原则

这次改造按下面原则执行：

- 不重做整套系统
- 不更换主要技术栈
- 不把 tmpmail 全部逻辑迁到 zhang-auth
- 优先让“统一登录 + 地址限制 + UI 收口”先闭环

## 下一步实施内容

下一步将按这个方案进入实际改造：

1. 先做最小认证桥接方案
2. 再接角色和地址数量限制
3. 再做前端收口
4. 最后做回归测试
