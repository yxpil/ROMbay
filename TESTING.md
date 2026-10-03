# ROMbay 测试说明

MySQL 代理审计工具。测试基于 Node.js 内置运行器 `node --test`，**不依赖真实 MySQL**（用裸实例绕过构造函数，纯测可移植逻辑）。

## 运行方式

```bash
npm install   # 首次：安装 mysql2 / lru-cache / chalk
npm test
```

> 仓库根目录原有的 `test_*.js`、`*_perf.js`、`debug_*.js` 都是需要真实 MySQL 实例的压测/调试脚本，不属于本可跑绿套件。

## 测了什么

测试目录：`tests/unit/`
- `history.test.js` —— 审计统计：读/写 SQL 分类、`extractTable`、`log()` 对 total/read/write/cacheHit/denied 的累计。
- `vmuser.test.js` —— **表级权限校验**（核心安全控制）、SQL 表提取、mysql_native_password 校验、握手/错误包构造。
- `romfromer.test.js` —— MySQL 包头解析：完整包切分、粘包半包边界。
- `upsql.test.js` —— 缓存 key 归一化、长度编码三档、结果集包构造。

### 注入 / 安全测试（重点）
- **越权访问拦截**：guest 用户 `SELECT FROM yxpil.secret` / `other.t` 一律拒绝；`INSERT/DELETE` 到只读用户被拒绝；通配 `yxpil.*` 正确匹配、跨库不匹配。
- **元语句放行边界**：`show/explain/select @@` 对普通用户放行，但未知用户名一律拒绝。
- **密码校验**：正确 native hash 通过，篡改一字节或错误密码拒绝。
- **包解析鲁棒性**：声明长度超过实际数据的半包返回 `null`，不越界读内存。

> 本仓库为后端代理，无浏览器前端交互，不涉及 jsdom 钩子测试。

## 预期结果

```
# tests 14
# pass 14
# fail 0
```
