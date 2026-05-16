// renderer_v1.js
// Renders prompts from AST in clean, full, or debug view.

function formatMetadata(section) {
  const metadata = section.metadata ?? {};
  const parts = [];

  if (metadata.bpm !== undefined) parts.push(`BPM:${metadata.bpm}`);
  if (metadata.tsig) parts.push(`TSIG:${metadata.tsig}`);
  if (metadata.key) parts.push(`KEY:${metadata.key}`);
  if (metadata.mode) parts.push(`MODE:${metadata.mode}`);
  if (metadata.inst) parts.push(`INST:${metadata.inst}`);
  if (metadata.vol !== undefined) parts.push(`VOL:${metadata.vol}`);
  if (metadata.rhythm?.length) parts.push(`RHYTHM:${metadata.rhythm.join("-")}`);

  return parts.join(" ");
}

function renderSectionHeader(section) {
  if (!section.name || section.name === "DEFAULT") return "";

  const metadataText = formatMetadata(section);
  if (!metadataText) return `[${section.name}]`;
  return `[${section.name}]: ${metadataText}`;
}

function renderLineClean(line) {
  if (line.type !== "LINE") return "";
  if (!line.words || line.words.length === 0) return "";

  return line.words.map(word => {
    if (word.dynamic === "LOUD") return word.text.toUpperCase();
    return word.text;
  }).join(" ");
}

function renderLineFull(line) {
  if (line.type !== "LINE") return "";
  return line.raw ?? "";
}

function renderLineShorthand(line) {
  if (line.type !== "LINE") return "";
  return line.raw ?? "";
}

function renderLineDebug(line) {
  if (line.type !== "LINE") return "";
  if (!line.tokensWithAttachments) return "";

  return line.tokensWithAttachments.map(token => {
    if (token.type === "WORD") {
      const pem = (token.pem ?? []).join(",") || "-";
      const dyn = (token.dyn ?? []).join(",") || "-";
      return `WORD(${token.text},${token.dynamic ?? "NORMAL"},pem:${pem},dyn:${dyn})`;
    }
    if (token.type === "BREATH") return `BREATH(${token.size})`;
    if (token.type === "PEM") return `PEM(${token.kind})`;
    if (token.type === "DYN") return `DYN(${token.kind})`;
    if (token.type === "PHRASE_BREAK") return "PHRASE_BREAK";
    if (token.type === "SYLLABLE_SPLIT") return "SYLLABLE_SPLIT";
    if (token.type === "SOFT_MODE_TOGGLE") return "SOFT_MODE_TOGGLE";
    if (token.type === "SOFT_HIGH_TOGGLE") return "SOFT_HIGH_TOGGLE";
    if (token.type === "SECTION_TAG") return `SECTION_TAG(${token.text})`;
    if (token.type === "BARS_FS") return `BARS_FS(${token.kind})`;
    if (token.type === "REST") return `REST(${token.duration})`;
    if (token.type === "TEXTURE") return `TEXTURE(${token.kind})`;
    if (token.type === "LINE_PEM") return `LINE_PEM(${token.kind})`;
    if (token.type === "LINE_DYN") return `LINE_DYN(${token.kind})`;
    if (token.type === "LINE_TEXTURE") return `LINE_TEXTURE(${token.kind})`;
    if (token.type === "CHAR") return `CHAR(${token.text})`;
    return token.type;
  }).join(" ");
}

function renderSong(song, { view = "shorthand" } = {}) {
  const lines = [];

  for (const section of song.sections) {
    const header = renderSectionHeader(section);
    if (header) {
      lines.push(header);
    }

    for (const line of section.lines) {
      if (line.type === "BLANK") {
        lines.push("");
        continue;
      }

      if (view === "clean") {
        lines.push(renderLineClean(line));
        continue;
      }

      if (view === "debug") {
        lines.push(renderLineDebug(line));
        continue;
      }

      if (view === "shorthand") {
        lines.push(renderLineShorthand(line));
        continue;
      }

      lines.push(renderLineFull(line));
    }

    lines.push("");
  }

  return lines.join("\n");
}

module.exports = {
  renderSong
};
