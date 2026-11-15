# Upstash free-tier integration preparation

Nivedit approved preparing this integration on 15 November 2026, superseding connection-test-only scope. No paid upgrade is authorised. No account/resource has been created and no credentials configured by this code.

`lib/sealed-store.js` is an INTERNAL storage primitive using the official Upstash HTTPS REST API (https://upstash.com/docs/redis/features/restapi). It writes short-lived opaque byte records with atomic SET NX EX, refuses changed ciphertext under the same device/message ID, and reads bounded records. Requests refuse redirects and have an eight-second deadline. Provider error bodies and credentials are not surfaced. Configuration is separate Jarvis-only `JARVIS_UPSTASH_REST_URL` and `JARVIS_UPSTASH_REST_TOKEN`, supplied only in protected server configuration. They must never be shipped to iOS or copied from Dinodia.

The primitive does NOT verify encryption, authenticate a user, authorize a device, create pairing keys, provide queue ordering, lease messages or guarantee durable replay. A byte-array shape is not proof of encryption. It is deliberately not imported by any public API route. Existing connection endpoints remain fail closed. Its 300-second maximum TTL is an internal preparation bound, not a frozen phone transport contract.

Before wiring public routes: reviewed E2E construction and cross-platform vectors, device authentication/authorization, bounded per-device indexing/quotas, priority control lane, claim/retry/ack semantics, expiry/idempotency integration tests and restart behaviour. Production conversation ciphertext must originate from the actual seal operation, never from a caller merely labelling plaintext encrypted. Gateway never holds recipient decryption keys.

Free tier currently advertises 500K commands/month, 256 MB and 10 GB bandwidth (https://upstash.com/pricing/redis), checked 15 November 2026. No automatic paid upgrade. High-frequency always-on polling is unsuitable: even one poll/second is about 2.59M HTTP requests/month before data operations. Measure the active-session path and idle backoff alongside Vercel quotas. A paired phone does not justify a permanent one-second Redis poll.

Setup remains via the user's separate provider account; all Vercel settings only through Chrome. Account creation/terms/credential entry are separate setup actions. Do not treat mock REST tests as a live cloud integration test.
