# cc-switch 调研：可借鉴之处与证据边界

检查日期：2026-11-02。范围为公开文档与 `main` 分支源码的只读研究；未安装或实际登录测试。`main` 链接会变化，正式复用前需固定提交 SHA。

## 核实内容

| 证据 | 观察 | 对本项目的意义 |
| --- | --- | --- |
| [项目仓库](https://github.com/farion1231/cc-switch)、[package.json](https://github.com/farion1231/cc-switch/blob/main/package.json)、[许可](https://github.com/farion1231/cc-switch/blob/main/LICENSE) | 检查时 package 版本为 4.0.24，使用 Tauri 2、Rust、React 18、TypeScript；MIT；README 列出 Windows/macOS/Linux | 可参考桌面工程组织；不代表对应发布安装包已验证 |
| [CLI 账号模块](https://github.com/farion1231/cc-switch/blob/main/src-tauri/src/services/claude_account/mod.rs)、[官方供应商绑定](https://github.com/farion1231/cc-switch/blob/main/src-tauri/src/services/provider/claude_official.rs) | 独立 `CLAUDE_CONFIG_DIR`、调用 `claude auth login`、官方卡绑定登录槽位 | 可参考 CLI 账号隔离与状态建模；不能据此认定 Desktop 身份隔离 |
| [CLI 共享历史模块](https://github.com/farion1231/cc-switch/blob/main/src-tauri/src/services/claude_account/shared.rs) | 共享 `projects`、`file-history` 等 CLI 本地历史 | 可参考历史与身份解耦的思考；文件可见不等于 Desktop 跨账号会话可继续 |
| [Desktop 配置实现](https://github.com/farion1231/cc-switch/blob/main/src-tauri/src/claude_desktop_config.rs)、[Desktop 手册](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/zh/2-providers/2.6-claude-desktop.md) | Desktop 集成针对 API 第三方配置、模型映射和官方模式恢复 | 不能证明个人 Pro 账号切换或原对话接续 |
| [会话手册](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/zh/3-extensions/3.4-sessions.md) | Desktop 会话能力列为“—”；会话面板中的相关能力实际作用于 Claude Code | 必须区分桌面管理工具的会话面板与 Claude Desktop Code 本身 |
| [用量查询说明](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/zh/2-providers/2.5-usage-query.md)、[账号模块](https://github.com/farion1231/cc-switch/blob/main/src-tauri/src/services/claude_account/mod.rs) | 参考项目有读取 CLI 凭据用于订阅额度监测的实现 | 仅记录参考事实；不作为本项目获得凭据用途许可或可复用私有接口的证明 |

## 官方资料对照

- [Desktop 与 CLI 的关系](https://code.claude.com/docs/en/desktop#coming-from-the-cli)：用于研究入口和能力差异；CLI 支持的流程必须在 Desktop Code 中单独验证。
- [CLI 多账号登录说明](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts)：可作为未修改的官方 CLI 登录路径参考，不能自动扩大为本项目对 Desktop 凭据的操作权限。
- [认证与凭据使用说明](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use)：实现前应重新核对适用约束，不照搬参考项目的令牌读取与接口请求。
- [Claude 数据导出说明](https://support.claude.com/en/articles/9450526-export-your-claude-data)：官方未支持 Chat 个人账号之间直接迁移；这不等于已证明 Desktop Code 跨账号会话接续不支持，两者需分开验证。

## 可借鉴

账号展示与实际认证分离、状态显式化、平台能力隔离、失败恢复、用量来源与刷新时间标注，以及以 MIT 许可组织开源贡献。当前借鉴的是产品与架构思路，未复制源码。

## 不能据此推断

不能用 CLI 登录 B、共享历史目录、打开旧记录、恢复官方模式或 token 计数来证明“Desktop 实际使用 B 并继续 A 的原会话”。也不能承诺账号安全不受限，或把参考实现存在当作官方支持、兼容或许可的证明。

结论：cc-switch 是有价值的设计参考，**尚不是 Session Harbor 核心目标可行的证据**。下一步应执行 [Desktop Code 验证计划](../validation/desktop-code-handoff.md)，再决定是否开发及如何集成。

[待技术验证] 参考版本固定 SHA、Desktop 认证与会话接口、订阅用量可用来源均未确定。[VERIFY WITH USER] 是否复用代码及复用范围待决定。
