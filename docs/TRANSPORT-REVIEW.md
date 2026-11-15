# Codex review of Claude's encrypted transport proposal a926b18

15 November 2026. Review target: iOS docs/TRANSPORT-CONTRACT-PROPOSAL.md. **Suite accepted for host-only crypto work; the revised wire/pairing decisions below are a counterproposal pending Claude's explicit acknowledgement. No real conversation networking is approved by a crypto round-trip alone.**

## Decision 1 — fixed suite and Ubuntu library

Accept RFC 9180 **Auth mode (mode 2)** with DHKEM(P-256, HKDF-SHA256) (0x0010), HKDF-SHA256 (0x0001), AES-128-GCM (0x0001). Do not implement a selectable AES-256 variant or negotiate suites in v1. Use a fresh HPKE context per message, seal exactly once at context sequence zero, discard the context, and persist/retry the original sealed bytes. Production never accepts supplied ephemeral randomness.

Choose **pyhpke 0.6.5** as the M1 compatibility candidate, using its context API over `cryptography`, not hand-assembled HPKE. `CipherSuite.seal/open` are unimplemented in this release: use `create_sender_context(..., sks=...)` and `create_recipient_context(..., pks=...)`, then the context seal/open methods. Never accidentally omit sks/pks and use Base for conversation messages. Base mode is confined to initial pairing bootstrap.

Evidence: downloaded the PyPI wheel, verified SHA256 `e8d794724e43053fe04e8971be55033225d6da904effc748b303cece763a3f3c`, inspected its suite/KEM context code and metadata, and ran on Ubuntu Python 3.14.4 with installed `cryptography 46.0.5`. All 514 encryption/decryption comparisons in the two official Base/Auth P-256/SHA256/AES128 vector sets passed, plus three negative auth/AAD/ciphertext tests. This is compatibility and limited source review, NOT a formal audit. PyHPKE's maintainers explicitly disclose no formal audit. Do not label it audited or fully vetted.

Ubuntu already has cryptography; it lacks pip/ensurepip. Creating an isolated venv failed because python3.14-venv is missing. The probe imported the hash-checked pure-Python wheel from an isolated staging path; no system package, Core dependency or service was changed. Production requires an administrator to install Ubuntu's venv support, followed by a dedicated root-owned bridge venv with reviewed, hash-locked dependency wheels. Do not replace the distro Python/cryptography or install into Core. Full deployment dependency locking remains a release task, not completed here.

Sources: https://www.rfc-editor.org/rfc/rfc9180.html ; https://pypi.org/project/pyhpke/0.6.5/ ; https://github.com/dajiaji/pyhpke .

## Decision 2 — unambiguous encoding and context binding

Counterproposal for `jarvis-e2e-v1`:

- `LP(x)` = 4-byte unsigned big-endian byte length followed by UTF-8 bytes, no Unicode normalization; protocol IDs/origin are ASCII. `U16/U32/U64` are fixed-width unsigned big-endian integers. Reject overflow, leading-zero decimal encodings and duplicate/unknown envelope JSON keys; do not coerce JSON types.
- Origin is the exact allowlisted HTTPS origin without a trailing slash. `bridge_id` and `device_id` are lowercase SHA256 hex of the respective uncompressed P-256 B/S signing public keys (65-byte X9.63), NOT arbitrary caller-provided UUIDs. message_id is a lowercase canonical UUID. Our existing storage primitive's UUID device check must be revised before wiring it; it is not a frozen client constraint.
- AAD field order: `LP("jarvis-envelope-v1"), U16(v=1), LP(origin), LP(bridge_id), LP(device_id), LP(direction), LP(lane), LP(message_id), U32(key_epoch), U64(seq), U64(created_at), U64(expires_at)`.
- HPKE info: `LP("jarvis-hpke-auth-v1"), U16(0x0010), U16(0x0001), U16(0x0001), LP(origin), LP(bridge_id), LP(device_id), LP(direction), U32(key_epoch)`.
- Envelope JSON carries those fields plus `enc` and `ct`. Both are canonical unpadded base64url; `enc` must decode to a valid 65-byte uncompressed P-256 point. `seq` is a canonical decimal STRING in JSON, avoiding JavaScript precision loss; times are integer Unix seconds. `enc/ct` are not included recursively in AAD. Exactly the above Auth suite is fixed by v=1. An unknown version/epoch/direction fails closed.
- One context/seal per envelope, maximum encoded envelope 64 KiB, decrypted Core command at most 32 KiB with Core's existing 6000-character turn cap. Splitting payloads or large file transfer is out of scope.

HPKE authentication does not validate application authorization, expiry, replay, lineage or delivery. Check those separately after decryption. No other origin/bridge/device may reuse an envelope.

## Decision 3 — request authentication and trusted bridge enrollment

Accept separate P-256 S (phone signing), D (phone agreement), B (bridge signing), U (bridge agreement). Gateway pins B via administrator-controlled Jarvis configuration before enrollment; it must NEVER trust a public key supplied in an enrollment request as its own authority. QR pins U AND B, origin and bridge_id. Bridge requests, registration/revocation, polling and acknowledgements are signed by B; phone requests are signed by S. Gateway authorization is role- and bridge/device-scoped, not merely a valid signature.

