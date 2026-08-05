# SAION Beginnings And Technical Origins

## Scope

This file captures the earliest documented foundations of SAION by tracing ARLNS and PNF-AIMS source documentation that informed the product's first technical direction.

## Source Of Truth

1. ARLNS documentation index and authority order:
- [ARLNS/README.md](../../ARLNS/README.md)

2. Primary PNF-AIMS working spec:
- [ARLNS/spec/pnf-aims.spec.md](../../ARLNS/spec/pnf-aims.spec.md)

3. Provider integration contract:
- [ARLNS/spec/provider-contract-v1.md](../../ARLNS/spec/provider-contract-v1.md)

4. Historical baseline spec:
- [ARLNS/spec/ARLNS-SPEC-v0.1.md](../../ARLNS/spec/ARLNS-SPEC-v0.1.md)

## Early Product Framing

1. PNF-AIMS was defined as the broader prompt and notation framework.
2. ARLNS was defined as the vocalist-performance notation layer inside PNF-AIMS.
3. This separation established how song-level context and lyric-level vocal expression should coexist without semantic collisions.

## Early Technical Architecture Signals

1. Two-layer model:
- Section metadata layer for arrangement context (BPM, key, instrumentation, timing).
- Vocal performance layer for delivery/texture/cadence/breath markers.

2. Tokenized notation system:
- Delivery, phrasing, cadence, and texture token families were explicitly specified.
- Rhythmic rest tokens were mapped for notation-level timing intent.

3. Provider and request model:
- Provider-specific jobId tracking remained distinct from internal requestId.
- This enabled unified app-level continuity across providers.

4. Persistence and restart continuity:
- Request records were designed for optional MySQL persistence.
- Frontend flow retained requestId for reconnect and compare-session continuity after restarts.

## Repository Note

A separate top-level PNF-AIMS folder is not present in this repository. PNF-AIMS documentation appears under ARLNS/spec and related ARLNS index files.
