# Session Harbor 协作约束

- 产品仅面向 Claude；首版是 Windows 上 Claude Desktop 的 Code 编程标签页，后续才考虑 macOS。Desktop Chat 与单纯 CLI 管理不在首版范围。
- 当前已有基础原型源码，实际登录、账号切换、订阅用量获取与原会话接续仍未实现。基础开发可以与 M0 调研并行，但不能用浏览器预览或存储测试代替 Desktop 核心验收；构建、测试与发布状态以实际证据为准。
- 先读 README、PRD 和对应文档再修改。其他协作者可能同时工作，不撤销无关改动。
- M0 必须验证 Desktop 实际身份、原会话上下文、项目/worktree、工具及子进程状态和恢复 A；CLI 成功不能替代 Desktop 验收。
- 不收密码，不自行 OAuth，不默认读取/迁移令牌或查询私有接口，不靠改写官方会话索引制造成功。凭据或认证新方案须先评审。
- 不承诺防封，不自动轮换账号绕过额度。用量未知显示 unknown，不能显示 0 或把本地估算当订阅余额。
- 不提交秘密、真实个人路径、数据库、原始日志或完整私密对话；人工验证用无秘密临时项目，证据先脱敏。
- 假设用 `[ASSUMED]`，用户偏好与产品取舍用 `[VERIFY WITH USER]`，需要工程调研的未知用 `[待技术验证]`；验证未执行写 `NOT RUN`。
- 技术栈已确定为 Rust + Tauri 2 + React + TypeScript + SQLite；前端使用 Vite + pnpm，SQLite 由 Rust 侧 rusqlite 访问，只存非敏感数据，不存 token。tokio/reqwest 按需引入，MVP 不设独立 HTTP 后端；依赖由 pnpm-lock.yaml 和 src-tauri/Cargo.lock 锁定。
- 浏览器预览必须显著标注临时内存模式，刷新清空；原生 IPC/数据库错误不得静默降级为预览成功。预检只能如实记录 blocked/cancelled，不能标记实际切换成功。
- Tauri IPC 只暴露明确用途与范围的能力；自定义 Rust 命令自行校验参数、路径和操作状态，不假设框架自动确保安全。
- 栈选择不代表 Desktop 集成方案或原会话接续已验证。复用第三方源码前固定来源提交并保留许可，当前未决定复制 cc-switch 代码。
- 修改保持在本项目目录内；不要操作父目录或其他项目的 Git 和配置。
