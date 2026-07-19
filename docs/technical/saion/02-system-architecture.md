# 02. System Architecture

## High-Level Topology

SAION runs as a single Node service that:

1. Exposes backend REST endpoints for generation and health
2. Serves static GUI assets in production
3. Hosts ARLNS parsing/validation utility routes
4. Manages request persistence in memory and optional MySQL

## Repository Structure (Functional View)

- src/
  - index.js: server entrypoint, API routes, provider routing, static hosting
  - provider_contract_v1.js: canonical operation enums, validation, normalization helpers
  - tokenizer_v1.js, parser_v1.js, validator.js, pipeline_v1.js: ARLNS core pipeline
  - bars_validator.js, ast_builder_v1.js, renderer_v1.js: notation semantics and output shaping
  - config/: environment loading and startup validation
- gui/
  - src/App-new.jsx: primary GUI workflow and interactions
  - src/styles-match.css: active styling and responsive behavior
  - src/HolographicGlobe.jsx: three.js visual module
- ARLNS/spec/
  - provider-contract-v1.md: provider abstraction contract
  - pnf-aims.spec.md: notation and implementation guidance
- scripts/
  - package-guis.mjs: release packaging automation

## Runtime Layers

1. API layer
   - Express routes for provider actions and status
   - CORS + JSON body parsing
2. Provider orchestration layer
   - Generator-specific config resolution
   - Path fallback and status-path token replacement
3. Persistence layer
   - requestStore in-memory map
   - Optional MySQL connection pool and request table
4. UI delivery layer
   - Static file serving for GUI in production
   - SPA fallback route for non-API paths

## Provider Abstraction Model

Canonical provider operations are represented in provider_contract_v1.js and supported by ARLNS provider contract docs.

Core contract characteristics:

1. Canonical operations (melody_generation, voice_synth, lyrics_to_audio, text_to_audio)
2. Standardized request envelope
3. Standardized normalized response envelope
4. Internal request identity and provider job identity separation

## Request Identity Strategy

SAION keeps two IDs by design:

1. requestId
   - Internal stable application identifier
   - Used for cross-restart lookup and user/session continuity
2. jobId
   - Provider-scoped identifier
   - Used for provider status polling

This separation protects continuity when provider IDs differ by platform or are unavailable at initial dispatch.

## GUI Architecture Highlights

Main GUI behaviors in App-new.jsx:

1. Nav-tab segmented workflow (Performance, Generate, Visualize, Controls)
2. Dial-driven performance model (emotion, vocal, harmony/rhythm/dynamics)
3. A/B save and compare workflow
4. Local audio upload and preview path
5. Provider submission and status polling integration

Visual module details:

- HolographicGlobe.jsx runs a shader-based three.js orb.
- Inputs include drive, bass, treble, distortion and optional texture feeds.
- Texture pipeline supports refresh polling and update callbacks.

## Styling and Responsiveness

Active stylesheet: gui/src/styles-match.css

Current responsive strategy includes:

1. Grid-to-stack transitions across desktop/tablet/phone ranges
2. iPhone and Galaxy class breakpoints
3. Safe-area-aware layout handling for notches/gesture bars
4. Touch-target and compact-layout tuning

## Data and Asset Flow

1. UI captures prompt, settings, optional source audio.
2. Backend receives normalized payload.
3. Provider request sent with selected generator and fallback logic.
4. Status polled until terminal state.
5. Artifact URL returned to UI.
6. UI updates playback target and session export data.

## Architecture Constraints

1. Service is currently single-process centered around src/index.js.
2. Persistence is optional MySQL; memory fallback is available for local development.
3. Release artifacts are generated through scripted dist packaging, not containerized pipeline by default.
