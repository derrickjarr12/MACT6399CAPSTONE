
// index.js
// Public API barrel for PNF-AIMS v1 pipeline.

// --- Express server setup ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

function resolveApiFrameConfig(generator = 'Suno') {
  const normalized = String(generator || 'Suno').toLowerCase();

  if (normalized === 'mureka') {
    return {
      normalized,
      apiKey: process.env.MUREKA_API_KEY,
      baseUrl: (process.env.MUREKA_BASE_URL || '').replace(/\/$/, ''),
      generatePath: process.env.MUREKA_GENERATE_PATH || '',
      statusPathTemplate: process.env.MUREKA_STATUS_PATH || ''
    };
  }

  if (normalized === 'udio') {
    return {
      normalized,
      apiKey: process.env.UDIO_API_KEY,
      baseUrl: (process.env.UDIO_BASE_URL || '').replace(/\/$/, ''),
      generatePath: process.env.UDIO_GENERATE_PATH || '',
      statusPathTemplate: process.env.UDIO_STATUS_PATH || ''
    };
  }

  return {
    normalized,
    apiKey: process.env.APIFRAME_API_KEY || process.env.SUNO_API_KEY,
    baseUrl: (process.env.APIFRAME_BASE_URL || 'https://api.apiframe.pro').replace(/\/$/, ''),
    generatePath: process.env.APIFRAME_SUNO_GENERATE_PATH || '/suno/v1/generate',
    statusPathTemplate: process.env.APIFRAME_STATUS_PATH || '/v1/jobs/{jobId}'
  };
}

function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey
  };
}

app.post('/api/apiframe/generate', async (req, res) => {
  try {
    const { prompt, generator = 'Suno', payload = {} } = req.body || {};
    const cfg = resolveApiFrameConfig(generator);

    if (!cfg.apiKey) {
      res.status(400).json({ error: `Missing API key for generator: ${generator}` });
      return;
    }

    if (!cfg.baseUrl || !cfg.generatePath) {
      res.status(400).json({ error: `Missing base URL or generate path for generator: ${generator}` });
      return;
    }

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required and must be a string.' });
      return;
    }

    const upstreamUrl = `${cfg.baseUrl}${cfg.generatePath}`;
    const upstreamBody = {
      prompt,
      ...payload
    };

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: buildHeaders(cfg.apiKey),
      body: JSON.stringify(upstreamBody)
    });

    const text = await upstreamRes.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    res.status(upstreamRes.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'APIframe generate request failed.' });
  }
});

app.get('/api/apiframe/status/:jobId', async (req, res) => {
  try {
    const { generator = 'Suno' } = req.query || {};
    const { jobId } = req.params;
    const cfg = resolveApiFrameConfig(generator);

    if (!cfg.apiKey) {
      res.status(400).json({ error: `Missing API key for generator: ${generator}` });
      return;
    }

    if (!jobId) {
      res.status(400).json({ error: 'jobId is required.' });
      return;
    }

    if (!cfg.baseUrl || !cfg.statusPathTemplate) {
      res.status(400).json({ error: `Missing base URL or status path for generator: ${generator}` });
      return;
    }

    const statusPath = cfg.statusPathTemplate.replace('{jobId}', encodeURIComponent(jobId));
    const upstreamUrl = `${cfg.baseUrl}${statusPath}`;
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: buildHeaders(cfg.apiKey)
    });

    const text = await upstreamRes.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    res.status(upstreamRes.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'APIframe status request failed.' });
  }
});

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
