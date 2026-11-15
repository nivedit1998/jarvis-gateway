# Jarvis Gateway

Public connection foundation for a private, locally hosted assistant. Core and memory remain on Ubuntu.

## Encrypted relay milestone

Node 22 functions and a static status page. Core inference and memory remain on Ubuntu; the Gateway routes authenticated encrypted envelopes through a bounded, short-lived mailbox. It never receives Core's bearer token or decryption keys.

- `/api/health`: public Gateway health only; does not imply home availability.
- `/api/capabilities`: public configured capabilities; paired-device/home status stays private.
- `/api/v1/*`: signed relay/bootstrap routes, fail closed when production configuration is absent.

See `docs/RELAY-IMPLEMENTATION.md` for required Secret environment settings, exact routes, fixed origin, limits, retries and idle wake waiting. Provider secrets must remain outside this public repository and unconfigured on untrusted previews. Ubuntu's B signing public key is administrator-pinned. Pairing requires explicit local code confirmation and authenticated key proof; message content is HPKE-encrypted only on the phone and Ubuntu.

Production has completed a real encrypted Core greeting with a synthetic authenticated peer and then a paired physical iPhone. This is an initial conversation milestone, not an audit or a claim that push, business tools, independent outage detection or full recovery hardening are complete.

Run `npm test`, `npm run build`, or `npm run dev` (localhost:3000). Vercel imports this repository with the Other preset, root directory `./`, and the checked-in `vercel.json`. Link GitHub main as production; feature branches are previews subject to project settings. A local commit alone never deploys.

Manage Vercel only through Chrome, never its CLI. This environment is separate from Dinodia Smart Living. No credentials, runtime knowledge, conversation exports or machine addresses belong in this public repository.