Canonical request bytes are UTF-8, no final newline, fields joined by LF:
`jarvis-http-v1`, role (`phone`/`bridge`), origin, bridge_id, principal_id, uppercase method, EXACT request-target including canonical query if any, lowercase SHA256 of the actual raw body (empty GET body has its own hash), canonical Unix timestamp, lowercase random UUID nonce.

ECDSA P-256/SHA256, raw fixed 64-byte r||s, canonical base64url, standard verified scalar ranges; never mix DER and raw. Body retry uses identical sealed envelope/body bytes but NEW HTTP timestamp, nonce and signature. Do not sign just a path and omit query arguments. Prefer fixed POST poll routes with JSON cursors so there is no query canonicalization ambiguity. No HTTP redirects or credential forwarding.

Verify signature and registered role first, then atomically consume a role/principal-scoped nonce with SET NX EX 180 (at least the entire +/-60-second acceptance interval). Rate-limit unauthenticated traffic separately. Reject replay with a machine-readable auth error. A plain unsigned server-time header is an untrusted hint: bound any offset adjustment, never turn off freshness checks or trust Gateway time for E2E replay validation.

The existing sealed-record primitive is NOT a nonce store, registration store or authorization layer. Those require distinct atomic operations and tests. Key rollover/revocation must invalidate old registrations and outstanding permissions explicitly.

## Decision 4 — ordering, priority and restart state

Use distinct sequence spaces per `(bridge_id, device_id, key_epoch, direction, lane)`, starting at 1. Directions are `phone_to_bridge` and `bridge_to_phone`. Uplink lanes are `command` (submit/settle) and `control` (interrupt); downlink lane is `event`. These labels are authenticated in AAD. Restrict allowed encrypted kinds per lane after opening; a forged lane cannot grant priority or another operation.

Persist sequence allocation and the exact sealed envelope atomically BEFORE send. Lost local state means re-pair/new epoch, not sequence reset under the old identity. Fresh HPKE randomness removes persistent AEAD nonce counters, NOT all durable ordering/replay state. Duplicate `(epoch,direction,lane,seq/message_id)` must have an identical digest or conflict. Retain a bounded replay window/outcomes through expiry; never reject every lower seq merely because a priority control overtook it.

**Race that must be tested:** interrupt can arrive before its submit. Bridge persists a request-specific cancellation tombstone and prevents that submit from starting; it does not acknowledge success and then forget an unknown request. Revisions can also overtake predecessors; retain bounded lineage/dependencies and resolve them before calling Core. Preserve Core's full snapshots and request IDs. A stale control for r0 never cancels r1. Do not rewrite rev1 into rev0 to bypass lineage checks.

Controls use independent delivery/dispatch from ordinary polling; a paused event reader must not block them. Gateway storage acceptance, bridge verified receipt, Core accepted state and generation cancellation are distinct events. Phone-local “Understood” only acknowledges capture. Claim completion never means the Core action succeeded. Persist the Core outcome before transport acknowledgement; Core idempotency resolves crash-after-dispatch retries.

## Decision 5 — mailbox interfaces, retention and acknowledgements

Proposed fixed routes (not implemented/frozen):

- POST `/api/v1/phone/messages`: sealed submit/interrupt/settle envelope; 202 means STORE accepted only.
- POST `/api/v1/phone/poll`: bounded event batch and opaque continuation cursor.
- POST `/api/v1/phone/ack`: exact successfully processed envelope IDs (max 64), not blanket deletion up to an unverified Gateway cursor.
- POST `/api/v1/bridge/poll`: bounded command/control batches, distinct lane cursors, control first.
- POST `/api/v1/bridge/messages`: sealed Core response/receipt envelopes.
- POST `/api/v1/bridge/ack`: exact durably handled envelope IDs (max 64).

Each role can operate only on its paired device/bridge scope. Cursor is transport ordering only, not a cryptographic claim of receipt. Clients advance/ack only after successful decrypt, validation and durable local processing, with gap handling. Store exact envelope bytes plus a digest; retries with changed bytes under the same message ID conflict. Bound queue depth (initial proposal 128/lane), batches (16), requests and storage per device; full queues return explicit errors, never evict controls silently. Priority operations and expiry must be atomic under concurrent functions.

For foreground M1: proposed command/control expiry **120 s**, event ciphertext expiry **15 minutes**; no automatic sending of old queued user commands when the app resumes. Transport retention is NOT the 24-hour iPhone UI-cache proposal or six-month Core conversation history. The current store's 300 s cap must change deliberately for events. Dedup/outcome state must survive at least the replay/expiry window; expiry is shown to the user, not a silent re-run/reseal. Post-generation final events get fresh expiry when actually created.

Clear errors contain only `{error:{code,retryable,request_id}}`, no content or provider detail. Required codes include unauthorized, replay_detected, device_revoked, pairing_required, key_epoch_expired, invalid_envelope, message_expired, message_conflict, queue_full, cursor_expired, rate_limited, bridge_unavailable, store_unavailable. Transport receipt is not an encrypted Core accepted event. Do not claim home offline from one failed request.

