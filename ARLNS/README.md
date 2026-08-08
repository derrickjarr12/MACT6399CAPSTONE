# ARLNS Documentation and Spec Index

This file is the canonical index for ARLNS and PNF-AIMS specification documents used in this repository.

## Purpose

Use this guide to find the right spec quickly and understand which document is authoritative for implementation work.

## Spec Documents

1. `spec/pnf-aims.spec.md`
- Primary working specification for PNF-AIMS and ARLNS behavior.
- Includes notation semantics, parsing intent, provider routing notes, and current roadmap constraints.

2. `spec/provider-contract-v1.md`
- Canonical provider integration contract.
- Defines normalized request/response shape, adapter operations, persistence requirements, and callback expectations.

3. `spec/ARLNS-SPEC-v0.1.md`
- Historical experimental baseline.
- Keep for reference and backward context only.

## Authority Order

When documents disagree, follow this order:

1. `spec/provider-contract-v1.md` for provider integration behavior.
2. `spec/pnf-aims.spec.md` for notation and product-level workflow behavior.
3. `spec/ARLNS-SPEC-v0.1.md` for historical context only.

## Related Implementation Files

- Parser and pipeline:
  - `../src/parser_v1.js`
  - `../src/pipeline_v1.js`
  - `../src/provider_contract_v1.js`

- Runtime:
  - `../src/index.js`
  - `../src/config/validate-startup.js`

- Baseline compatibility test:
  - `compat_baseline_v1.test.js`

- Example prompts:
  - `examples/test-01-plain.txt`
  - `examples/test-01-ai-ready.txt`

## Change Process

- Update specs first, then implementation.
- Keep backward compatibility notes in the spec when token semantics change.
- Add a short dated note in the updated spec section for behavior-impacting changes.

## Notes

- ARLNS is the vocalist-performance notation layer.
- PNF-AIMS is the broader framework that can include section-level song metadata around ARLNS content.
