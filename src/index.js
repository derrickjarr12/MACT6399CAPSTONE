
// index.js
// Public API barrel for PNF-AIMS v1 pipeline.

// --- Express server setup ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from your Express server!');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


const { tokenize } = require("./tokenizer_v1");
const { validateTokens, attachPemToWords } = require("./validator");
const { validateBars, collectBarsItems, BARS_ALLOWED, BARS_ANCHORS, BARS_MODIFIERS } = require("./bars_validator");
const { buildSong } = require("./ast_builder_v1");
const { renderSong } = require("./renderer_v1");
const { validateText, renderText } = require("./pipeline_v1");
const {
  OPERATIONS,
  JOB_STATUS,
  ARTIFACT_KIND,
  REQUEST_SCHEMA_V1,
  validateRequest,
  normalizeProviderResult
} = require("./provider_contract_v1");
const { loadEnv, getConfig } = require("./config/env-loader");
const { validateStartup } = require("./config/validate-startup");

module.exports = {
  tokenize,
  validateTokens,
  attachPemToWords,
  validateBars,
  collectBarsItems,
  BARS_ALLOWED,
  BARS_ANCHORS,
  BARS_MODIFIERS,
  buildSong,
  renderSong,
  validateText,
  renderText,
  OPERATIONS,
  JOB_STATUS,
  ARTIFACT_KIND,
  REQUEST_SCHEMA_V1,
  validateRequest,
  normalizeProviderResult,
  loadEnv,
  getConfig,
  validateStartup
};
