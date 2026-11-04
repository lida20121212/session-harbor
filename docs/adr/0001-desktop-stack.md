# ADR 0001：桌面技术栈选择

状态：**Accepted** · 日期：2026-11-02

决策授权：用户委托选择本项目最优技术栈，由项目代理完成选型；这不表示用户亲自指定 Rust。本决策替代本 ADR 先前处于 Proposed 状态的 Go + Wails + Vue 3 / TypeScript 建议。

## 背景

Session Harbor 是仅面向 Claude 的独立开源项目，首版目标为 Claude Desktop 的 Code 编程标签页，Windows 优先、后续考虑 macOS。核心需求是用户主动切换自己的账号后继续原任务，并查看有可靠来源的用量信息。

当前只有立项文档，没有应用代码、依赖锁文件或可运行包。Desktop 的实际身份核验和跨账号接续原会话仍为 [待技术验证]；CLI 登录或恢复成功不能替代 Desktop 验收。技术栈可以先确定，但不能证明这些核心能力可行。

## 决策

采用 **Rust + Tauri 2 + React + TypeScript + SQLite**，以本地桌面应用实现 MVP，不设独立 HTTP 后端。

| 层次 | 选择与边界 |
| --- | --- |
| 本地核心 | Rust 稳定工具链；核心系统操作、平台适配与状态协调留在 Rust 侧 |
| 桌面容器 | Tauri 2；使用其 capabilities/permissions 机制限制暴露能力；自定义 Rust 命令仍须校验参数、路径与允许的操作范围 |
| 界面与前端工具 | React + TypeScript，Vite + pnpm；UI 通过有限、明确的 Tauri 命令调用本地核心 |
| 本地存储 | SQLite，由 Rust 侧通过 rusqlite 访问；只保存元数据、用量观测和设置，不保存 token |
| 异步与网络 | tokio、reqwest 按实现需要引入；本次决策不授权查询私有接口或采用新的凭据方案 |

不在文档中指定尚未验证的依赖小版本。实施时锁定工具链及依赖，提交 `Cargo.lock` 和 `pnpm-lock.yaml`；当前不创建源码、依赖包或虚构构建命令。

## 候选方案

| 方案 | 评估结果 | 收益 | 成本与待验证项 |
| --- | --- | --- | --- |
| Rust + Tauri 2 + React / TypeScript | 选定 | 与 cc-switch 现有 Rust/Tauri/React 实现一致，便于参考平台模块；经评估后的局部复用可减少语言与 UI 转换成本；Tauri 提供官方权限及分发机制 | Rust 学习与维护成本；系统 WebView 差异；Windows 与 macOS 各自的构建、签名和验证工作 |
| Go + Wails + Vue 3 / TypeScript | 可行备选；替代先前推荐 | 能实现本地协调与界面分层；维护者若更熟悉 Go/Vue，开发成本可能更低 | 维护者熟悉度尚未核实；本次按系统集成与参考实现一致性加权，未选此方案，不代表其能力不足 |
| Electron + TypeScript | 备选 | 自带浏览器运行时，前端运行环境较一致 | 自带浏览器带来更重的分发负担；仍需独立处理平台集成与身份、会话验证 |

## 选择理由

产品目标已明确为 Desktop Code 集成以及从 Windows 扩展到 macOS。此次将系统集成、平台模块的参考价值和实现一致性作为主要权重，选择 Rust/Tauri。cc-switch 的现有实现提供了可研究的同栈参考；这是降低后续局部复用转换成本的工程判断，不是决定 fork，也不批准照搬其凭据代码或无关的供应商、CLI 功能。

React 的选择主要为了与参考工程一致，不宣称其普遍优于 Vue。Tauri 的官方权限和分发机制可作为实施基础，但不能替代自定义命令校验、平台测试或隐私审查。Rust 也不保证账号不会受限或程序没有漏洞。

## 实施门槛与未决事项

1. M0 仍须验证 Desktop 实际身份、原会话上下文、项目/worktree、工具与子进程状态，以及恢复账号 A。MVP 功能实现以 M0 结论为门槛；选栈不代表通过 M0。
2. 可先用所选栈建立后续最小技术原型，验证启动、命令边界、本地存储和平台打包；原型不能被称为已具备账号切换或会话接续功能。本次仅更新文档，不创建原型或运行登录流程。
3. Rust 学习与维护投入作为实施成本持续评估。[待技术验证] 系统 WebView 的表现差异，以及 Windows/macOS 分别构建、签名和验证的具体方案。
4. 若复用第三方源码，先固定上游提交，评估适配范围，再记录复制文件及本地改动并保留版权和许可。当前 `main` 分支来源仅用于选型参考，不是固定的复用版本。
5. 如 M0 结果改变集成要求，或原型暴露无法接受的维护成本，应以新 ADR 重新评估；不得把新建会话并复制摘要当作原会话接续通过。

## 后果

后续技术原型和通过 M0 后的 MVP 按本栈规划。团队需要承担 Rust 的学习维护成本、系统 WebView 差异，以及 Windows/macOS 独立的构建签名验证成本。凭据处理与 Desktop 集成方式仍需单独验证和评审；本 ADR 不批准令牌迁移、私有接口或改写官方会话索引。

验证状态：**NOT RUN**。本次仅确立技术选择，未产生应用实现、构建结果或 Desktop 跨账号接续证据。

## 参考来源

- [Tauri 2 capabilities](https://v2.tauri.app/security/capabilities/)：权限边界的官方机制。
- [Tauri 2 distribution](https://v2.tauri.app/distribute/)：平台打包与分发的官方入口；不代表本项目已完成构建签名验证。
- [cc-switch package.json](https://github.com/farion1231/cc-switch/blob/main/package.json)：前端技术栈参考。
- [cc-switch Cargo.toml](https://github.com/farion1231/cc-switch/blob/main/src-tauri/Cargo.toml)：Rust/Tauri 实现参考。
