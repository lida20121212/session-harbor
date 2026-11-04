# 基础原型构建与测试记录

日期：2026-11-02 · 状态：验证进行中。本文只记录 Session Harbor 基础代码检查，不代表 Claude Desktop 换号续聊通过。

## 验证范围

使用无秘密的测试档案。浏览器预览只保存页面内存数据；原生应用通过 Rust/SQLite 持久化。这两种路径分别记录结果，不能互相替代。

| 检查 | 当前结果 | 证据与边界 |
| --- | --- | --- |
| `pnpm test` | PASS，5 项 | 未知用量、重复和无效更新、阻塞及取消、删除后保留快照、预览隔离、原生错误传播 |
| `pnpm build` | PASS | TypeScript 检查和 Vite 前端生产构建通过，不包含原生编译 |
| `pnpm test:ui` | PASS，3 项 | 账号增删改与历史、重复名称和键盘取消、预览刷新清空、窄屏与环境未知状态；首轮发现的焦点恢复问题已修复并复验 |
| 界面截图检查 | PASS | 检查 1280×820 桌面视口与 390 像素窄屏布局，无横向溢出 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | PASS | Rust 格式检查通过，不代表编译通过 |
| Rust 核心测试 | BLOCKED，测试体 NOT RUN | 初次编译缺少 MSVC `link.exe`；正在补齐工具链，需再次运行 |
| Windows 原生构建与启动 | NOT RUN | 待原生工具链准备完成后验证 |
| `pnpm test:native` | NOT RUN | 已添加隔离数据目录内的 IPC、SQLite 重启持久化与预检冒烟测试，待原生可执行程序构建后运行 |
| Windows 远程 CI | NOT RUN | 已新增 workflow，尚无远程执行结果 |
| M0 Desktop 身份与原会话接续 | NOT RUN | 未登录、未切换账号，未操作官方会话 |

记录环境：Node.js 20.19.0、pnpm 10.14.0、Vite 7.3.7、Vitest 3.2.7。Rust 工具链固定为 1.99.1；完整依赖版本以仓库锁文件为准。MSVC 组件仍在安装，最终原生编译结果待后续检查填写。

## 复验命令

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:ui
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features
pnpm tauri build --no-bundle
pnpm test:native
```

Windows 原生命令需要 Rust MSVC 工具链、C++ Build Tools、Windows SDK 和 WebView2。PowerShell 可使用 `pnpm.cmd`。`.tools/`、`test-results/`、依赖目录、构建输出及本地数据库不提交。

`pnpm test:native` 默认启动 `src-tauri/target/release/session-harbor.exe`，使用新建的临时应用数据目录，并在重启后检查档案和预检仍存在。它仅为测试子进程开启本机 WebView2 CDP 连接；普通应用启动不打开调试端口。脚本存在不代表原生测试已经通过。

## 未完成的产品验证

基础原型没有实现账号认证、真实切换、订阅用量读取或原会话接续。环境检测只说明标准位置存在安装候选。原型预检必定阻塞，取消也只改变本地记录。

M0 的版本、步骤和证据单独记录于 [Desktop Code 人工验证计划](desktop-code-handoff.md)；不得用本表的任何 PASS 关闭 M0。
