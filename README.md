# Jarvis Gateway

Public connection foundation for a private, locally hosted assistant. Core and memory remain on Ubuntu.

## First deployment

Node 22 functions and a static status page, with no external dependencies or required environment variables.

- `/api/health`: Gateway health only; does not imply the home AI is connected.
- `/api/capabilities`: explicit available and pending capabilities.
- `/api/v1/*`: returns `503 connection_not_configured`; no conversation relay is implemented.

Pairing, authenticated sessions, E2E encryption, Ubuntu transport, interruption delivery and notifications are pending. Do not connect real conversation content to this foundation. The draft protocol in `docs/` is not an implemented security contract.

Run `npm test`, `npm run build`, or `npm run dev` (localhost:3000). Vercel imports this repository with the Other preset, root directory `./`, and the checked-in `vercel.json`. Link GitHub main as production; feature branches are previews subject to project settings. A local commit alone never deploys.

Manage Vercel only through Chrome, never its CLI. This environment is separate from Dinodia Smart Living. No credentials, runtime knowledge, conversation exports or machine addresses belong in this public repository.
