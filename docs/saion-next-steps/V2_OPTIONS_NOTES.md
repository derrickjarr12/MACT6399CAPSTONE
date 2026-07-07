# SAION V2 Options Notes

This file captures V2-related options and deferred items for planning only. It does not imply implementation in the current release.

## 1) SAI Concept (V2 Option)

SAI is a friendly vocal coach and app guide for SAION, designed to help users understand the app and access singing support without taking control away from the user.

Current boundary:

1. Guidance and explanation only.
2. No generation on behalf of the user.
3. No tuning/correction automation.
4. No autonomous control of sonic or visual output.

## 2) Deferred Live Vocal FX Module (From ARLNS Spec)

Deferred to V2 milestone:

1. Browser-side preview chain: EQ, Filter, Compressor, Reverb, Delay.
2. Placement: compact module inside CONTROLS page.
3. Workflow intent: realtime audition while dialing, then external provider render for final-quality output.

## 3) Holographic Orb Internal Video Layer (V2 Candidate)

Candidate visual enhancement:

1. Add silent looping video as an inner sphere VideoTexture in the Holographic Orb Module.
2. Keep outer holographic globe shell intact.
3. Support short loops (2 to 5 seconds) and longer loops (up to 1 to 2 minutes or until user stops).
4. Pair with AI-driven Visualize workflow in V2 planning.

## 4) Mood System and Workflow Personalization (V2 Candidate)

Candidate UX enhancement:

1. Add mood presets so users can quickly switch visual and interaction style by session intent.
2. Mood presets can adjust UI palette, glow level, motion intensity, and dial sensitivity profile.
3. Allow users to save and reuse custom mood/workflow profiles (for example: Focus, Creative, Live Demo).
4. Keep accessibility guardrails for readability and reduced-motion preferences.

## 5) Notes For Planning Discipline

1. V2 options remain optional until explicitly scheduled.
2. Current release remains focused on test-only execution and stability.
3. Any V2 work should be scoped behind explicit roadmap approval.

## 6) Prioritization Aid

Use `docs/saion-next-steps/V2_PRIORITIZATION_MATRIX.md` to compare V2 options by impact, effort, risk, and strategic fit before scheduling implementation.

## Source Pointers

- ARLNS/spec/pnf-aims.spec.md (Version 2 Roadmap Note)
- docs/saion-next-steps/NEXT_STEPS_README.md
- /memories/repo/gui-v2-roadmap.md
