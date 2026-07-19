# 01. Product Journey

## Project Identity

- Project: MACT6399 Capstone
- Application: SAION
- Current live URL: https://saionapp-qsqlp.ondigitalocean.app/
- Runtime model: Node/Express backend + React/Vite GUI

## Vision and Core Theme

SAION is a user-driven performance generation and refinement environment that combines:

1. Prompt-based generation requests
2. Performance control dials and presets
3. A/B iteration workflow
4. Visual companion module (holographic orb)

The design principle is to keep decision control with the user, while the system provides structured generation and comparison workflows.

## Conceptual Layers

1. Creative intent layer
   - Session title
   - Prompting and notation
   - Emotion and vocal presets
2. Performance control layer
   - Main dials and sub-dials
   - BPM/time signature context
   - FX values
3. Generation orchestration layer
   - Provider request submission
   - Status polling
   - Request/job tracking
4. Output and review layer
   - Before/after audio references
   - A/B save workflow
   - Playback and compare controls
5. Visual support layer
   - Holographic orb visualizer with parameter-driven behavior

## Evolution Timeline (Current Known Path)

1. ARLNS + PNF-AIMS foundation
   - Notation pipeline and parser/validator/renders established.
   - Compatibility baseline test added to prevent parser/token regression.
2. Provider contract formalization
   - Canonical provider request and normalized result model documented.
   - Internal requestId plus provider jobId model standardized.
3. Multi-provider integration
   - Support for Mureka, Udio/UDioProAPI pathing, and ElevenLabs.
   - Path fallback and provider health checks added.
4. GUI stabilization and packaging
   - Main GUI integrated under gui/ with route-safe static serving.
   - Release packaging automation and release history tracking added.
5. Test-only execution phase
   - Four-week freeze and reliability-first plan established.
   - Emphasis shifted from feature expansion to verification and demo hardening.

## Current Product Boundaries

1. Current phase priority: stability and test execution over feature expansion.
2. V2 features are documented but intentionally deferred.
3. Guidance remains user-assistive; no autonomous replacement of user creative choices.

## V2 Direction (Documented, Not Default Active Scope)

1. SAI concept (guidance-focused assistant mode)
2. Mood and workflow personalization
3. Holographic orb internal video layer
4. Live vocal FX browser-side preview module

See:

- ../../saion-next-steps/V2_OPTIONS_NOTES.md
- ../../saion-next-steps/V2_PRIORITIZATION_MATRIX.md
- ../../../ARLNS/spec/pnf-aims.spec.md

## Start-to-Finish Lifecycle Summary

1. Define creative intent in GUI.
2. Translate control state into generation prompt + metadata.
3. Send request to backend API.
4. Backend routes to provider and persists request state.
5. UI polls status and receives artifact URL when ready.
6. User compares, iterates, and saves A/B versions.
7. Session can be exported for reproducibility and handoff.
8. Release packaging and deployment pipelines move validated builds to runnable artifacts.
