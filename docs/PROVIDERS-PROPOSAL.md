# Mailbox and outage-monitor proposal — no provisioning

Prices checked 14 November 2026. Separate user-owned Jarvis accounts/resources; no Dinodia keys.

## Candidate choices and estimated costs

- Mailbox: Upstash Redis Free candidate, $0/month, 500,000 commands/month, 10 GB bandwidth and
  approximately 250 MB data. Its pricing table inconsistently says 256 MB in one place; use 250 MB
  conservatively. Store encrypted mailbox/events with short TTLs plus minimal routing metadata,
  not a knowledge base. Exceeding free quota can interrupt service. Paid alternative is $0.20 per
  100,000 commands, with separate storage/bandwidth rules; upgrade only with a user-approved cap.
  https://upstash.com/pricing/redis
- Home heartbeat: Healthchecks.io Hobbyist candidate, $0/month, 20 monitored jobs and 100 log entries
  per job. Ubuntu sends a heartbeat directly, so absence can be detected even if Gateway is down.
  Send only a generic liveness signal, never conversations. Alert integration/latency and allowed
  cadence require an account/setup check before promising APNs delivery.
  https://healthchecks.io/pricing/
- Independent Gateway HTTP monitor: UptimeRobot Free candidate, $0, up to 50 monitors and five-minute
  checks. It can notify independently when Vercel is unreachable, unlike Gateway-hosted APNs alone.
  Coarse health endpoint only; do not expose private operational details. Exact integration and
  escalation routing need setup verification. Five-minute checks are not a five-minute alert SLA.
  https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan

These are proposals, not accounts, subscriptions or guarantees of zero total platform cost.
No service created, no terms accepted, no secret issued and no Vercel action performed here.

## Budget before choosing polling

A 30-day idle bridge poll every 60 s is 43,200 invocations. Polling every 2 s continuously instead
would be 1,296,000 invocations, before phone polls/auth/store commands. Idle cadence must back off;
active-call latency must be measured with bounded long-poll or another tested transport.
At two Redis commands per 60 s idle poll, the idle component alone is 86,400 commands/month.
Actual leases/auth/event operations cost more; measure per-path command counts, not just HTTP count.
The free tier must not be treated as unlimited, and Vercel invocation/duration/CPU quotas are separate.
No fixed live cadence or cost cap is approved yet. Compare active-session transport alternatives
before promising natural real-time interruption across the internet.

## Outage policy proposal

Codex owns provider/integration work. Initial target for discussion remains five minutes of missing
home heartbeat, confirmed observations and one recovery notice per incident. Provider check period,
retry and delivery add latency. Phone offline/notification settings can delay receipt. Watchdog
notifications must not depend solely on the failed component, and messages should be generic.
Staging alias remains user-managed through Chrome; never use Vercel CLI or put a bypass token in iOS.