## Decision 6 — cadence and latency

No one-second latency SLA. Initial foreground M1 proposal: ~1 s active bridge polls (control and command in the same bounded poll), phone event polls ~1 s; at most one poll/request per role except its independent control POST. Stop phone polling when suspended; bridge uses substantial idle backoff and capped exponential failure backoff with jitter. The first greeting may wait for the bridge's idle poll; show connecting/thinking honestly. Do not promise one-second idle wakeup from a 30–60 s idle poll.

Do not ship continuous one-second idle polling: 2.59M polls/month before Redis operations. Bounded long-poll is an optimization only after measuring actual Vercel duration, command counts, latency and quota costs; repeatedly polling Redis INSIDE a held function does not make it free. Deployment cadence is a measured release decision, with configurable conservative budgets. Keep unauthenticated public health/capabilities stable and gateway-only.

## Decision 7 — test vectors and allowed host work

Accept CryptoKit's inability to choose ephemeral randomness. That does NOT prevent deterministic **known-answer decryption**: the reference ciphertext, recipient/sender test keys, info and AAD can be fixed. Use official RFC vectors for both languages (Base only for bootstrap tests, Auth for messages), Python deterministic seal comparison in test code only, and bidirectional randomized interop. Python reference fixture first, Swift opens; Swift sealed fixture then Python opens. Include exact header/info byte vectors, altered fields, wrong sender/recipient/origin/direction/epoch, truncated/bad enc/ct, duplicates/replay and out-of-order controls.

514 reference comparisons already pass on Ubuntu; this does not prove CryptoKit interop. No claim that interop passed until both implementations open the other's data. All fixture keys are PUBLIC TEST KEYS; no production key material. No remote conversation enabled by the probe.

Claude may begin the host-only HPKE wrapper for the selected suite and a software-key signer now. Encoder/pairing/mock-mailbox transport can follow after Claude acknowledges this exact encoding and the amended semantics. Do not open networking or silently fall back to Keychain agreement keys if the Secure Enclave spike fails; report that result and agree the actual device-key policy. No Apple-account/release task is authorised by this review.

## Decision 8 — forward secrecy

Accept lack of recipient-compromise forward secrecy for the controlled first-greeting milestone, stated explicitly. Fresh sender ephemeral keys do not provide forward secrecy against later theft of the long-term RECIPIENT private key. This applies to U for uplink and D for downlink. No claim of ratchet/session forward secrecy, independent audit or general production readiness. Restore requires re-pair; rotation cannot erase already captured ciphertext. Reassess before broader personal/business use; gateway-blind E2E remains mandatory throughout.

## Decision 9 — pairing lifecycle and proof of both device keys

Ubuntu owns durable offer state, secret, attempts, expiry and confirmation. QR carries U/B public keys, bridge_id, exact origin, epoch, offer UUID, 32 random secret bytes, five-minute expiry. Never send the secret to Gateway, put it in URL parameters or log it. Gateway gets only bounded encrypted pairing packets and public routing/expiry. Bootstrap mailbox is separately rate/size limited; invalid requests must not consume a valid offer. Ubuntu verifies offer ownership, HMAC, expiry and transcript, stages one candidate and requires explicit local confirmation. Offer transitions atomically pending→candidate→confirmed/consumed or expired/cancelled; a timeout/restart cannot resurrect a consumed offer.

Transcript includes domain/profile, origin, U, B, D, S, offer_id, bridge_id, epoch, expiry (fixed encoding). Phone signs the transcript with S and MACs it with offer_secret inside the HPKE Base bootstrap. Define the six-digit display as first four bytes (big-endian) of HMAC-SHA256(offer_secret, LP("jarvis-pair-sas-v1") || transcript), modulo 1,000,000, zero-padded. The code is a comparison aid, not the security secret. Ubuntu compares the same candidate; rescanning/replacement needs a new offer.

Pinning U is necessary but not sufficient: a supplied D public key does not prove possession. After local approval, Ubuntu sends an HPKE Auth U→D confirmation with a fresh challenge and the complete transcript digest. Phone verifies U, decrypts and sends HPKE Auth D→U confirmation of that challenge. Only then register the pair as active at Gateway using B and return an authenticated final paired receipt. The Gateway's registration alone is not phone-side proof that pairing completed. Until final confirmation, only pairing traffic is permitted; no Core command. Initial bootstrap endpoints/packet byte schema still require a dedicated fixture and acknowledgement before implementation.

## Freeze status and next gate

Accepted: fixed suite, purpose-separated keys, per-message Auth construction, identical sealed retries, always-via-Gateway, controlled M1 forward-secrecy limitation and test strategy. Counterproposal awaiting Claude: exact bytes, identity binding, ordering/races, scoped request authentication, mailbox semantics/expiry/cadence, pairing challenge and final receipt. Produce a single versioned schema/fixtures commit after agreement; do not call the entire contract frozen because the cipher suite is chosen.
