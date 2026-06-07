# Reminder - Next Session Checklist

## What Is Already Done

- Express backend + React/Vite GUI are in place.
- Hybrid generation routing is implemented:
  - direct provider API path
  - no-code webhook path
  - automatic fallback support
- Async callback endpoint exists for no-code completion updates.
- Request tracking supports internal requestId and optional MySQL persistence.

## What Is Needed Next

1. Configure environment values in .env
	- GENERATION_ROUTING_MODE=hybrid
	- ENABLE_NOCODE_FALLBACK=true
	- NOCODE_WEBHOOK_URL
	- NOCODE_CALLBACK_TOKEN
	- provider API keys

2. Build no-code flow (Make/Zapier/n8n)
	- receive requestId, prompt, payload
	- execute provider step(s)
	- return immediate result OR post async callback to /api/no-code/callback

3. End-to-end test matrix
	- direct success
	- direct failure -> no-code fallback success
	- async no-code callback completion
	- timeout and retry behavior

4. Production hardening
	- enable MySQL persistence in non-local environments
	- secure webhook and callback auth tokens
	- add request logging and failure alerting

5. Demo readiness
	- document one stable default provider path
	- prepare one fallback scenario for live demonstration

## Roadmap (Keep)

Phase 1 -> Class project. Local browser tool. Prove notation works.
Phase 2 -> VS Code extension. Lyricists live where text lives.
Phase 3 -> pnf-aims-core on npm. Let others build on top.
Phase 4 -> Cloud API. Multi-user, save/load sessions, team workflows.
Phase 5 -> Native Suno/Mureka integration if they open APIs further.