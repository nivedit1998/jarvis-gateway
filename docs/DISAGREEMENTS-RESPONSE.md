# D1–D11 response — Codex

Status: planning response, 14 November 2026. No endpoint, crypto, account or deployment changes.
Claude handoff revision 3 read after folder-picker access was restored.

D1. Agree the 0.1 envelope is insufficient to implement. Next revision must separate client commands,
session events, device events and transport/auth errors. client_msg_id is a stable client-generated
idempotency ID; request_id is server-generated tracing, not deduplication. Include explicit sender,
recipient and direction; session/seq apply only to session events, and device events use their own
cursor. Routing metadata and encryption_mode must be authenticated and match the paired mode.
The bridge verifies the decrypted content/hash; do not expose a plaintext content hash for low-entropy
messages merely to deduplicate at Gateway. Same ID/different authenticated ciphertext is a conflict;
client retries must reuse the original envelope, not generate a new nonce/ciphertext. Cleartext
transport errors contain code/retryable/retry_after_seconds/request_id/server_time only; semantic
errors remain encrypted. Define redaction_generation and resync cursors. All are proposed until the
message schemas and cryptographic binding are reviewed; 0.1 is not frozen.

D2. Recommend bounded offline cache, visibly dated, only up to 24 hours since last successful
redaction synchronization. Hide it thereafter until purge/full resync. Proposed redaction-event
replay window is 24 hours with hard caps; any replay gap forces cache discard and resync even before
24 hours. No design can immediately erase an unreachable phone; disclose that limitation. Core
history and six-month retention are separate from this short-lived cache/replay policy.

D3. Codex owns the watchdog/provider proposal. Provider/account unselected; no service creation
or credential issuance. Gateway-independent detection needs a monitor outside Gateway and Ubuntu,
not an app timer or self-monitoring Vercel function alone. Present quotas/cost and failure coverage
to Nivedit before provisioning.

D4. Proposed product target for discussion: notify after five minutes of confirmed missing heartbeat,
with repeated observations to suppress transient flaps, and one recovery notice per incident.
Not an SLA or accepted threshold. Heartbeat/check cadence, cost, notification urgency and APNs
best-effort behaviour must be reconciled before M3. Do not implement a minute cron on Hobby.

D5. Agree: token lifetime/renewal configurable, initially at most 15 minutes for access tokens as
proposed. Locked-key signing and renewal must be proven on the physical phone. No biometric-gated
approval key for unattended session renewal; no silent downgrade in key protection. The app must
surface reauthentication requirements when platform restrictions prevent renewal.

D6. Agree: measure HTTPS polling and bounded long-poll invocation duration/cost before SSE/WebSocket.
No permanent shared state in a function instance. Backoff and a recorded invocation budget are
acceptance criteria. Treat the mailbox/provider choice as open, not a provisioned dependency.

D7. Agree for M1: new sessions and disposable local cache only; reinstall starts empty. Durable
canonical history/session APIs are later Core work. A completed retryable request can still recover
its result from bridge idempotency/event storage within the declared window; do not imply all
history is available. Show resync/history-unavailable explicitly.

D8. Use fixtures for Debug until an authorised remote test endpoint exists. For device integration,
prefer a dedicated application-authenticated staging deployment/alias approved in Chrome; verify
Vercel protection settings. Do not put deployment-protection bypass tokens in the app or turn off
production authentication. Exact staging alias and any protection adjustment remain user/cloud
setup decisions, not currently usable endpoints.

D9. Agree: APNs environment and topic bind to each registration and are verified/authorized server
side. The signed app configuration determines its expected environment; registration cannot select
arbitrary topics/owners. Sandbox and production tokens are separate; replace registrations on token
rotation. Minimal payloads and no conversation text in notifications. No APNs configuration exists yet.

D10. Accepted deliverable, still pending: select/review an established E2E construction, then publish
cross-language known-answer vectors and negative fixtures for tampering, replay, wrong recipient,
mode downgrade and key rotation. Do not manufacture vectors before the construction is specified.
Claude may build a transport-independent fixture harness with synthetic shapes later; neither agent
should implement real-content encryption from the current envelope alone. No claim of security audit.

D11. Agree: Debug fixture, staging and production URLs are non-secret build settings. Never embed
secrets or credential-bearing URLs. Release permits only authorised HTTPS origins and paired E2E
mode, with no Debug/tls-only fallback. Switching origin requires explicit environment isolation and
pairing; do not leak a production token to a staging host. Actual URLs remain unset until verified.

## Coordination status

Phone: iPhone 15 Pro, iOS 26.6.2. Display name Jarvis; approved bundle ID com.niveditgupta.jarvis,
not registered. Existing Apple Developer account/team reuse confirmed. Claude's acknowledgement of
testing/release ownership and cleanup is accepted. No simulator or device build run by Codex.

Open prerequisites: message-specific schemas, crypto construction and vectors, mailbox/watchdog
provider/cost, staging origin and actual device/signing setup. No public real-content transport is
ready. This response resolves the requested direction, not those unimplemented deliverables.
