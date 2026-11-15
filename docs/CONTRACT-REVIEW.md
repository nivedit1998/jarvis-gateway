# Communication contract review — Codex response

Status: proposed 0.1 draft for Claude/user review, not an implemented or agreed API.
Date: 14 November 2026. No cloud provisioning, Core changes or deployment in this pass.

## Scope and corrections

Accept the thin authenticated text milestone first, with voice later. Claude owns iOS planning;
Codex owns Gateway/Ubuntu/Core proposals. Keep transport replaceable. Do not block text messaging
on a complete approvals system, APNs, streaming, all history screens or voice.

Latency: 600 output tokens / 11 tokens per second is generation time, not an upper bound. Queueing,
retrieval and prompt evaluation add delay; a recent role/policy check took about 90 seconds. Four
inference threads are now requested, and actual latency varies with context. No 55-second guarantee.

Private keys are long-lived device credentials even if non-exportable; say “no long-lived bearer
secret on the phone,” not “no long-lived secret.” Session renewal while screen-locked must be
proven with the selected key protection. Approval keys remain user-presence-gated.

## Q1 — Registry, pairing and revocation

Propose Ubuntu as pairing authority and canonical device registry. Gateway stores the minimum public
registry/revocation metadata needed to authenticate requests. New pairing requires Ubuntu online and
explicit local confirmation, with an offer expiring after five minutes, single-use redemption and
attempt limits. A short human confirmation code is not the high-entropy authentication secret.

Apply revocation on every authenticated request/token renewal, not merely the next 15-minute
challenge; bridge also checks its registry. No new pairing when offline. Emergency Gateway denylisting
needs an independently authenticated owner-management path; this is an open administrative design,
not an unauthenticated public revoke endpoint. A local revocation cannot reach an offline Gateway:
be explicit about that propagation limit. Short tokens bound fallback exposure; fail closed if the
Gateway cannot verify current revocation state.

Q1 schemas and signing canonicalization need a separate security review before implementation.

## Q2 — Vercel transport and shared state

Propose short HTTPS requests with accepted-then-poll events for milestone 1. Ubuntu uses authenticated
outbound polling/claims; no router port forwarding or public Core endpoint. iPhone submits a request,
gets acceptance quickly, then polls event batches while foregrounded. Select intervals/backoff and
an invocation budget during a spike; do not poll a suspended app or promise a free always-on link.
SSE/WebSocket is optional later if measurements show worthwhile latency/cost improvement.

Stateless Vercel instances require an external shared store for pairing state, device metadata,
short-lived request mailboxes, leases and replay cursors. No process-memory-only queue or local
Vercel filesystem as durable state. The managed store/provider and its quotas/cost remain open;
no new account, paid plan or store has been provisioned. Prefer no cloud transcript archive.

A minimal reliable path is: phone -> Gateway mailbox -> Ubuntu bridge -> local Core -> bridge
outbox -> Gateway events -> phone. Claim leases and durable message IDs must prevent duplicate
execution after retries. The bridge's durable local ledger is authoritative; cloud TTL expiry must
not silently authorize the same operation again.

## Q3 — Streaming and cancellation

Neither exists in deployed Core. M1 may return one final event. Capability negotiation must say
streaming=false until real incremental Core output is implemented. Later streaming requires model
stream consumption, sequenced deltas and durable finalization, not simulated typing after completion.

Cancellation semantics: queued requests can be removed; running v0 requests can be marked abandoned
for delivery, but inference may continue and Core may already have persisted the turn. Do not report
“compute stopped” or “information deleted” when only delivery is suppressed. Terminal cancellation
outcome and any later completion must reconcile idempotently. True cooperative cancellation is
separate Core work. Cancellation never substitutes for an external-action rollback.

## Q4 — End-to-end encryption

Support an explicit negotiated encryption_mode from day one. Recommend E2E text content before real
business conversations pass through a persistent cloud mailbox; Nivedit must choose scope. TLS-only
prototype is possible with explicit consent and test content, not described as end-to-end encrypted.

Do not invent crypto or settle a cipher suite in an envelope placeholder. Pick an established,
audited construction/library, bind device/session/sequence/direction as authenticated data, pin the
Ubuntu identity through pairing, and define key rotation/recovery/replay protection. Gateway sees
routing metadata. With E2E, replay entries are ciphertext, the bridge owns semantic validation, and
the local canonical transcript remains readable only on Ubuntu/paired clients. Negotiation must not
silently downgrade encryption. The draft schema's modes are reserved, not evidence of implementation.

## Q5 — Speech

Recommend on-device iPhone STT/TTS as the voice v1 candidate: text travels to Ubuntu, reducing its CPU
load and avoiding an audio relay. This does not change where Jarvis's AI or memory lives. It defers,
rather than rules out, Ubuntu speech for later clients.

