# Reasonian

在 Obsidian 中嵌入 [Reasonix](https://github.com/esengine/DeepSeek-Reasonix)（DeepSeek 原生编程 Agent）的侧边栏插件。

## 功能

- 💬 侧边栏聊天界面，多标签页支持
- 🧠 DeepSeek V4 模型（flash / pro），支持思考模式
- 📝 行内编辑、斜杠命令、Plan 模式
- 🔧 文件读写、Shell 命令、MCP 工具
- 💾 会话持久化、长期记忆（REASONIX.md + `/memory`）
- 🌍 10 种语言国际化

## 安装

> 插件尚未发布到 Obsidian 社区市场，请手动安装。

1. 下载最新 Release 中的 `main.js`、`styles.css`、`manifest.json`
2. 在 vault 的 `.obsidian/plugins/reasonian/` 目录下放入上述文件
3. 重启 Obsidian，在设置 → 第三方插件中启用 Reasonian

## 配置

1. 打开 Obsidian 设置 → Reasonian
2. 填入 DeepSeek API Key
3. （可选）配置自定义系统提示词、长期记忆、模型等

## 开发

```bash
git clone https://github.com/Reject-Reality/Reasonian.git
cd reasonian
npm install
npm run dev    # 开发模式
npm run build  # 生产构建
```

## 致谢

Reasonian 基于 [Claudian](https://github.com/YishenTu/claudian)（MIT License）二次开发，将 Claude 后端替换为 Reasonix。

## License

MIT
