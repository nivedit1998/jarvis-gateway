# User-managed Vercel linking

Repository: nivedit1998/jarvis-gateway (private).
The user creates a separate Jarvis project in the correct Vercel account/team using Chrome and
imports this repository through the Vercel GitHub integration. Do not use Vercel CLI.

This repository currently contains planning documents only. Wait for the gateway scaffold and
its build/runtime configuration before choosing framework/build settings or expecting a working
deployment. Main is the intended production branch; confirm that in the Vercel project. Pushing
commits to that linked branch triggers Git deployment when the integration is configured. A local
commit alone does not deploy. Feature branches should use preview deployments.

No Dinodia .env files or production service keys should be copied into the gateway. Authentication
secrets and any optional broker/relay dependencies will be specified by the agreed design later.