Local recognition must be explicitly required and supported for the locale/device. If unavailable,
fail with text fallback; do not silently send audio to Apple's network recognizer. Confirm on-device
voice assets, locked-screen recognition, interruptions, cellular handover and locked token renewal on
Nivedit's physical phone. On-device speech is a recommendation pending user agreement and the spike.

## Q6 — Replay, idempotency and retention

Propose cloud event replay up to 24 hours, with hard byte/event caps, acknowledgement-driven early
cleanup and no transcript archive. If a window/cap is exceeded, return session.resync; read canonical
history from Ubuntu when available. If Ubuntu is offline, history may be unavailable: do not fabricate
it from an expired mailbox. These limits need workload sizing before agreement.

Stable client_msg_id plus a durable bridge/Core deduplication ledger, bound to device/session and
payload hash. Same ID with different payload is a conflict. Expired keys are rejected, not treated as
new commands. External-action exactly-once semantics require connector-specific idempotency; do not
promise exactly-once merely because the Gateway deduplicates messages. Local retention/deletion rules
apply to both canonical records and derived caches. Default offline auto-send recommendation: require
a user tap after reconnect; a short automatic window is optional and awaits Nivedit's preference.

## Q7 — History

Core owns canonical session/history APIs and deletion/correction/expiry generations. Bridge adapts
these; it must not read SQLite directly or create a competing transcript store. Add pagination,
namespace authorization and redaction cursors/generations to Core later. A client beyond redaction
replay retention must discard its cache and full-resync, not retain deleted content. M1 can omit history
sync explicitly while supporting a new text session and durable request results.

## Q8 — Approvals

Core code defines and validates the action schema and owns pending/resolved/expired states and the
action ledger. The model can propose an action, not mint an executable approval object. The bridge
verifies device signatures/trust and forwards the exact signed envelope; Core checks immutable action
hash, nonce, expiry, device authorization and single-use state before execution. Bind decisions to
protocol version, owner/device, approval ID, action hash, nonce, expiry and decision under a specified
canonical encoding. Approvals expire closed; offline delivery never implies approval. No actions
or approval endpoints exist today; separate this milestone from initial text. Prefer cautious wording
about Face ID: platform user-presence policies and explicit passcode fallback require definition.

## Q9 — Push and watchdog

Agree Gateway-side APNs dispatch with minimal notification payloads and protected APNs credentials;
Ubuntu reports heartbeat, while an independent scheduler/watchdog detects absence. Gateway is not a
permanent running process. Vercel Hobby Cron runs at most daily and cannot provide minute-level outage
checks; a separate permitted scheduler/monitor (or suitable platform feature after verification) is
needed. Nothing provisioned. Design independent Gateway outage detection too: a broken Gateway cannot
reliably alert through itself. APNs delivery is best-effort, not a guaranteed emergency channel.

Paid team/APNs provisioning needs confirmation. Do not categorically claim a paid team is needed for
all local background-audio tests; verify signing/capability availability for the actual account.

## Q10 — Namespaces

Keep an explicit namespace bound to each session in v1. Default Dinodia; choose Personal explicitly.
The ordinary mobile client should not offer unrestricted System writes. Server enforces namespace
permissions; a chip is not access control. Automatic classification/routing is later Core work.

## Q11 — Schema and change process

The proposed envelope is docs/protocol-envelope.schema.json in jarvis-gateway. It describes transport
shape only, not implemented endpoint availability, encryption/auth algorithms or all payload schemas.
Schema version 0.1-draft; v=1 is the reserved eventual wire major version. No client should depend on
it as settled until Claude review and user decisions are recorded. Publish frozen message-specific
schemas and fixtures before implementation. Additive optional fields may be ignored; unsupported
message types/capabilities must be rejected explicitly. Breaking changes increment negotiated major
version; no silent fallback. Announce via both handoffs and recorded contract revision/commit.

## User decisions needed

1. Accept on-device iPhone speech as voice v1 candidate (with strict local-only fallback behaviour)?
2. E2E before real conversations, or an explicit TLS-only test prototype first?
3. iPhone model/iOS, Apple team membership, intended app name, bundle identifier and initial device count.
4. Permission to select a small cloud mailbox store and external watchdog after presenting quotas/cost.
5. Notification urgency and offline send policy can follow the initial text milestone.

## Primary references checked

- Vercel Hobby Cron: https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing
- Local speech support: https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition
- Local-only request flag: https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition
- Secure Enclave key accessibility: https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave
- Apple membership: https://developer.apple.com/help/account/basics/about-your-developer-account
