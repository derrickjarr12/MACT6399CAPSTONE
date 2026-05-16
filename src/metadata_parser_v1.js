// metadata_parser_v1.js
// PNF-AIMS Layer 1 — Section Metadata Parser
// Parses and validates metadata attached to section headers.
//
// Header format:
//   [SECTION_NAME]: KEY:value KEY:value ...
//
// Supported fields:
//   BPM    — integer 60–240
//   TSIG   — 2/2 | 2/4 | 3/4 | 4/4 | 5/4 | 6/8 | 12/8
//   KEY    — chromatic key name, e.g. C, Am, F#, Bbm
//   MODE   — MAJOR | MINOR
//   INST   — orchestral family or free-form name (string)
//   VOL    — integer 0–100
//   RHYTHM — hyphen-separated note values (WHOLE|HALF|QUARTER|EIGHTH|SIXTEENTH)

// --- Constants -----------------------------------------------------------

const VALID_TSIG = new Set(['2/2', '2/4', '3/4', '4/4', '5/4', '6/8', '12/8']);

const VALID_MODE = new Set(['MAJOR', 'MINOR']);

const VALID_NOTE_VALUES = new Set(['WHOLE', 'HALF', 'QUARTER', 'EIGHTH', 'SIXTEENTH']);

const ORCHESTRAL_FAMILIES = new Set([
  'STRINGS', 'WOODWINDS', 'BRASS', 'PERCUSSION', 'KEYS'
]);

// Regex to detect a section header line with optional metadata
// Matches: [VERSE]: BPM:90 ... or [CHORUS] (no metadata)
const SECTION_META_RE = /^\[([A-Za-z0-9\/\- ]+)\](?::\s*(.*))?$/;

// Key pattern: letter, optional sharp/flat, optional 'm' for minor
const KEY_RE = /^[A-Ga-g][#b]?m?$/;

// --- Helpers -------------------------------------------------------------

function parseRhythm(value) {
  const parts = value.split('-');
  const invalid = parts.filter(p => !VALID_NOTE_VALUES.has(p.toUpperCase()));
  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Invalid note value(s) in RHYTHM: ${invalid.join(', ')}. ` +
             `Allowed: WHOLE, HALF, QUARTER, EIGHTH, SIXTEENTH`
    };
  }
  return { ok: true, value: parts.map(p => p.toUpperCase()) };
}

// --- Core API ------------------------------------------------------------

/**
 * Detect whether a line is a section header (with or without metadata).
 * Returns { isSection: true, name, rawMeta } or { isSection: false }.
 */
function detectSectionHeader(line) {
  const match = line.trim().match(SECTION_META_RE);
  if (!match) return { isSection: false };
  return {
    isSection: true,
    name: match[1].trim(),
    rawMeta: (match[2] || '').trim()
  };
}

/**
 * Parse and validate a raw metadata string (the part after `[SECTION]:`).
 * Returns { metadata, errors }
 *
 * metadata — object with parsed, validated fields (only fields that were present)
 * errors   — array of { field, value, message } objects (empty if all valid)
 */
function parseMetadata(rawMeta) {
  const metadata = {};
  const errors = [];

  if (!rawMeta || !rawMeta.trim()) {
    return { metadata, errors };
  }

  // Split on whitespace boundaries between KEY:value pairs.
  // A pair is anything matching WORD:non-space
  const pairRE = /([A-Z]+):([^\s]+)/g;
  const found = new Set();
  let match;

  while ((match = pairRE.exec(rawMeta)) !== null) {
    const field = match[1].toUpperCase();
    const value = match[2];
    found.add(field);

    switch (field) {
      case 'BPM': {
        const n = parseInt(value, 10);
        if (isNaN(n) || String(n) !== value || n < 60 || n > 240) {
          errors.push({ field, value, message: `BPM must be an integer between 60 and 240. Got: ${value}` });
        } else {
          metadata.bpm = n;
        }
        break;
      }

      case 'TSIG': {
        if (!VALID_TSIG.has(value)) {
          errors.push({ field, value, message: `TSIG must be one of: ${[...VALID_TSIG].join(', ')}. Got: ${value}` });
        } else {
          metadata.tsig = value;
        }
        break;
      }

      case 'KEY': {
        if (!KEY_RE.test(value)) {
          errors.push({ field, value, message: `KEY must be a chromatic key name (e.g. C, Am, F#, Bbm). Got: ${value}` });
        } else {
          // Normalize: uppercase letter, keep # or b, lowercase m
          const norm = value.slice(0, 1).toUpperCase() +
                       value.slice(1).replace(/M$/, 'm');
          metadata.key = norm;
        }
        break;
      }

      case 'MODE': {
        const upper = value.toUpperCase();
        if (!VALID_MODE.has(upper)) {
          errors.push({ field, value, message: `MODE must be MAJOR or MINOR. Got: ${value}` });
        } else {
          metadata.mode = upper;
        }
        break;
      }

      case 'INST': {
        const upper = value.toUpperCase();
        metadata.inst = upper;
        metadata.instIsFamily = ORCHESTRAL_FAMILIES.has(upper);
        break;
      }

      case 'VOL': {
        const n = parseInt(value, 10);
        if (isNaN(n) || String(n) !== value || n < 0 || n > 100) {
          errors.push({ field, value, message: `VOL must be an integer between 0 and 100. Got: ${value}` });
        } else {
          metadata.vol = n;
        }
        break;
      }

      case 'RHYTHM': {
        const result = parseRhythm(value);
        if (!result.ok) {
          errors.push({ field, value, message: result.error });
        } else {
          metadata.rhythm = result.value;
        }
        break;
      }

      default: {
        errors.push({ field, value, message: `Unknown metadata field: ${field}` });
        break;
      }
    }
  }

  return { metadata, errors };
}

/**
 * Convenience: parse a full section header line.
 * Returns { isSection, name, metadata, errors } or { isSection: false }.
 */
function parseSectionHeader(line) {
  const detected = detectSectionHeader(line);
  if (!detected.isSection) return { isSection: false };

  const { metadata, errors } = parseMetadata(detected.rawMeta);
  return {
    isSection: true,
    name: detected.name,
    metadata,
    errors
  };
}

module.exports = {
  detectSectionHeader,
  parseMetadata,
  parseSectionHeader,
  ORCHESTRAL_FAMILIES,
  VALID_TSIG,
  VALID_MODE,
  VALID_NOTE_VALUES
};
