# SlideMind

AI 驱动的教师课件生成器。通过对话式交互生成结构化课件，支持实时预览、页面级编辑和可编辑 PPTX 导出。

## 当前能力

- 支持 `新课新讲`、`错题回顾`、`试卷讲评` 等场景
- 支持 PDF / Word / 文本 / 图片附件上传
- 采用“两阶段生成”：
  - 先生成页面规划
  - 再按批次生成页面内容，降低长输出失真风险
- 支持题型级页面结构：
  - `question-choice`
  - `question-material`
  - `question-answer`
- 支持页面缩略列表、右侧页面编辑栏、批量区域删除、模板切换
- 支持预览侧实时渲染，并尽量让 PPT 导出样式贴近预览
- 支持会话持久化、本地 API Key 加密存储

## 这版重点更新

- 内容生成阶段改为优先使用附件 `extractedText`，不再优先吃截断的 `contentSummary`
- 对长题组改成分批生成，减少第 6 题之后内容丢失的问题
- 无答案/解析附件时，不再保留题型页里的答案性区域
- 页面风险提示改为提示用途，不再阻塞导出
- 右侧编辑栏新增调试入口：
  - `LLM 原始输出排查`
  - `附件解析调试`

## 技术栈

| 模块 | 技术 |
|------|------|
| 桌面框架 | Electron + electron-vite |
| 前端 | Vue 3 + TypeScript + Tailwind CSS |
| 状态管理 | Pinia |
| 预览渲染 | Shadow DOM + CSS Theme |
| PPT 导出 | pptxgenjs |
| 文档解析 | mammoth / pdf-parse |
| 本地存储 | electron-store |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
git clone https://github.com/iiinnovation/SlideMind.git
cd SlideMind
npm install
npm run dev
```

### 构建

```bash
npm run build
npm run build:mac
npm run build:win
```

## 常用脚本

```bash
npm run dev
npm run build
npm run typecheck
npm run smoke:export
npm run benchmark:check
npm run benchmark:run
```

## 项目结构

```text
src/
├── main/
│   ├── ipc/
│   └── services/
├── preload/
├── renderer/
│   └── src/
│       ├── components/
│       ├── composables/
│       ├── services/
│       ├── stores/
│       ├── views/
│       └── types/
├── shared/
└── themes/
```

## 页面 Schema

```ts
type SlideLayout = 'title' | 'content' | 'summary'

type SlideKind =
  | 'cover'
  | 'section'
  | 'knowledge-points'
  | 'question-choice'
  | 'question-material'
  | 'question-answer'
  | 'explanation'
  | 'summary'

type SlideRegion =
  | 'hero'
  | 'lead'
  | 'body'
  | 'question'
  | 'options'
  | 'material'
  | 'analysis'
  | 'answer'
  | 'tips'
  | 'summary'
  | 'footer'
```

## 使用流程

1. 启动应用后，在设置中配置模型和 API Key。
2. 选择场景，输入课件需求，可附带 Word / PDF / 图片等资料。
3. 生成后先看预览，再用右侧编辑栏按页修正。
4. 如需排查模型或附件问题，可在右侧查看：
   - `LLM 原始输出排查`
   - `附件解析调试`
5. 确认无误后导出为 `.pptx`。

## 提交到 GitHub 前

以下内容建议保留在本地，不要提交：

- `.env` / `.env.*`
- `.tmp/`
- `out/`
- `dist/`
- `.claude/`
- `node_modules/`
- 内部文档：
  - `prd.md`
  - `prd_v2.md`
  - `CLAUDE.md`
  - `docs/`

建议提交前至少检查一次：

```bash
git status --short
npm run typecheck
```

如果你准备公开仓库，再额外确认：

- README 里没有本地路径、私有 API 信息
- 示例文件里不包含真实学生资料
- 调试输出里没有残留敏感文本样例

## License

MIT
