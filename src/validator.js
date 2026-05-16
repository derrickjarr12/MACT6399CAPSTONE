// validator_v1.js
// Validates token sequences from tokenizer_v1.js

function validateTokens(tokens) {
  const errors = [];
  const warnings = [];

  const lastNonCharIndex = (() => {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].type !== "CHAR") return i;
    }
    return -1;
  })();

  // 1) Phrase break *** should be at end (ignoring punctuation/CHAR)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === "PHRASE_BREAK") {
      if (i !== lastNonCharIndex) {
        errors.push({
          code: "PHRASE_BREAK_NOT_AT_END",
          message: "*** (PHRASE_BREAK) must appear at the end of a phrase/line.",
          index: i
        });
      }
    }
  }

  // 2) No back-to-back breaths (usually means accidental double marking)
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i - 1].type === "BREATH" && tokens[i].type === "BREATH") {
      warnings.push({
        code: "DOUBLE_BREATH",
        message: "Two breaths in a row found. Consider using only one ({b} or {B}).",
        index: i - 1
      });
    }
  }

  // 3) Syllable split "_" must be between WORDs (not at edges, not doubled)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === "SYLLABLE_SPLIT") {
      const prev = tokens[i - 1];
      const next = tokens[i + 1];

      if (!prev || !next) {
        errors.push({
          code: "DANGLING_SYLLABLE_SPLIT",
          message: "Underscore syllable split '_' cannot be at the start or end.",
          index: i
        });
        continue;
      }

      if (prev.type !== "WORD" || next.type !== "WORD") {
        errors.push({
          code: "SYLLABLE_SPLIT_NOT_BETWEEN_WORDS",
          message: "Underscore '_' must be placed between two WORD tokens (e.g., run_ning).",
          index: i
        });
      }

      if (next && next.type === "SYLLABLE_SPLIT") {
        errors.push({
          code: "DOUBLE_SYLLABLE_SPLIT",
          message: "Found '__' (two syllable splits in a row). Use a single underscore.",
          index: i
        });
      }
    }
  }

  // 4) Optional: warn if line has no WORD tokens (maybe user pasted only markers)
  const wordCount = tokens.filter(t => t.type === "WORD").length;
  const restCount = tokens.filter(t => t.type === "REST").length;
  if (wordCount === 0 && restCount === 0) {
    warnings.push({
      code: "NO_WORDS",
      message: "No WORD or REST tokens found. Did you paste only notation symbols?",
      index: 0
    });
  }

  // 5) SOFT phrases (^^phrase^^) must contain at least 2 words
  let softSequence = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === "WORD" && tokens[i].dynamic === "SOFT") {
      softSequence.push(i);
    } else if (softSequence.length > 0) {
      // End of SOFT sequence - check if it has only 1 word
      if (softSequence.length === 1) {
        errors.push({
          code: "SINGLE_WORD_SOFT_PHRASE",
          message: "SOFT phrases (^^phrase^^) must contain at least 2 words. Use ^word^ for single-word soft high instead.",
          index: softSequence[0]
        });
      }
      softSequence = [];
    }
  }
  // Check last sequence if it ends at the end of tokens
  if (softSequence.length === 1) {
    errors.push({
      code: "SINGLE_WORD_SOFT_PHRASE",
      message: "SOFT phrases (^^phrase^^) must contain at least 2 words. Use ^word^ for single-word soft high instead.",
      index: softSequence[0]
    });
  }

  // 6) SOFT_HIGH (^word^) should only appear once at a time, not consecutively
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].type === "WORD" && tokens[i].dynamic === "SOFT_HIGH" &&
        tokens[i - 1].type === "WORD" && tokens[i - 1].dynamic === "SOFT_HIGH") {
      warnings.push({
        code: "CONSECUTIVE_SOFT_HIGH",
        message: "Multiple SOFT_HIGH words in a row. Consider using ^^soft phrase^^ for multi-word sections.",
        index: i - 1
      });
    }
  }

  // 7) Check for unbalanced soft markers by detecting mode changes at end
  const lastWord = [...tokens].reverse().find(t => t.type === "WORD");
  if (lastWord && (lastWord.dynamic === "SOFT" || lastWord.dynamic === "SOFT_HIGH")) {
    // Check if the last words are in soft mode - might indicate unclosed markers
    const lastFewWords = tokens.filter(t => t.type === "WORD").slice(-3);
    const allSoft = lastFewWords.every(w => w.dynamic === "SOFT" || w.dynamic === "SOFT_HIGH");
    if (allSoft && tokens[tokens.length - 1].type !== "PHRASE_BREAK") {
      warnings.push({
        code: "POSSIBLE_UNCLOSED_SOFT",
        message: "Line ends in soft mode. Check if ^^ or ^ markers are properly closed.",
        index: tokens.length - 1
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
function attachPemToWords(tokens) {
  const out = [];
  let lastWordIndex = -1;

  for (const t of tokens) {
    if (t.type === "WORD") {
      if (!t.pem) t.pem = [];
      if (!t.dyn) t.dyn = []; // only if you keep DYN tokens
      out.push(t);
      lastWordIndex = out.length - 1;
      continue;
    }

    if (t.type === "PEM") {
      if (lastWordIndex >= 0) {
        const w = out[lastWordIndex];
        if (!w.pem) w.pem = [];
        if (!w.pem.includes(t.kind)) w.pem.push(t.kind);
      } else {
        out.push({ type: "LINE_PEM", kind: t.kind });
      }
      continue;
    }

    if (t.type === "DYN") {
      if (lastWordIndex >= 0) {
        const w = out[lastWordIndex];
        if (!w.dyn) w.dyn = [];
        if (!w.dyn.includes(t.kind)) w.dyn.push(t.kind);
      } else {
        out.push({ type: "LINE_DYN", kind: t.kind });
      }
      continue;
    }

    if (t.type === "TEXTURE") {
      if (lastWordIndex >= 0) {
        const w = out[lastWordIndex];
        w.texture = t.kind;
      } else {
        out.push({ type: "LINE_TEXTURE", kind: t.kind });
      }
      continue;
    }

    out.push(t);
  }
  return out; 
}


module.exports = { validateTokens, attachPemToWords };