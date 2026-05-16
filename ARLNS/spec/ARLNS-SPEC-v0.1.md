# ARLNS v0.1 — Experimental Baseline Spec

## Status

This file preserves the early experimental ARLNS baseline.

It is intentionally kept as a historical reference, not the authoritative day-to-day instruction set. The current authoring guide lives in [README](../README).

## Purpose

The original v0.1 goal was to influence AI vocal rhythm, stress, phrasing, and silence using compact text notation.

## Original Experimental Symbols

`...` = held pause or late entrance  
`—` = phrase break, not sentence punctuation  
`( )` = internal or softer delivery  
`CAPS` = stress target, max two per line  
`/` = syllable separation, used sparingly

## Style Constraints

- Phrase-led, not bar-led
- Silence is meaningful
- Do not over-sing
- One emotional intent per line

## Testing Rules

- Same lyrics, same prompt, same genre
- Only notation may change
- Compare delivery, not melody quality

## Migration Notes To Current ARLNS

- `CAPS` remains valid as loud or projected delivery.
- v0.1 slash-based syllable separation was replaced by `_` to avoid collision with newer cadence markers.
- Phrase shaping is now handled more explicitly through PEM and DYN symbols.
- Current ARLNS treats cadence, breath, phrasing, and elasticity as first-class parseable tokens.

## Current Conceptual Boundary

PNF-AIMS is implemented through ARLNS, which defines the symbolic vocabulary and syntax used to encode vocal performance intent.

ARLNS describes how the singer delivers the line. Song-body metadata such as BPM, KEY, INST, or arrangement texture belongs in a separate contextual layer and is not part of the original ARLNS token vocabulary.

## PEM Note

PEM means Phrase Elasticity Marker.
These affect timing shape, not volume or intensity.
