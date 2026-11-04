# Session Harbor

项目仓库：[lida20121212/session-harbor](https://github.com/lida20121212/session-harbor)

面向 **Claude Desktop 的 Code 编程标签页**的个人多账号工作台：帮助使用自己的多个 Claude Pro 账号的人查看账号状态、了解用量，并在主动切换账号后继续原有编程对话。

**当前状态：基础原型开发中，已有 React 工作台与 Rust/Tauri 本地存储代码，尚未发布安装包。** 账号登录、实际切换、订阅用量获取和原会话接续尚未实现。最重要的可行性问题仍待验证：Desktop 内实际切换为账号 B 后，能否在同一项目与 worktree 中继续账号 A 的原会话。CLI 登录或恢复成功不能证明这一目标成立。

Session Harbor 是独立开源项目，与 Anthropic 无官方隶属或背书关系。项目名称为工作名称，公开发布前仍需确认名称可用性。

## 计划范围

| 能力 | 目标 | 当前状态 |
| --- | --- | --- |
| 账号管理 | 为用户自己的 Claude Pro 账号维护本地别名和可核验状态 | 已实现档案增删改；身份仍为未核验，原生验证见构建记录 |
| 手动切换 | 使用经验证的官方登录路径，核验 Desktop 实际身份 | 未实现；可行性待验证 |
| 用量监测 | 展示有来源、有时间戳的订阅用量；不可获取时显示 unknown | 已显示 unknown；真实数据源待验证 |
| 会话接续 | 在 Desktop Code 中保留原项目、worktree 和对话上下文 | 未实现；M0 核心验证项 |
| 接续预检 | 记录尚未满足的接续条件并允许取消 | 已实现 blocked/cancelled 记录；不会执行登录或切换 |
| 环境检测 | 只读检查 Desktop 和 CLI 的常见安装位置 | 已实现候选检测；不能证明已登录或可接续 |
| 本地保护 | 最少化存储、敏感信息脱敏、切换失败恢复 | SQLite 只存非敏感档案和预检记录；真实切换恢复未实现 |

先支持 Windows，再考虑 macOS。首版不覆盖 Desktop Chat、其他模型服务、API 供应商路由或通用 CLI 账号管理。官方 Claude Code CLI 只能作为辅助适配，不是 Desktop 身份的权威来源。

不承诺“防封”，不自动轮换账号以绕过额度，不收集密码，不把复制令牌、私有接口调用或修改官方会话索引作为已经批准的方案。限流提示和退避只用于减少误操作与重复请求。

## 已确定技术栈

| 层次 | 选择 |
| --- | --- |
| 本地逻辑与平台适配 | Rust |
| 桌面壳与 IPC | Tauri 2 |
| 界面与前端工具 | React + TypeScript，Vite + pnpm |
| 本地非敏感数据 | SQLite，由 Rust 侧 rusqlite 访问 |

选择侧重跨平台系统集成，并与 cc-switch 的 Rust/Tauri/React 工程方向一致，减少未来经评审的局部代码移植成本；当前未决定复制其代码。MVP 不设独立 HTTP 后端，凭据仍由官方客户端管理，SQLite 不保存 token。前端与 Rust 依赖分别通过 `pnpm-lock.yaml` 和 `src-tauri/Cargo.lock` 锁定。

基础原型与 M0 调研并行，Desktop 集成方案与原会话接续能力仍待 M0 验证。原型可操作不代表核心产品目标已经通过验收。

## 本地开发

前端需要 Node.js 20.19+ 和 pnpm 10.14.0。Windows 原生构建还需要 Rust 1.99.1 的 MSVC 工具链、Visual Studio C++ Build Tools、Windows SDK 和 WebView2，参见 [Tauri 官方环境要求](https://v2.tauri.app/start/prerequisites/)。仓库通过 `rust-toolchain.toml` 固定 Rust 版本。

在仓库目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` 启动本地服务后，在浏览器手动访问 `http://127.0.0.1:1420`。**预览档案和记录仅保存在当前页面内存，刷新后清空；不能检测本机安装，也不访问 SQLite。** 界面顶部始终标明预览模式。PowerShell 若阻止 `pnpm.ps1`，可将命令中的 `pnpm` 改为 `pnpm.cmd`。

准备好原生构建环境后执行：

```powershell
pnpm tauri dev
```

原生应用通过受限 IPC 访问 Rust，数据库位于系统应用数据目录下的 `com.sessionharbor.desktop/session-harbor.sqlite3`。原生调用失败会显示错误，不会退回浏览器临时数据伪装成功。

```powershell
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:ui
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features
pnpm tauri build --no-bundle
pnpm test:native
```

`pnpm build` 仅构建前端；`pnpm tauri build --no-bundle` 构建原生可执行程序，不生成安装包。实际执行结果与尚未验证项见 [原型构建与测试记录](docs/validation/prototype-build.md)。

Windows 上的 `pnpm test:native` 需要先构建 release 可执行程序。测试在临时应用数据目录内启动原生应用，验证 IPC、SQLite 跨进程重启持久化及预检操作；仅测试进程启用本机 WebView2 调试端口，普通启动不启用。

## 快速阅读

- [产品需求与验收](docs/PRD.md)
- [架构边界](docs/ARCHITECTURE.md)
- [路线图与阶段门槛](docs/ROADMAP.md)
- [技术栈决策](docs/adr/0001-desktop-stack.md)
- [cc-switch 调研与证据边界](docs/research/cc-switch-assessment.md)
- [Desktop Code 人工验证计划](docs/validation/desktop-code-handoff.md)
- [基础原型实施决策](docs/decisions/0002-prototype-implementation.md)
- [原型构建与测试记录](docs/validation/prototype-build.md)
- [参与贡献](CONTRIBUTING.md) · [安全政策](SECURITY.md)

现在可以参与基础功能开发、补充带版本与来源的研究，以及准备 M0 实验。前端、存储或构建检查通过都不能替代 Desktop 实际换号续聊验收。

## 许可

采用 [MIT License](LICENSE) 作为初始许可选择。若后续引入第三方代码，必须保留相应版权与许可声明；当前未复制 cc-switch 源码。
