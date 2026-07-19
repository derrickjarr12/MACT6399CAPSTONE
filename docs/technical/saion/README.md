# SAION Technical Documentation

This folder is the complete technical record for SAION from project origin through current state and next-phase roadmap.

## Scope

This documentation covers:

1. Product and project journey
2. Architecture and module layout
3. Backend runtime and API behavior
4. Environment setup and deployment
5. Testing, validation, and operations
6. Releases and forward roadmap

## Read Order (Start to Finish)

1. [01-product-journey.md](./01-product-journey.md)
2. [02-system-architecture.md](./02-system-architecture.md)
3. [03-runtime-and-apis.md](./03-runtime-and-apis.md)
4. [04-environments-and-deployment.md](./04-environments-and-deployment.md)
5. [05-testing-and-qa.md](./05-testing-and-qa.md)
6. [06-release-and-roadmap.md](./06-release-and-roadmap.md)
7. [07-ffmpeg-integration.md](./07-ffmpeg-integration.md)
8. [08-elevenlabs-ui-instructions.md](./08-elevenlabs-ui-instructions.md)

## Primary Source Files (Code + Existing Docs)

- Root overview: ../../README.md
- Runtime + server entry: ../../../src/index.js
- FFmpeg media module: ../../../src/media/ffmpeg.js
- Provider contract implementation: ../../../src/provider_contract_v1.js
- ARLNS provider contract spec: ../../../ARLNS/spec/provider-contract-v1.md
- ARLNS product/spec notes: ../../../ARLNS/spec/pnf-aims.spec.md
- Compatibility baseline test: ../../../ARLNS/compat_baseline_v1.test.js
- GUI app: ../../../gui/src/App-new.jsx
- GUI styling baseline: ../../../gui/src/styles-match.css
- Holographic orb renderer: ../../../gui/src/HolographicGlobe.jsx
- Root scripts and commands: ../../../package.json
- Packaging script: ../../../scripts/package-guis.mjs
- Release history: ../../../releases/release-history.jsonl
- Next steps docs set: ../../saion-next-steps/

## Maintenance Notes

- Update this folder whenever architecture, API contracts, release process, or deployment behavior changes.
- Prefer adding dated change notes to chapter files instead of replacing historical details.
- Keep this folder in sync with docs/saion-next-steps and ARLNS/spec.
