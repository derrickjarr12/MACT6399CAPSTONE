
// index.js
// Public API barrel for PNF-AIMS v1 pipeline.

// --- Module imports ---
const express = require('express');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

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

// --- Express server setup ---
const app = express();
const PORT = process.env.PORT || 3000;

const requestStore = new Map();
let mysqlPool = null;
let mysqlTable = 'pnf_request_jobs';
let mysqlInitPromise = null;

app.use(express.json({ limit: '25mb' }));
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

  if (normalized === 'elevenlabs') {
    return {
      normalized,
      apiKey: process.env.ELEVENLABS_API_KEY,
      baseUrl: (process.env.ELEVENLABS_BASE_URL || '').replace(/\/$/, ''),
      generatePath: process.env.ELEVENLABS_GENERATE_PATH || '',
      statusPathTemplate: process.env.ELEVENLABS_STATUS_PATH || ''
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

function sanitizeTableName(tableName) {
  if (typeof tableName !== 'string') return 'pnf_request_jobs';
  return /^[A-Za-z0-9_]+$/.test(tableName) ? tableName : 'pnf_request_jobs';
}

function getMySqlConfig() {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !database) {
    return null;
  }

  mysqlTable = sanitizeTableName(process.env.MYSQL_TABLE || 'pnf_request_jobs');

  return {
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user,
    password: process.env.MYSQL_PASSWORD || '',
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    queueLimit: 0
  };
}

async function initMySqlStore() {
  const config = getMySqlConfig();
  if (!config) return null;

  const pool = mysql.createPool(config);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${mysqlTable} (
      request_id VARCHAR(128) PRIMARY KEY,
      generator VARCHAR(64) NOT NULL,
      provider_job_id VARCHAR(255) NULL,
      prompt TEXT NULL,
      compare_context JSON NULL,
      payload JSON NULL,
      upstream_status INT NULL,
      normalized_status VARCHAR(32) NOT NULL,
      audio_url TEXT NULL,
      last_response JSON NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL
    )
  `);

  mysqlPool = pool;
  console.log(`MySQL request store enabled (${config.host}:${config.port}/${config.database}.${mysqlTable})`);
  return mysqlPool;
}

function ensureMySqlInit() {
  if (mysqlInitPromise) return mysqlInitPromise;

  mysqlInitPromise = initMySqlStore()
    .catch((error) => {
      console.warn(`MySQL request store unavailable, using in-memory store: ${error.message}`);
      mysqlPool = null;
      return null;
    });

  return mysqlInitPromise;
}

async function persistRequestRecord(record) {
  await ensureMySqlInit();
  if (!mysqlPool) return;

  const createdAt = record.createdAt || new Date().toISOString();
  const updatedAt = record.updatedAt || new Date().toISOString();

  await mysqlPool.execute(
    `
    INSERT INTO ${mysqlTable} (
      request_id,
      generator,
      provider_job_id,
      prompt,
      compare_context,
      payload,
      upstream_status,
      normalized_status,
      audio_url,
      last_response,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      generator = VALUES(generator),
      provider_job_id = VALUES(provider_job_id),
      prompt = VALUES(prompt),
      compare_context = VALUES(compare_context),
      payload = VALUES(payload),
      upstream_status = VALUES(upstream_status),
      normalized_status = VALUES(normalized_status),
      audio_url = VALUES(audio_url),
      last_response = VALUES(last_response),
      updated_at = VALUES(updated_at)
    `,
    [
      record.requestId,
      record.generator,
      record.providerJobId || null,
      record.prompt || null,
      record.compareContext ? JSON.stringify(record.compareContext) : null,
      record.payload ? JSON.stringify(record.payload) : null,
      Number.isFinite(record.upstreamStatus) ? record.upstreamStatus : null,
      record.normalizedStatus,
      record.audioUrl || null,
      record.lastResponse ? JSON.stringify(record.lastResponse) : null,
      createdAt,
      updatedAt
    ]
  );
}

function parseJsonOrNull(value) {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

async function readRequestRecord(requestId) {
  await ensureMySqlInit();

  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      `SELECT * FROM ${mysqlTable} WHERE request_id = ? LIMIT 1`,
      [requestId]
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      return {
        requestId: row.request_id,
        generator: row.generator,
        providerJobId: row.provider_job_id,
        prompt: row.prompt,
        compareContext: parseJsonOrNull(row.compare_context),
        payload: parseJsonOrNull(row.payload) || {},
        upstreamStatus: row.upstream_status,
        normalizedStatus: row.normalized_status,
        audioUrl: row.audio_url || '',
        lastResponse: parseJsonOrNull(row.last_response),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
      };
    }
  }

  return requestStore.get(requestId) || null;
}

function getByPath(input, path) {
  if (!input || typeof input !== 'object') return undefined;
  const parts = path.split('.');
  let current = input;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function getFirstString(input, candidates) {
  for (const path of candidates) {
    const value = getByPath(input, path);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function extractAudioUrl(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const direct = getFirstString(payload, [
    'audioUrl',
    'audio_url',
    'url',
    'trackUrl',
    'track_url',
    'outputUrl',
    'output_url',
    'result.audioUrl',
    'result.audio_url',
    'data.audioUrl',
    'data.audio_url'
  ]);
  if (direct) return direct;

  const arrayCandidates = ['audioUrls', 'audio_urls', 'tracks', 'outputs', 'artifacts', 'data.outputs'];
  for (const path of arrayCandidates) {
    const collection = getByPath(payload, path);
    if (!Array.isArray(collection) || collection.length === 0) continue;
    const first = collection[0];
    if (typeof first === 'string' && first.startsWith('http')) {
      return first;
    }
    if (first && typeof first === 'object') {
      const nested = extractAudioUrl(first);
      if (nested) return nested;
    }
  }

  return '';
}

function extractJobId(payload) {
  return getFirstString(payload, [
    'job_id',
    'jobId',
    'task_id',
    'taskId',
    'request_id',
    'requestId',
    'id',
    'job.id',
    'data.job_id',
    'data.jobId',
    'result.job_id',
    'result.jobId'
  ]);
}

function normalizeStatus(payload) {
  const raw = String(
    getFirstString(payload, [
      'status',
      'state',
      'job.status',
      'job.state',
      'data.status',
      'data.state',
      'result.status',
      'result.state'
    ]) || 'unknown'
  ).toLowerCase();

  if (['queued', 'accepted', 'pending', 'created', 'submitted', 'waiting'].includes(raw)) {
    return 'queued';
  }

  if (['running', 'processing', 'in_progress', 'in-progress', 'generating'].includes(raw)) {
    return 'processing';
  }

  if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(raw)) {
    return 'completed';
  }

  if (['failed', 'error', 'cancelled', 'canceled', 'rejected', 'timeout'].includes(raw)) {
    return 'failed';
  }

  const discoveredAudioUrl = extractAudioUrl(payload);
  if (discoveredAudioUrl) return 'completed';

  return 'unknown';
}

function buildNormalizedMetadata({ requestId, generator, providerJobId, payload }) {
  return {
    requestId,
    provider: String(generator || 'Suno').toLowerCase(),
    providerJobId,
    normalizedStatus: normalizeStatus(payload),
    audioUrl: extractAudioUrl(payload)
  };
}

async function upsertRequestRecord({
  requestId,
  generator,
  providerJobId,
  compareContext,
  prompt,
  payload,
  upstreamStatus,
  responseBody
}) {
  const now = new Date().toISOString();
  const existing = requestStore.get(requestId) || { createdAt: now };
  const normalized = buildNormalizedMetadata({
    requestId,
    generator,
    providerJobId,
    payload: responseBody
  });

  const record = {
    ...existing,
    requestId,
    generator: String(generator || 'Suno').toLowerCase(),
    providerJobId,
    prompt,
    compareContext: compareContext || existing.compareContext || null,
    payload: payload || existing.payload || {},
    upstreamStatus,
    normalizedStatus: normalized.normalizedStatus,
    audioUrl: normalized.audioUrl || existing.audioUrl || '',
    lastResponse: responseBody,
    updatedAt: now
  };

  requestStore.set(requestId, record);
  try {
    await persistRequestRecord(record);
  } catch (error) {
    console.warn(`Failed to persist request ${requestId} to MySQL: ${error.message}`);
  }
  return record;
}

app.post('/api/apiframe/generate', async (req, res) => {
  try {
    const {
      prompt,
      generator = 'Suno',
      payload = {},
      compare = null,
      requestId: providedRequestId
    } = req.body || {};
    const cfg = resolveApiFrameConfig(generator);
    const requestId =
      typeof providedRequestId === 'string' && providedRequestId.trim()
        ? providedRequestId.trim()
        : crypto.randomUUID();

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

    const providerJobId = extractJobId(data);
    const normalized = buildNormalizedMetadata({
      requestId,
      generator,
      providerJobId,
      payload: data
    });

    await upsertRequestRecord({
      requestId,
      generator,
      providerJobId,
      compareContext: compare,
      prompt,
      payload,
      upstreamStatus: upstreamRes.status,
      responseBody: data
    });

    res.status(upstreamRes.status).json({
      ...data,
      _pnf: {
        ...normalized,
        hasCompareContext: Boolean(compare)
      }
    });
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

    const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
    const normalized = buildNormalizedMetadata({
      requestId,
      generator,
      providerJobId: jobId,
      payload: data
    });

    if (requestId) {
      await upsertRequestRecord({
        requestId,
        generator,
        providerJobId: jobId,
        prompt: undefined,
        payload: undefined,
        compareContext: undefined,
        upstreamStatus: upstreamRes.status,
        responseBody: data
      });
    }

    res.status(upstreamRes.status).json({
      ...data,
      _pnf: normalized
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'APIframe status request failed.' });
  }
});

app.get('/api/apiframe/requests/:requestId', async (req, res) => {
  const { requestId } = req.params;
  if (!requestId) {
    res.status(400).json({ error: 'requestId is required.' });
    return;
  }

  const record = await readRequestRecord(requestId);
  if (!record) {
    res.status(404).json({ error: 'requestId not found.' });
    return;
  }

  res.json(record);
});

app.get('/', (req, res) => {
  res.send('Hello from your Express server!');
});

app.get('/api/apiframe/health', (req, res) => {
  const { generator = 'Suno' } = req.query || {};
  const cfg = resolveApiFrameConfig(generator);

  const keyPresent = Boolean(cfg.apiKey && String(cfg.apiKey).trim());
  const baseUrlPresent = Boolean(cfg.baseUrl && String(cfg.baseUrl).trim());
  const generatePathPresent = Boolean(cfg.generatePath && String(cfg.generatePath).trim());
  const statusPathPresent = Boolean(cfg.statusPathTemplate && String(cfg.statusPathTemplate).trim());

  const ready = keyPresent && baseUrlPresent && generatePathPresent && statusPathPresent;

  res.status(ready ? 200 : 503).json({
    ok: ready,
    generator: cfg.normalized,
    checks: {
      apiKey: keyPresent,
      baseUrl: baseUrlPresent,
      generatePath: generatePathPresent,
      statusPath: statusPathPresent
    },
    // Never return key material; only non-sensitive config shape.
    config: {
      baseUrl: cfg.baseUrl || '',
      generatePath: cfg.generatePath || '',
      statusPathTemplate: cfg.statusPathTemplate || ''
    }
  });
});

validateStartup();
ensureMySqlInit();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

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
