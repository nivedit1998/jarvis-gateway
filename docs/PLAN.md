# Vercel cloud gateway: initial planning

No stack or protocol is locked by this empty foundation.

Design before implementation: authentication/device pairing; local Core boundary; session lifecycle;
voice streaming and reconnect/cancellation; rate limits and resource budgets; error/offline states;
minimal durable cloud state and transient audio handling.

First milestone should be a small authenticated end-to-end interaction before full voice calling.
All clients share Core's brain and memory. Do not duplicate model execution or knowledge on cloud/iOS.

Initial owner: Codex. Proposed decisions go here and into the owner's shared handoff.
