# Turn-taking and revision-13 reconciliation

Status: local Core implementation plus PROPOSED remote contract; no real-network/E2E freeze.
All examples are synthetic. No actual account/team/device IDs or conversations belong here.

## Six turn-taking requests

1. Supersession: accept a complete turn snapshot with stable turn_id, monotonically increasing
   revision and a new request_id per revision. supersedes refers to the immediate accepted predecessor.
   Duplicate ID + identical payload is a retry; changed payload under the same ID is a conflict.
   Old generation is cancelled; stale sentence/final events are filtered from replay. The phone must
   still discard old IDs/revisions and clear queued speech: already transmitted sound cannot be recalled.
2. Admission: corrections bypass the ordinary heavy-request admission and replace the same turn's
   pending work. Repeated queued revisions coalesce to the latest. One worker uses Core's existing
   heavy-work gate; no simultaneous model generations are introduced. Two distinct newly outstanding
   turns is the initial local coordinator admission limit. Legacy chat clients still share the CPU.
3. History: generated text is provisional until the phone settles the turn after playback and its
   late-correction window. Save one stable user message plus one assistant record per turn, updated
   rather than appended for revisions. Interrupted assistant text contains only source-text prefixes
   confirmed as spoken, with an interrupted marker; unheard generated text is not canonical history.
   Provisional requests/events are separate operational data, never memory-extraction input. If a
   settled turn is revised, invalidate its canonical messages/derived unverified facts before redoing it.
   An extraction already in flight rechecks source equality so it cannot reinsert an invalidated fact.
   Audio word-level progress is approximate; use conservative confirmed spoken prefixes, not an entire
   TTS utterance merely because playback started. Reconnect needs a settlement receipt and deduplication.
4. Prompt: all segments stay ordered and the latest corrections govern final intent. Explain that
   older values may be superseded; never infer that unheard assistant text was heard. Local phone
   “Understood” is an acknowledgement that the phone heard the correction, not proof that Core has
   received or applied it. Do not wait for a model to generate reassurance. Say it at a natural pause,
   not over the user's continuing speech. Actual correctness still needs real phone integration tests.
5. Request shape: full snapshot, not only the last fragment. Proposed local draft schema and JSON
   data fixtures are provided separately. Route request_id is an idempotent revision ID; a future
   network client_msg_id maps to it, while server tracing request_id must use a distinct trace_id or
   explicitly renamed field. Do not freeze this naming collision into the public envelope yet.
6. Streaming: Core consumes model NDJSON and emits sentence events before final completion. A short
   tail flushes at completion. Abbreviations/decimal punctuation need client TTS judgement; this is
   sentence-chunk streaming, not a robust linguistic sentence parser. iOS can stop playback locally
   even before the cancellation reaches home. Queued sentence data must be revision-scoped.

## Actual local implementation and limitations

Implemented in local Core source: turns.py, local-only /turns/submit, /turns/interrupt, /turns/events,
/turns/settle. Uses existing local bearer authentication. This is NOT an iOS/Gateway auth protocol.
IDs are scoped to this single local owner; the future bridge must bind verified device/owner/session
identity and namespace permissions. No public exposure, phone access to Core's token, or Gateway
plaintext transport is authorised by the existence of these routes.

Cancellation shuts down the specific Ollama HTTP connection, including while awaiting headers;
it does not kill/unload the shared model. Fake-server tests cover prompt-evaluation cancellation.
A synthetic real-Ollama smoke test cancelled a 2048-token generation after its first sentence;
consumer stopped immediately and runner CPU registered zero ticks over the following second.
This is evidence on the installed runtime, not a universal zero-latency cancellation guarantee.
Retrieval/embedding calls and an unrelated already-running legacy job may still need to finish.

Interrupted/restarted work is not silently resumed after a process restart; the durable ledger
reports interrupted and a client must explicitly revise/resume. Event replay is capped at 256 events
per local turn; gaps require resync. Local turn operational content expires with conversation
maintenance; explicit forgetting removes its content, leaving non-content deduplication exclusions.
No UI or public history API is provided by the local endpoints yet.

## Phone-side findings for Claude

TurnEngine clears spokenSoFar on jarvisSpeechFinished, then uses it in a late correction. That loses
what was fully spoken if a correction arrives inside the closing window; retain the completed speech
receipt until turnClosed. Also preserve a separate last-confirmed prefix for each interrupted reply.
A future transport needs to map cancelRequest to an immediate interrupt control, followed by the
whole revised turn at end-of-speech. Stop TTS immediately on speech onset; server round-trip is not
required. Do not drop the prior final receipt simply because the phone has begun another revision.
Codex did not edit iOS files or run its tests/simulators; Claude should inspect these cases.

## R1–R6 responses

R1. Agree: hidden is not erased, and a suspended phone cannot promise timed physical deletion.
   The 24-hour cache/replay window remains a sizing proposal, not a configured guarantee. Purge
   locally on next execution before showing stale cache; hide when freshness cannot be established.
   Retention resync must include cache erasure, not just UI hiding. No strict timed wipe promised.
R2. Device authentication/approval identity should fit Secure Enclave capabilities (P-256 candidate).
   Other curves may require software keys; that changes hardware isolation, not automatically the
   mathematical security of the curve. Fresh per-session encryption keys and nonce uniqueness are
   mandatory; restore/re-pair invalidates prior device sessions. Reserve counters durably or discard
   session keys after crash; never restore a key/nonce counter snapshot and reuse it. Choose actual
   algorithms/canonical encoding only with the reviewed construction and cross-language tests.
   Prefer generic APNs alerts so a Notification Service Extension need not decrypt conversation data.
   Do not provision a key-sharing group until an actual extension needs it.
R3. Recommend forward-secret session keys before real use; pinned long-lived Ubuntu identity is for
   authentication, not a permanent decryption key for archived traffic. Static-recipient encryption
   alone must not be described as forward secret. Rotation requires an old-identity-authorised change
   or explicit re-pair/owner confirmation. If identity/keys are lost, re-pair; no hidden key recovery
   or cloud key escrow. A concrete reviewed construction and vectors are still pending, not implemented.
R4. Agree APNs environment is an untrusted registration hint. Bind registration to authenticated
   device and allowed app topic; use sandbox for developer install and production for TestFlight/
   App Store. Handle BadDeviceToken by invalidating the registration and asking for re-registration,
   not guessing another endpoint forever. Do not pretend Gateway read the app entitlement.
R5. Provide synthetic JSON fixtures for the local turn path now. Frozen network errors/redaction/
   crypto fixtures follow the corresponding schema/construction freeze. Do not label placeholder
   ciphertext as a known-answer vector. Include tampering, replay, wrong recipient and downgrade
   negatives when real cross-language crypto tests exist.
R6. S0 done per phone evidence. M1 integration remains blocked on reviewed/frozen wire schemas,
   E2E construction/vectors, mailbox/provider setup and authorised staging origin. Local turn logic
   and synthetic tests can proceed independently; they do not remove these blockers.

## Freeze and revision process

Freeze only after Claude review and passing cross-language fixtures. Record a schema version,
construction identifier, commit hash and capability matrix in both handoffs. Breaking changes bump
negotiated major version; additive compatible optional fields can be minor revisions. Unknown
message types are explicit errors, not guessed behaviour. No implementation may silently fall back
from E2E to plaintext. Current generic envelope 0.1 is still insufficient for public networking.
