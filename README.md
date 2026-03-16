# SlideMind

AI 驱动的教师专属课件生成器。通过对话式交互，一键生成结构化课件，支持实时预览与可编辑 PPTX 导出。

## 功能特性

- **AI 课件生成** - 接入 DeepSeek、豆包、通义千问等大模型，通过自然语言描述自动生成课件
- **多场景模板** - 内置"新课新讲"、"错题回顾"等教学场景模板
- **实时预览** - 基于 Marp 的幻灯片实时渲染预览
- **PPTX 导出** - 导出为原生可编辑的 `.pptx` 格式，可在 PowerPoint/WPS 中二次编辑
- **文件上传** - 支持上传 PDF、Word 等教学资料作为生成参考
- **会话管理** - 支持多轮对话与历史会话管理
- **本地安全** - API Key 通过 Electron safeStorage 加密存储，数据不出本地

## 当前演进方向

- **题型级版式体系** - 从通用 `title/content/summary` 扩展到 `question-choice`、`question-material`、`question-answer` 等题型页面
- **区域语义标注** - 在元素级增加 `region` 字段，为题干、材料、解析、答案、提示等区域提供稳定语义
- **两阶段生成** - 后续会从“直接输出整份课件”升级为“先页面规划，再填充内容”
- **导出后处理** - 为高密度页面补充自动拆页、字号回退和区域排版校正

## 技术栈

| 模块 | 技术 |
|------|------|
| 桌面框架 | Electron + electron-vite |
| 前端 | Vue 3 + TypeScript + Tailwind CSS |
| 状态管理 | Pinia |
| 预览引擎 | Marp |
| PPTX 导出 | pptxgenjs |
| 本地存储 | electron-store |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/iiinnovation/SlideMind.git
cd SlideMind

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

### 构建

```bash
# 构建 macOS 安装包
npm run build:mac

# 构建 Windows 安装包
npm run build:win
```

## 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── ipc/           # IPC 通信处理
│   └── services/      # 导出、文件解析、会话等服务
├── preload/           # 预加载脚本（contextBridge）
├── renderer/          # 渲染进程（Vue 3 应用）
│   └── src/
│       ├── components/    # UI 组件
│       ├── composables/   # 组合式函数
│       ├── services/      # LLM 调用、Prompt 管理等
│       ├── stores/        # Pinia 状态管理
│       ├── views/         # 页面视图
│       └── types/         # 类型定义
├── shared/            # 主进程与渲染进程共享类型
└── themes/            # 课件主题（CSS 预览 + PPTX 导出双轨配置）
```

## 幻灯片 Schema

当前课件数据结构已经开始向“题型级页面 schema”过渡：

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

- `layout` 仍然负责基础页面布局兼容。
- `kind` 用于表达页面题型或语义类型，是后续版式系统的核心字段。
- `region` 用于表达元素所属区域，方便预览和导出在题干、材料、答案、总结等区域做稳定排版。

示例：

```json
{
  "layout": "content",
  "kind": "question-answer",
  "title": "材料分析题",
  "elements": [
    { "type": "list", "region": "question", "items": ["题干关键信息"] },
    { "type": "heading", "region": "analysis", "level": 3, "content": "错误原因" },
    { "type": "list", "region": "answer", "items": ["解题步骤一", "解题步骤二"] }
  ]
}
```

## 使用说明

1. 启动应用后，在设置中配置 LLM API Key（支持 DeepSeek / 豆包 / 通义千问）
2. 选择课件场景模板（新课新讲、错题回顾等）
3. 在对话框中描述课件需求，可上传教学资料作为参考
4. AI 生成课件后，实时预览幻灯片效果
5. 满意后导出为 `.pptx` 文件

## License

[MIT](LICENSE)
