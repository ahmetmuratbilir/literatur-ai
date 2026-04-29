# LiteratureAI Server (Express)

## Requirements

- Node.js 18+

## Configure

Create `server/.env` based on `server/.env.example`.

## Run (dev)

- `cd server`
- `npm run dev`

## Endpoints

- `GET /api/health` basic status + which API keys are present (no secrets)
- `GET /api/search` runs multi-source search (Scopus/OpenAlex/CORE) and ranks results
- `POST /api/analyze-query` uses Groq to generate optimized boolean queries

If all external sources fail or quotas are exhausted, the server can fall back to demo data (`exdata.json` or `exdata.sample.json`).

