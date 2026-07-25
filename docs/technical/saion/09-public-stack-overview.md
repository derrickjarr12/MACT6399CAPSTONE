# 09. Public Stack Overview

This is a public-facing list of the main technologies, systems, and workflows used to bring SAION to life.

## Frontend

1. React 18
   - Main interface framework for the SAION creative workflow.
2. Vite 6
   - Frontend development server and production build tool.
3. Tone.js
   - Browser audio engine for effects, routing, and live audio interaction.
4. Howler
   - Audio playback support in the browser.
5. Three.js
   - 3D rendering engine for the holographic orb visualization.
6. Custom CSS
   - Responsive layout, visual styling, and mobile adaptation.
7. Browser APIs
   - Fetch API for backend calls
   - Server-Sent Events for live request updates
   - localStorage for saved sessions
   - Web Audio support for playback and processing

## Backend

1. Node.js
   - Main runtime for the SAION server.
2. Express 5
   - REST API server, callback ingest, health routes, and static GUI hosting.
3. dotenv
   - Environment variable loading for local and deployed runtime configuration.
4. mysql2
   - Optional MySQL integration for request and job persistence.
5. In-memory request store
   - Local runtime state for active jobs, status updates, and temporary artifacts.

## AI and Generation Layer

1. ElevenLabs
   - Music and voice generation path used by the current UI flow.
2. Mureka
   - Supported provider route for generation orchestration.
3. Udio-compatible provider routing
   - Supported alternate generation path.
4. Provider contract layer
   - Internal request and response normalization across providers.
5. Request tracking model
   - Separate internal request IDs and provider job IDs for reliability.

## SAION Core Logic

1. ARLNS / PNF-AIMS pipeline
   - Internal notation, parsing, validation, and rendering framework.
2. Tokenizer
   - Breaks structured notation into machine-usable tokens.
3. Parser
   - Converts tokens into structured internal representations.
4. Validator
   - Checks notation rules, warnings, and compatibility behavior.
5. Renderer and pipeline utilities
   - Transform validated structures into usable generation context.

## Media Processing

1. FFmpeg
   - Optional media preprocessing and export conversion.
2. FFprobe
   - Media capability and file inspection support.
3. Temporary artifact handling
   - Short-lived generated audio and image assets served from the backend.
4. Waveform and spectrogram generation
   - Optional visual artifacts for audio analysis and display.

## Data and Persistence

1. MySQL
   - Optional persistent storage for request history and recovery.
2. localStorage
   - Browser-side session saves and restored working states.
3. Temporary OS file storage
   - Short-lived generated media files before export or cleanup.

## Deployment and Operations

1. PM2
   - Process management for production runtime.
2. Docker
   - Containerized deployment path.
3. Docker Compose
   - Local or server multi-setting container orchestration.
4. DigitalOcean deployment target
   - Current live hosting target referenced in project docs.
5. Environment-based configuration
   - Provider keys, fallback paths, database settings, and feature flags.

## Quality and Reliability

1. Compatibility baseline test
   - Locks parser and validation behavior.
2. Preflight checks
   - Combined test, GUI build, and startup validation flow.
3. Provider proof scripts
   - Direct provider integration verification.
4. Health endpoints
   - Runtime checks for provider readiness and database availability.
5. Structured QA documentation
   - Test plans, deployment guides, and production readiness records.

## Creative Experience Layer

1. Prompt-driven generation workflow
2. Performance dial system
3. A/B comparison workflow
4. Session save/load/export tools
5. Holographic orb visual companion

## Summary

SAION is built from a combination of modern web UI tools, Node-based backend services, AI music-generation provider integrations, optional database persistence, media-processing utilities, and a custom notation pipeline that ties the creative and technical layers together.