# Diabetes Evolution Visualizer

Diabetes Evolution Visualizer 是一个面向连续血糖监测（CGM）数据的医学可视化 Demo。项目把血糖数据输入、临床指标计算、AI 病理风险分析和视频化解释串成一条完整流程，适合用于产品原型、课程展示或 AIGC 医疗可视化方案演示。

> 本项目仅用于演示和研究，不构成医学诊断或治疗建议。

## 功能特性

- 生成 14 天模拟 CGM 数据，每 15 分钟一个血糖点。
- 支持上传 CSV 血糖数据，并自动识别 `mg/dL` / `mmol/L`。
- 支持上传图片的截图，目前图片处理为演示级模拟流程。
- 计算 TIR、TAR、TBR、CV、GMI、GRI 等核心血糖指标。
- 使用 Recharts 展示最近 24 小时血糖趋势。
- 提供后端 AI 分析接口，可接入 OpenAI-compatible Chat Completions API。
- 未配置 AI Key 时自动回退到本地规则分析，方便离线演示。
- 提供视频生成接口占位，可后续接入真实视频生成服务。
- 使用 Vite 单文件构建插件，方便导出静态 HTML 演示版本。

## 技术栈

- Frontend: React 18, Vite, Tailwind CSS, Recharts, lucide-react
- Backend: Node.js 原生 HTTP Server
- AI API: OpenAI-compatible `/chat/completions`
- Build: vite-plugin-singlefile

## 项目结构

```text
.
├── public/
│   ├── demo.html
│   └── video_placeholder.svg
├── server/
│   ├── index.js
│   ├── config.js
│   ├── README.md
│   ├── services/
│   │   ├── aiClient.js
│   │   ├── cgmMetrics.js
│   │   ├── fallbackAnalysis.js
│   │   └── videoService.js
│   └── utils/
│       └── http.js
├── src/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── package.json
├── test_data.csv
└── vite.config.js
```

## 快速开始

安装依赖：

```bash
npm install
```

启动后端 API：

```bash
npm run api
```

启动前端开发服务：

```bash
npm run dev
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8787`

开发模式下，Vite 会把 `/api` 请求代理到后端。

## 环境变量

复制 `.env.example` 为 `.env`，按需填写：

```env
API_HOST=0.0.0.0
API_PORT=8787
CORS_ORIGIN=http://localhost:5173

AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=gpt-5.4-mini
AI_TIMEOUT_MS=30000

VIDEO_API_URL=
VIDEO_API_KEY=
VIDEO_TIMEOUT_MS=45000
```

如果不填写 `AI_API_KEY`，后端会使用本地规则生成分析结果。这样可以不依赖网络或密钥直接演示。

## 常用命令

```bash
npm run dev
npm run api
npm run build
npm run preview
```

## 后端 API

### GET `/api/health`

检查服务状态、AI 配置状态和视频服务配置状态。

### POST `/api/cgm/metrics`

根据 CGM 数据计算指标。

```json
{
  "unit": "auto",
  "data": [
    { "timestamp": "2026-04-17T08:00:00.000Z", "glucose": 110 },
    { "timestamp": "2026-04-17T08:15:00.000Z", "glucose": 160 }
  ]
}
```

### POST `/api/cgm/parse-csv`

解析 CSV 并计算指标。

```json
{
  "unit": "auto",
  "csvText": "Time,Glucose\n08:00,110\n09:00,160"
}
```

### POST `/api/ai/analyze`

根据指标或 CGM 数据生成 AI 病理分析。

```json
{
  "locale": "zh-CN",
  "metrics": {
    "tir": "72.4",
    "tar": "21.1",
    "tbr": "2.0",
    "cv": "31.5",
    "gmi": "6.8",
    "gri": "18.2"
  },
  "recentData": []
}
```

### POST `/api/video/generate`

根据 prompt 生成视频结果。未配置 `VIDEO_API_URL` 时返回占位图。

```json
{
  "prompt": "Cinematic medical animation inside retinal microvessels..."
}
```

### POST `/api/pipeline/analyze`

完整流程接口：数据归一化、指标计算、AI 分析和视频结果。

```json
{
  "locale": "zh-CN",
  "unit": "auto",
  "data": [
    { "time": "08:00", "glucose": 110 },
    { "time": "09:00", "glucose": 160 }
  ]
}
```

## 数据格式说明

CSV 至少需要包含血糖列，列名可包含：

- `glucose`
- `value`
- `sgv`

时间列可包含：

- `time`
- `timestamp`
- `date`

`unit` 支持：

- `auto`
- `mg/dL`
- `mmol/L`

`auto` 会根据数据范围自动判断单位。项目自带的 `test_data.csv` 使用 `mg/dL`，后端会自动转换为 `mmol/L`。

## 构建

```bash
npm run build
```

构建结果会输出到 `dist/`。当前配置使用 `vite-plugin-singlefile`，会将主要资源内联到单个 HTML，便于演示分发。

## 说明

当前 AI 和视频生成都是可插拔接口：

- AI：默认兼容 OpenAI `/chat/completions` 格式。
- 视频：预留 `VIDEO_API_URL`，可接第三方文生视频服务。

真实医疗场景中，还需要补充数据校验、权限认证、审计日志、模型安全评估、医学合规审查和临床验证。
