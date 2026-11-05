# 基础原型构建与测试记录

初始记录：2026-11-02 · 最近复验：2026-11-04 · 状态：验证进行中。本文只记录 Session Harbor 基础代码检查，不代表 Claude Desktop 换号续聊通过。

## 2026-11-04 Windows 原生 EXE 复验

使用项目内 `.tools/` 中已有的 Rust 1.99.1、MSVC Build Tools 和 Windows SDK，执行 `pnpm.cmd tauri build --no-bundle` 成功。产物为 `src-tauri/target/release/session-harbor.exe`，大小 10,395,136 字节；`--no-bundle` 不生成安装包。启动探针将 WebView2 用户数据指向临时目录，观察到进程持续运行、窗口标题为 Session Harbor、窗口句柄非零、窗口响应正常且 WebView2 数据目录已创建。这证明 EXE 可启动为 Windows GUI，但不等于业务操作通过，也不代表 SQLite 已隔离。

首次 `pnpm.cmd test:native` **未通过**：测试未能连接 WebView2 的本机 CDP 调试端口，因此未执行账号增删改或 SQLite 持久化断言。进一步发现，测试脚本对子进程设置 `APPDATA` 并不能改变 Tauri 在 Windows 上通过 RoamingAppData Known Folder 解析的 `app_data_dir`；原脚本的“临时数据库隔离”假设不成立。现已在脚本启动 EXE 之前加入失败关闭保护，复验确认 `test:native` 会在启动前明确拒绝运行，直到实现并通过 IPC 核验专用的测试数据目录。不要把此项记为原生冒烟测试通过，也不要在未修复隔离前移除保护。本轮没有对真实应用数据执行账号档案写入或清理；EXE 启动本身可能在默认应用数据目录初始化空库。

Desktop Code 的真实身份、账号切换、订阅用量与原会话接续 M0 测试仍为 `NOT RUN`。

## 2026-11-04 增量复验

本次加入本地时区一致性检查：读取浏览器或应用 WebView 报告的时区、UTC 偏移和本地时间，并与用户输入的期望 IANA 时区比较。期望值仅在当前页面内存中保留。检查不联网，不读取 Claude 凭据；不能预测或防止账号受限。

| 检查 | 本次结果 | 证据与边界 |
| --- | --- | --- |
| `pnpm.cmd test` | PASS，2 个文件共 7 项 | 包含有效/无效期望时区、一致/不一致/未知与 UTC 偏移格式；其余为原有基础原型测试 |
| `pnpm.cmd build` | PASS | TypeScript 检查和 Vite 前端生产构建通过；不包含 Rust/Tauri 原生编译 |
| `pnpm.cmd test:ui` | PASS，Chromium 5 项 | 新增时区显示、输入验证、页面刷新清空；模拟 `isTauri` 并使 `inspect_environment` IPC 拒绝，确认原生错误仍显示且独立的时区观测仍可见。IPC 失败是浏览器模拟，不是实际原生测试 |
| 390 像素窄屏截图 | 已检查 | 时区名称与偏移分行完整显示；本次未发现横向溢出 |
| Rust 核心测试、Tauri 原生构建与启动、`pnpm test:native` | NOT RUN（本次前端复验时） | 当时 `cargo` 不在 PATH；随后使用项目内工具链完成 EXE 构建，见上方“Windows 原生 EXE 复验”。原生冒烟测试仍未通过 |
| M0 Desktop 身份、账号切换、原会话接续与恢复 | NOT RUN | 未执行 Claude Desktop 人工实验，不得宣告核心产品目标完成 |

本次 Node 命令因沙箱内无法遍历已安装的 pnpm junction，经批准在沙箱外执行。未修改或运行 Claude Desktop 登录与会话。

## 验证范围

使用无秘密的测试档案。浏览器预览只保存页面内存数据；原生应用通过 Rust/SQLite 持久化。这两种路径分别记录结果，不能互相替代。

| 检查 | 2026-11-02 原始结果 | 证据与边界 |
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

2026-11-02 记录环境：Node.js 20.19.0、pnpm 10.14.0、Vite 7.3.7、Vitest 3.2.7。Rust 工具链固定为 1.99.1；完整依赖版本以仓库锁文件为准。当时 MSVC 组件尚未就绪；之后已使用项目内工具链完成 EXE 构建，结果见上方 2026-11-04 Windows 原生 EXE 复验。

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

基础原型没有实现账号认证、真实切换、订阅用量读取或原会话接续。安装检测只说明标准位置存在安装候选；时区检查只比较本地报告值与用户期望值，IP 位置、系统时间同步和账号政策状态未核验。原型预检必定阻塞，取消也只改变本地记录。

M0 的版本、步骤和证据单独记录于 [Desktop Code 人工验证计划](desktop-code-handoff.md)；不得用本表的任何 PASS 关闭 M0。
