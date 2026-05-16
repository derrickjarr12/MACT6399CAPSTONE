# PNF-AIMS Specification

## Purpose

PNF-AIMS is the broader prompt and notation framework. ARLNS is the vocalist-performance language inside that framework.

This distinction matters:

- PNF-AIMS may carry section-level song context.
- ARLNS carries singer delivery instructions inside the lyric body.

## Two-Layer Model

### 1. Song-Body Metadata Layer

This layer describes the section as a musical environment.

Examples:

- `BPM:90`
- `KEY:CM`
- `INST:GUITAR`
- `VOL:60`
- `TSIG:4/4`

These values describe the section, arrangement, or production context. They do not directly instruct the vocalist how to shape a specific word.

Example:

```text
[VERSE]: BPM:90 KEY:CM INST:GUITAR VOL:60
```

### 2. Vocal Performance Layer (ARLNS)

This layer describes how the vocalist delivers the lyric inside the section.

**Delivery and Expression:**
- `^^soft^^` soft delivery span
- `{b}` quick breath
- `***` phrase break
- `~>` elongate
- `>>` compress
- `<` soften
- `>` push
- `\` fall cadence
- `/~` rise with trail

**Texture (Vocal Character):**
- `T:raspy`, `T:airy`, `T:warm`, etc.

**Notation Events (Rhythmic):**
- `R:w`, `R:h`, `R:q`, `R:e`, `R:s` (rests)

Example:

```text
[VERSE]: BPM:90 KEY:CM INST:GUITAR VOL:60
^^hold^^ me close {b} tonight \~ R:q
I feel T:raspy and T:warm
```

In that example:

- `BPM:90 KEY:CM INST:GUITAR VOL:60` describes the section (metadata).
- `^^hold^^ me close {b} tonight \~` describes emotional delivery and phrasing (performance).
- `R:q` represents a quarter rest (notation event).
- `T:raspy` and `T:warm` describe vocal timbre (texture).

## Why The Separation Exists

- Song-body metadata is section-scoped.
- Vocal notation is lyric-scoped.
- Metadata should not change the meaning of vocalist tokens.
- Vocal tokens should remain portable even if the instrumentation changes.

If a verse moves from piano to guitar, the lyric delivery notation should still mean the same thing.

## ARLNS Token Families Used In PNF-AIMS

### Structural

- Section tags such as `[VERSE]`

### Vocal Delivery

- `ALL CAPS` for stronger projection
- `^^...^^` for soft spans
- `^...^` for soft-high spans

### Breath And Phrasing

- `{b}` quick inhale
- `{B}` phrase reset inhale
- `***` phrase break
- `_` syllable split

### Elasticity And Expression

- `~>` elongate
- `>>` compress
- `~|` spill
- `x` cut
- `<` soften
- `>` push
- `~` breathy
- `!` emphasis

### Cadence

- `\` fall
- `\\` strong fall
- `\~` falling trail
- `/` rise
- `//` strong rise
- `/~` rising trail

### Texture And Vocal Character

- `T:raspy` coarse, grainy quality
- `T:airy` breathy, hollow, light quality
- `T:crisp` sharp, defined, precise quality
- `T:sharp` cutting, bright edge
- `T:hollow` empty, echoing quality
- `T:resonant` rich, full-bodied quality
- `T:smooth` flowing, connected delivery
- `T:rough` raw, unpolished quality
- `T:warm` round, embracing tone
- `T:bright` shiny, forward, open quality
- `T:dark` low, covered, introspective tone

### Notation Events (Rhythmic Content)

- `R:w` whole rest
- `R:h` half rest
- `R:q` quarter rest
- `R:e` eighth rest
- `R:s` sixteenth rest

## Implementation Guidance

- Keep ARLNS parsing independent from section metadata parsing.
- Section metadata can be stored as attributes on a section node.
- Vocal tokens should remain line-level or word-level parser concerns.
- Do not overload vocal markers to carry arrangement meaning.
- Texture tokens are word-scoped and describe vocal timbre, not emotional delivery.
- Textures apply to the immediately preceding word; if no word precedes, treat as line-level notation.

## Texture Scope And Philosophy

Texture describes **how the voice sounds**, independent of emotional delivery (performance markers).

- Performance markers (`>`, `<`, `!`, `~`, etc.) shape how the lyric is delivered emotionally.
- Texture markers (`T:`) describe the sonic character of that delivery.
- A word can have both: `love> T:warm` means "lean in emotionally with a warm tone."

Examples:

```text
I feel T:raspy today
I sing T:warm and T:bright
whisper< T:airy into the night
```

Texture is orthogonal to dynamics, phrasing, and cadence—it stacks with them.

## Minimal Demonstration Scope

PNF-AIMS does not need a full instrumentation language to prove the concept.

A minimal demonstration is enough if it shows:

- section-level metadata can be attached to a section
- ARLNS still parses vocalist notation normally inside the section
- the two layers do not conflict semantically
