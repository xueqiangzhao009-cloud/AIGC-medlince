# Diabetes Evolution API

This backend mirrors the current React demo flow:

1. Normalize CGM data to mmol/L.
2. Calculate clinical CGM metrics.
3. Produce pathology analysis through an OpenAI-compatible AI API when configured.
4. Return a video placeholder or call an external video generation service.

## Run

```bash
npm run api
```

The default API base URL is:

```text
http://localhost:8787
```

For frontend development, run the Vite app separately:

```bash
npm run dev
```

Vite proxies `/api` requests to `http://localhost:8787`.

## Environment

Copy `.env.example` and set the values needed by your runtime.

The AI service is optional. If `AI_API_KEY` or `OPENAI_API_KEY` is not set, `/api/ai/analyze` and `/api/pipeline/analyze` return deterministic rule-based analysis.

## Endpoints

### GET /api/health

Returns service status and whether AI/video providers are configured.

### POST /api/cgm/metrics

Request:

```json
{
  "unit": "auto",
  "data": [
    { "timestamp": "2026-04-17T08:00:00.000Z", "glucose": 110 },
    { "timestamp": "2026-04-17T08:15:00.000Z", "glucose": 160 }
  ]
}
```

`unit` can be `auto`, `mmol/L`, or `mg/dL`. Auto mode treats values above typical mmol/L ranges as mg/dL.

### POST /api/cgm/parse-csv

Accepts either JSON:

```json
{
  "unit": "auto",
  "csvText": "Time,Glucose\n08:00,110\n09:00,160"
}
```

or raw `text/csv` body. The CSV needs a glucose/value column and may include time/timestamp/date.

### POST /api/ai/analyze

Request with metrics:

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

Request with raw CGM data is also supported:

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

Response:

```json
{
  "analysis": {
    "risk_level": "medium",
    "pathology_summary": "...",
    "video_generation_prompt": "...",
    "recommendations": [],
    "source": "ai"
  }
}
```

### POST /api/video/generate

Request:

```json
{
  "prompt": "Cinematic medical animation inside retinal microvessels..."
}
```

If `VIDEO_API_URL` is not configured, the response points to `/video_placeholder.svg`.

### POST /api/pipeline/analyze

Runs the full workflow in one request: normalize data, calculate metrics, analyze with AI/rules, then return a video result.

Request:

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

Response:

```json
{
  "unit": "mmol/L",
  "sourceUnit": "mg/dL",
  "data": [],
  "metrics": {},
  "analysis": {},
  "video": {
    "videoUrl": "/video_placeholder.svg",
    "source": "placeholder",
    "generated": false
  }
}
```
