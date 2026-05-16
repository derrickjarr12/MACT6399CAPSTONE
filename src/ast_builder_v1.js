// ast_builder_v1.js
// Builds a structured AST from text tokens.

const { tokenize } = require("./tokenizer_v1");
const { parseSectionHeader } = require("./metadata_parser_v1");
const { attachPemToWords } = require("./validator");
const { collectBarsItems } = require("./bars_validator");

function applyDynamicsToTokens(rawTokens, state) {
  const processed = [];

  for (const token of rawTokens) {
    if (token.type === "WORD") {
      let dynamic = "NORMAL";
      if (/^[A-Z]+$/.test(token.text)) {
        dynamic = "LOUD";
      } else if (state.softHighMode) {
        dynamic = "SOFT_HIGH";
      } else if (state.softMode) {
        dynamic = "SOFT";
      }

      processed.push({
        ...token,
        dynamic
      });
      continue;
    }

    processed.push(token);
  }

  return processed;
}

function updateSoftState(rawTokens, state) {
  let softMode = state.softMode;
  let softHighMode = state.softHighMode;

  for (const token of rawTokens) {
    if (token.type === "SOFT_MODE_TOGGLE") softMode = !softMode;
    if (token.type === "SOFT_HIGH_TOGGLE") softHighMode = !softHighMode;
  }

  return { softMode, softHighMode };
}

function groupIntoPhrases(tokens) {
  const phrases = [];
  let currentPhrase = [];

  for (const token of tokens) {
    if (token.type === "PHRASE_BREAK") {
      if (currentPhrase.length > 0) {
        phrases.push({
          type: "PHRASE",
          tokens: currentPhrase
        });
        currentPhrase = [];
      }
      continue;
    }

    currentPhrase.push(token);
  }

  if (currentPhrase.length > 0) {
    phrases.push({
      type: "PHRASE",
      tokens: currentPhrase
    });
  }

  return phrases;
}

function buildWordsFromTokens(tokensWithAttachments) {
  const words = [];
  const lineTextures = [];

  for (const token of tokensWithAttachments) {
    if (token.type === "WORD") {
      words.push({
        text: token.text,
        dynamic: token.dynamic ?? "NORMAL",
        pem: token.pem ?? [],
        dyn: token.dyn ?? [],
        texture: token.texture ?? null
      });
      continue;
    }

    if (token.type === "LINE_TEXTURE") {
      lineTextures.push(token.kind);
    }
  }

  return { words, lineTextures };
}

function buildSong(text) {
  const lines = text.split("\n");
  const sections = [];
  const documentTokens = [];
  const tokenLocations = [];

  let currentSection = null;
  let state = { softMode: false, softHighMode: false };

  function ensureSection(name) {
    if (!currentSection) {
      currentSection = {
        type: "SECTION",
        name,
        lines: []
      };
    }
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    const trimmedLine = rawLine.trim();

    if (trimmedLine === "") {
      ensureSection(currentSection?.name ?? "DEFAULT");
      currentSection.lines.push({ type: "BLANK", raw: rawLine });
      continue;
    }

    const sectionHeader = parseSectionHeader(trimmedLine);
    if (sectionHeader.isSection) {
      documentTokens.push({ type: "SECTION_TAG", text: sectionHeader.name });
      tokenLocations.push({
        lineIndex,
        sectionName: sectionHeader.name
      });

      if (currentSection) sections.push(currentSection);
      currentSection = {
        type: "SECTION",
        name: sectionHeader.name,
        metadata: sectionHeader.metadata,
        metaErrors: sectionHeader.errors,
        rawHeader: rawLine,
        lines: []
      };
      continue;
    }

    const rawTokens = tokenize(rawLine);

    for (const token of rawTokens) {
      documentTokens.push(token);
      tokenLocations.push({
        lineIndex,
        sectionName: currentSection?.name ?? "DEFAULT"
      });
    }

    ensureSection(currentSection?.name ?? "DEFAULT");

    const processedTokens = applyDynamicsToTokens(rawTokens, state);
    state = updateSoftState(rawTokens, state);

    const tokensWithAttachments = attachPemToWords(processedTokens);
    const { words, lineTextures } = buildWordsFromTokens(tokensWithAttachments);
    const bars = collectBarsItems(processedTokens);
    const phrases = groupIntoPhrases(processedTokens);

    currentSection.lines.push({
      type: "LINE",
      raw: rawLine,
      tokens: processedTokens,
      tokensWithAttachments,
      words,
      bars,
      phrases,
      lineTextures
    });
  }

  if (currentSection) sections.push(currentSection);

  return {
    song: {
      type: "SONG",
      sections
    },
    documentTokens,
    tokenLocations
  };
}

module.exports = {
  buildSong
};
