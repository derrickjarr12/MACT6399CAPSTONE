// bars_validator.js
// Adds bar-length validation to your existing validator pipeline.
//
// Expected token shapes (supports a few):
// 1) { type: "BARS", bars: 8 }                         // preferred
// 2) { type: "BARS", value: 8 }
// 3) { type: "BARS", text: "||B:8||" }               // parsed from text
// 4) Tokenizer v1 sequences like: "||B:8||" or "B:8"
//    -> CHAR "|", CHAR "|", WORD "B", CHAR ":", CHAR "8", CHAR "|", CHAR "|"
//
// SECTION boundaries are detected via: { type: "SECTION_TAG", text: "Verse" } etc.

const BARS_ANCHORS = new Set([4, 8, 16]);     // you can add 32 later if you want
const BARS_MODIFIERS = new Set([1, 2, 12]);
const BARS_ALLOWED = new Set([...BARS_ANCHORS, ...BARS_MODIFIERS]);

function parseBarsFromToken(t) {
  // Preferred explicit numeric fields
  const n = t?.bars ?? t?.value ?? t?.count;
  if (Number.isInteger(n)) return n;

  // Parse from text form: ||B:8|| or B:8
  const s = (t?.text ?? t?.raw ?? "").toString();
  const m = s.match(/(?:\|\||∥)?\s*B\s*:\s*(\d+)\s*(?:\|\||∥)?/i);
  if (m) return parseInt(m[1], 10);

  return null;
}

function isBarsToken(t) {
  if (!t) return false;
  if (t.type === "BARS" || t.type === "BARS_TAG" || t.type === "BAR_TAG") return true;

  // Fallback: detect embedded bars tag in text
  const s = (t.text ?? "").toString();
  return /(?:\|\||∥)?\s*B\s*:\s*\d+\s*(?:\|\||∥)?/i.test(s);
}

function getTokenText(t) {
  return (t?.text ?? t?.raw ?? "").toString();
}

function isBarChar(t) {
  if (!t || t.type !== "CHAR") return false;
  const s = getTokenText(t);
  return s === "|" || s === "∥";
}

function isBToken(t) {
  if (!t || (t.type !== "WORD" && t.type !== "CHAR")) return false;
  return /^[Bb]$/.test(getTokenText(t));
}

function isColonToken(t) {
  return t?.type === "CHAR" && getTokenText(t) === ":";
}

function isDigitToken(t) {
  return t?.type === "CHAR" && /^[0-9]$/.test(getTokenText(t));
}

function parseBarsSequence(tokens, startIndex) {
  let i = startIndex;
  let leadingBars = 0;

  while (leadingBars < 2 && isBarChar(tokens[i])) {
    leadingBars += 1;
    i += 1;
  }

  if (!isBToken(tokens[i])) return null;
  i += 1;

  if (!isColonToken(tokens[i])) return null;
  i += 1;

  let digits = "";
  while (isDigitToken(tokens[i])) {
    digits += getTokenText(tokens[i]);
    i += 1;
  }

  if (digits.length === 0) return null;

  let trailingBars = 0;
  while (trailingBars < 2 && isBarChar(tokens[i])) {
    trailingBars += 1;
    i += 1;
  }

  return {
    bars: parseInt(digits, 10),
    startIndex,
    endIndex: i - 1,
    consumed: i - startIndex
  };
}

function collectBarsItems(tokens) {
  const items = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t?.type === "BARS_FS") {
      items.push({ index: i, bars: 1, token: t, kind: "FADE_SPACE" });
      continue;
    }

    if (isBarsToken(t)) {
      items.push({ index: i, bars: parseBarsFromToken(t), token: t });
      continue;
    }

    const seq = parseBarsSequence(tokens, i);
    if (seq) {
      items.push({ index: seq.startIndex, bars: seq.bars, token: null });
      i += Math.max(seq.consumed - 1, 0);
    }
  }

  return items;
}


