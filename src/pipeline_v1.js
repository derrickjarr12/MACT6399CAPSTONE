// pipeline_v1.js
// End-to-end pipeline: tokenize -> validate -> build AST -> render.

const { buildSong } = require("./ast_builder_v1");
const { validateTokens, attachPemToWords } = require("./validator");
const { validateBars } = require("./bars_validator");
const { renderSong } = require("./renderer_v1");

function validateText(text) {
  const { song, documentTokens, tokenLocations } = buildSong(text);
  const errors = [];
  const warnings = [];

  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.type !== "LINE") continue;

      const report = validateTokens(line.tokens);
      for (const err of report.errors) {
        errors.push({
          ...err,
          section: section.name,
          line: line.raw
        });
      }
      for (const warn of report.warnings) {
        warnings.push({
          ...warn,
          section: section.name,
          line: line.raw
        });
      }

      const attached = attachPemToWords(line.tokens);
      for (const token of attached) {
        if (token.type === "LINE_PEM") {
          errors.push({
            code: "PEM_FLOATING",
            message: `PEM ${token.kind} has no word to attach to.`,
            section: section.name,
            line: line.raw
          });
        }
        if (token.type === "LINE_DYN") {
          errors.push({
            code: "DYN_FLOATING",
            message: `DYN ${token.kind} has no word to attach to.`,
            section: section.name,
            line: line.raw
          });
        }
      }
    }
  }

  const barsReport = validateBars(documentTokens);
  for (const err of barsReport.errors) {
    const loc = tokenLocations[err.index] || {};
    errors.push({
      ...err,
      section: loc.sectionName,
      lineIndex: loc.lineIndex
    });
  }
  for (const warn of barsReport.warnings) {
    const loc = tokenLocations[warn.index] || {};
    warnings.push({
      ...warn,
      section: loc.sectionName,
      lineIndex: loc.lineIndex
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    song
  };
}

function renderText(text, { view = "shorthand" } = {}) {
  const { song } = buildSong(text);
  return renderSong(song, { view });
}

module.exports = {
  validateText,
  renderText
};
