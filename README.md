# Session Harbor

项目仓库：[lida20121212/session-harbor](https://github.com/lida20121212/session-harbor)

面向 **Claude Desktop 的 Code 编程标签页**的个人多账号工作台：帮助使用自己的多个 Claude Pro 账号的人查看账号状态、了解用量，并在主动切换账号后继续原有编程对话。

**当前状态：项目立项。没有可安装程序，没有应用源码，核心能力均未实现。** 最重要的可行性问题仍待验证：Desktop 内实际切换为账号 B 后，能否在同一项目与 worktree 中继续账号 A 的原会话。CLI 登录或恢复成功不能证明这一目标成立。

Session Harbor 是独立开源项目，与 Anthropic 无官方隶属或背书关系。项目名称为工作名称，公开发布前仍需确认名称可用性。

## 计划范围

| 能力 | 目标 | 当前状态 |
| --- | --- | --- |
| 账号管理 | 为用户自己的 Claude Pro 账号维护本地别名和可核验状态 | 未实现 |
| 手动切换 | 使用经验证的官方登录路径，核验 Desktop 实际身份 | 未实现；可行性待验证 |
| 用量监测 | 展示有来源、有时间戳的订阅用量；不可获取时显示 unknown | 未实现；来源待验证 |
| 会话接续 | 在 Desktop Code 中保留原项目、worktree 和对话上下文 | 未实现；M0 核心验证项 |
| 本地保护 | 最少化存储、敏感信息脱敏、切换失败恢复 | 未实现 |

先支持 Windows，再考虑 macOS。首版不覆盖 Desktop Chat、其他模型服务、API 供应商路由或通用 CLI 账号管理。官方 Claude Code CLI 只能作为辅助适配，不是 Desktop 身份的权威来源。

不承诺“防封”，不自动轮换账号以绕过额度，不收集密码，不把复制令牌、私有接口调用或修改官方会话索引作为已经批准的方案。限流提示和退避只用于减少误操作与重复请求。

## 快速阅读

- [产品需求与验收](docs/PRD.md)
- [架构边界](docs/ARCHITECTURE.md)
- [路线图与阶段门槛](docs/ROADMAP.md)
- [技术栈提案](docs/adr/0001-desktop-stack.md)
- [cc-switch 调研与证据边界](docs/research/cc-switch-assessment.md)
- [Desktop Code 人工验证计划](docs/validation/desktop-code-handoff.md)
- [参与贡献](CONTRIBUTING.md) · [安全政策](SECURITY.md)

现在可以参与需求评审、补充带版本与来源的研究，以及准备 M0 实验。仓库尚无构建、安装或运行命令；请勿把文档检查结果当作应用验收。

## 许可

采用 [MIT License](LICENSE) 作为初始许可选择。若后续引入第三方代码，必须保留相应版权与许可声明；当前未复制 cc-switch 源码。