function validateBars(tokens, { allowModifierChain = false } = {}) {
  const errors = [];
  const warnings = [];

  // Split into sections by SECTION_TAG (or treat whole song as one section)
  const sections = [];
  let current = { name: "GLOBAL", startIndex: 0, items: [] };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t?.type === "SECTION_TAG") {
      // close previous section
      if (current.items.length || current.startIndex !== i) sections.push(current);
      current = { name: t.text ?? "SECTION", startIndex: i, items: [] };
      continue;
    }

    if (t?.type === "BARS_FS") {
      current.items.push({ index: i, bars: 1, token: t, isFadeSpace: true });
      continue;
    }

    if (isBarsToken(t)) {
      const bars = parseBarsFromToken(t);
      current.items.push({ index: i, bars, token: t });
      continue;
    }

    const seq = parseBarsSequence(tokens, i);
    if (seq) {
      current.items.push({ index: seq.startIndex, bars: seq.bars, token: null });
      i += Math.max(seq.consumed - 1, 0);
    }
  }
  sections.push(current);

  // 1) Validate format + allowed values
  for (const sec of sections) {
    for (const it of sec.items) {
      const { index, bars } = it;

      if (!Number.isInteger(bars) || bars <= 0) {
        errors.push({
          code: "BARS_INVALID_FORMAT",
          message: "Bars tag must contain a positive integer, like ||B:8||.",
          index
        });
        continue;
      }

      if (!BARS_ALLOWED.has(bars)) {
        errors.push({
          code: "BARS_NOT_ALLOWED_VALUE",
          message: `Bars value ${bars} is not allowed. Use anchors (4, 8, 16) or modifiers (1, 2, 12).`,
          index
        });
      }
    }
  }

  // 2) Section rule: must contain at least one anchor if it contains any bars tags
  // 3) Modifiers must attach to an anchor (immediately before or after)
  // 4) Optional: disallow modifier chains > 1 (except B:1 + B:1 next to anchor)
  for (const sec of sections) {
    const items = sec.items.filter(it => Number.isInteger(it.bars) && it.bars > 0 && !it.isFadeSpace);

    if (items.length === 0) continue;

    const hasAnchor = items.some(it => BARS_ANCHORS.has(it.bars));
    if (!hasAnchor) {
      errors.push({
        code: "BARS_SECTION_MISSING_ANCHOR",
        message: `Section ${sec.name} includes bar tags but no anchor (4/8/16). Add an anchor so modifiers (1/2/12) don’t float.`,
        index: sec.startIndex
      });
    }

    // Modifier attachment + chain checks
    for (let k = 0; k < items.length; k++) {
      const it = items[k];

      if (it.isFadeSpace) continue;
      if (!BARS_MODIFIERS.has(it.bars)) continue;

      const prev = items[k - 1];
      const next = items[k + 1];

      const touchesAnchor =
        (prev && prev.index === it.index - 1 && BARS_ANCHORS.has(prev.bars)) ||
        (next && next.index === it.index + 1 && BARS_ANCHORS.has(next.bars));

      const prevIsMod = prev && prev.index === it.index - 1 && BARS_MODIFIERS.has(prev.bars);
      const nextIsMod = next && next.index === it.index + 1 && BARS_MODIFIERS.has(next.bars);
      const isOneBar = it.bars === 1;
      const prevIsOneBar = prevIsMod && prev.bars === 1;
      const nextIsOneBar = nextIsMod && next.bars === 1;
      const isTwoOneBarChain = isOneBar && ((prevIsOneBar && !nextIsOneBar) || (nextIsOneBar && !prevIsOneBar));
      const chainTouchesAnchor =
        (prevIsOneBar && items[k - 2] && items[k - 2].index === prev.index - 1 && BARS_ANCHORS.has(items[k - 2].bars)) ||
        (nextIsOneBar && items[k + 2] && items[k + 2].index === next.index + 1 && BARS_ANCHORS.has(items[k + 2].bars));
      const oneBarChainAllowed = isTwoOneBarChain && chainTouchesAnchor;

      if (!touchesAnchor && !oneBarChainAllowed) {
        errors.push({
          code: "BARS_MODIFIER_FLOATING",
          message: `Modifier ||B:${it.bars}|| must be immediately before or after an anchor (4/8/16).`,
          index: it.index
        });
      }

      if (!allowModifierChain) {
        if ((prevIsMod || nextIsMod) && !oneBarChainAllowed) {
          errors.push({
            code: "BARS_MODIFIER_CHAIN_TOO_LONG",
            message: "Avoid stacking multiple modifiers in a row (e.g., ||B:1|| ||B:2||). Attach a single modifier to an anchor.",
            index: it.index
          });
        }
      }

      // Optional style warning: 12 bars outside of genre context
      if (it.bars === 12) {
        warnings.push({
          code: "BARS_12_OUTSIDE_GENRE_CONTEXT",
          message: "||B:12|| is genre-specific (e.g., blues/neo-soul). If unintended, consider 8 or 16.",
          index: it.index
        });
      }
    }

    // Optional: too many changes warning (section feels chopped)
    if (items.length >= 6) {
      warnings.push({
        code: "BARS_TOO_MANY_CHANGES",
        message: `Section ${sec.name} has many bar-length tags; consider simplifying to fewer anchors/modifiers.`,
        index: sec.startIndex
      });
    }
  }

  return { errors, warnings };
}

// ---- Example integration into your existing validateTokens(tokens) ----
//
// function validateTokens(tokens) {
//   const errors = [];
//   const warnings = [];
//
//   // ... your existing rules ...
//
//   const barsResult = validateBars(tokens, { allowModifierChain: false });
//   errors.push(...barsResult.errors);
//   warnings.push(...barsResult.warnings);
//
//   return { errors, warnings };
// }

module.exports = {
  validateBars,
  collectBarsItems,
  BARS_ALLOWED,
  BARS_ANCHORS,
  BARS_MODIFIERS
};
