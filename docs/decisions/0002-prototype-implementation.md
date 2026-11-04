# 基础原型与 Desktop 可行性验证并行

状态：Active · 日期：2026-11-02 · 来源：用户要求“开始实施落代码”及“继续”

## 决策

在 Rust + Tauri 2 + React + TypeScript + SQLite 技术栈上实施可独立验证的基础工作台，不等待 Desktop 集成研究结束。账号档案只记录本地别名和备注；原生数据存入 SQLite，浏览器预览使用显著标注的临时内存数据。

初始范围包括账号增删改、只读安装候选检测、unknown 用量展示、blocked/cancelled 接续预检及历史。预检用于如实记录当前能力缺口，不执行登录、切换、进程控制或会话恢复。

## 原因与边界

用户已经确定 Windows 优先、后续 macOS，并要求开始实现。上述基础功能可以推进工程与交互验证，同时保持 M0 的证据门槛：Desktop 实际身份、原会话上下文、项目/worktree、在途任务和恢复 A 仍必须独立实测。

这是实施顺序的调整，不是对产品目标的降级。账号别名不等于认证身份，浏览器测试不等于原生验证，构建成功不等于换号续聊成功。不引入凭据读取、私有接口、自行 OAuth 或自动轮换。

## 已落代码与后续

已有 React 工作台、受限 Tauri 命令、SQLite v1、依赖锁文件与 Windows CI 配置。实际检查结果集中保存在 [构建与测试记录](../validation/prototype-build.md)，不在本决策中固化尚未完成的测试结论。

后续先完成基础原型的原生构建与测试，并继续 [M0 人工验证](../validation/desktop-code-handoff.md)。只有 M0 形成证据后，才能选定 Desktop 集成方式并进入核心路径验收。

参考：[PRD](../PRD.md)、[架构](../ARCHITECTURE.md)、[路线图](../ROADMAP.md)、[技术栈决策](../adr/0001-desktop-stack.md)。
