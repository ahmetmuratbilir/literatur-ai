# LiteratureAI Client (React + Vite)

This is the frontend for the LiteratureAI project.

## Requirements

- Node.js 18+

## Configure

Create `client/.env` based on `client/.env.example`:

- `VITE_API_URL=http://localhost:3000`

## Run (dev)

1. Start the server:
   - `cd server`
   - `npm run dev`
2. Start the client:
   - `cd client`
   - `npm run dev`

The client will call the backend at `VITE_API_URL` (defaults to `http://localhost:3000`).

## Backend health check

When the server is running, open:

- `GET http://localhost:3000/api/health`

It reports whether required API keys are present (without exposing them).

