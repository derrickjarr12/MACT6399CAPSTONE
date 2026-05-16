// tokenizer_v1.js
// Lyric Performance Control – v1 Tokenizer

const VALID_TEXTURES = new Set([
  'raspy', 'airy', 'crisp', 'sharp', 'hollow', 'resonant',
  'smooth', 'rough', 'warm', 'bright', 'dark'
]);

const TOKEN_REGEX =
  /(\{B\}|\{b\})|(B1FS)|(R:[whqesWHQES])|(T:[a-zA-Z]+)|(~>|>>|~\|)|(\*\*\*)|(\^\^)|(\^)|(_)|([A-Z]+(?:~>|>>|~\||x|<|>|~|!)*)|([a-zA-Z']+(?:~>|>>|~\||x|<|>|~|!)*)|(\\~|\\\\|\\|\/\/|\/~|\/)|([^\s])/g;

function tokenize(line) {
  const tokens = [];

  function splitSuffixMarkers(raw) {
    // Recognize ONLY at the end of the token
    // Order matters: 2-char markers first
    const pem2 = ["~>", ">>", "~|"];
    const dyn1 = ["<", ">", "~", "!"];

    let base = raw;
    const suffixTokens = [];

    // Keep peeling markers from the end
    while (base.length > 0) {
      const last2 = base.slice(-2);
      const last1 = base.slice(-1);

      if (pem2.includes(last2)) {
        suffixTokens.unshift({ type: "PEM_RAW", text: last2 });
        base = base.slice(0, -2);
        continue;
      }

      // CUT x only if it's the last char AND looks like a marker
      if (last1 === "x") {
        suffixTokens.unshift({ type: "PEM_RAW", text: "x" });
        base = base.slice(0, -1);
        continue;
      }

      if (dyn1.includes(last1)) {
        suffixTokens.unshift({ type: "DYN_RAW", text: last1 });
        base = base.slice(0, -1);
        continue;
      }

      break;
    }

    return { base, suffixTokens };
  }

  function normalizeMarkerToken(t) {
    if (t.type === "PEM_RAW") {
      const pemMap = { "~>": "ELONGATE", ">>": "COMPRESS", "~|": "SPILL", "x": "CUT" };
      return { type: "PEM", kind: pemMap[t.text] };
    }
    if (t.type === "DYN_RAW") {
      const dynMap = { "<": "SOFTEN", ">": "PUSH", "~": "BREATHY", "!": "EMPHASIS" };
      return { type: "DYN", kind: dynMap[t.text] };
    }
    return t;
  }

  // Check for section tags
  const trimmed = line.trim();
  if (/^\[[A-Za-z0-9\/\- ]+\]$/.test(trimmed)) {
    return [{
      type: "SECTION_TAG",
      text: trimmed.slice(1, -1)
    }];
  }

  const matches = line.matchAll(TOKEN_REGEX);

  for (const match of matches) {
    const raw = match[0];

    // Cadence markers — must check BEFORE splitSuffixMarkers,
    // which would otherwise strip trailing ~ off \~ and /~
    const cadenceMap = {
      '\\~':  'FALL_TRAIL',
      '\\\\': 'FALL_STRONG',
      '\\':   'FALL',
      '//':   'RISE_STRONG',
      '/~':   'RISE_TRAIL',
      '/':    'RISE'
    };
    if (cadenceMap[raw] !== undefined) {
      tokens.push({ type: 'CADENCE', kind: cadenceMap[raw] });
      continue;
    }

    // Rest tokens: R:w | R:h | R:q | R:e | R:s
    if (/^R:[whqes]$/i.test(raw)) {
      const durationCode = raw.slice(2).toLowerCase();
      const durationMap = {
        w: "WHOLE",
        h: "HALF",
        q: "QUARTER",
        e: "EIGHTH",
        s: "SIXTEENTH"
      };

      tokens.push({
        type: "REST",
        duration: durationCode,
        value: durationMap[durationCode]
      });
      continue;
    }

    // Texture tokens: T:raspy | T:airy | T:crisp etc
    if (/^T:([a-zA-Z]+)$/i.test(raw)) {
      const textureCode = raw.slice(2).toLowerCase();
      if (VALID_TEXTURES.has(textureCode)) {
        tokens.push({
          type: "TEXTURE",
          kind: textureCode
        });
        continue;
      } else {
        // Invalid texture, treat as CHAR
        tokens.push({ type: "CHAR", text: raw });
        continue;
      }
    }

    // Peel suffix markers like "lie~><" into WORD + PEM/DYN tokens
    const { base, suffixTokens } = splitSuffixMarkers(raw);
    if (base !== raw) {
      if (base.length > 0) {
        // Emit word without dynamic assignment - parser will handle it
        tokens.push({ type: "WORD", text: base });
      }
      for (const st of suffixTokens) tokens.push(normalizeMarkerToken(st));
      continue;
    }

    // Breath
    if (raw === "{b}") {
      tokens.push({ type: "BREATH", size: "small" });
      continue;
    }
    if (raw === "{B}") {
      tokens.push({ type: "BREATH", size: "large" });
      continue;
    }

    // Fade/space 1-bar tag
    if (raw === "B1FS") {
      tokens.push({ type: "BARS_FS", bars: 1, kind: "FADE_SPACE" });
      continue;
    }

    // Standalone PEM markers
    if (raw === "~>") { tokens.push({ type: "PEM", kind: "ELONGATE" }); continue; }
    if (raw === ">>") { tokens.push({ type: "PEM", kind: "COMPRESS" }); continue; }
    if (raw === "~|") { tokens.push({ type: "PEM", kind: "SPILL" }); continue; }
    if (raw === "x")  { tokens.push({ type: "PEM", kind: "CUT" }); continue; }

    // Phrase break
    if (raw === "***") {
      tokens.push({ type: "PHRASE_BREAK" });
      continue;
    }

    // Soft phrase marker (^^phrase^^)
    if (raw === "^^") {
      tokens.push({ type: "SOFT_MODE_TOGGLE" });
      continue;
    }

    // Soft high marker (^word^)
    if (raw === "^") {
      tokens.push({ type: "SOFT_HIGH_TOGGLE" });
      continue;
    }

    // Syllable split marker
    if (raw === "_") {
      tokens.push({ type: "SYLLABLE_SPLIT" });
      continue;
    }

    // Word tokens (ALL CAPS or normal)
    if (/^[a-zA-Z']+$/.test(raw)) {
      tokens.push({
        type: "WORD",
        text: raw
      });
      continue;
    }

    // Punctuation / misc
    tokens.push({ type: "CHAR", text: raw });
  }

  return tokens;
}

module.exports = { tokenize, VALID_TEXTURES };



