
// index.js
// Public API barrel for PNF-AIMS v1 pipeline.

// --- Module imports ---
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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

function resolveProviderConfig(generator = process.env.PREFERRED_PROVIDER || 'mureka') {
  const normalized = String(generator || process.env.PREFERRED_PROVIDER || 'mureka').toLowerCase();

  const parsePathList = (value) => {
    if (!value || typeof value !== 'string') return [];
    const unique = new Set();
    for (const rawPart of value.split(',')) {
      const part = rawPart.trim();
      if (!part) continue;
      const normalizedPart = part.startsWith('/') ? part : `/${part}`;
      unique.add(normalizedPart);
    }
    return [...unique];
  };

  const buildPathCandidates = ({ primary, backups, defaults = [] }) => {
    const primaryList = parsePathList(primary);
    const backupList = parsePathList(backups);
    const defaultList = defaults.filter(Boolean).map((entry) => (entry.startsWith('/') ? entry : `/${entry}`));
    return [...new Set([...primaryList, ...backupList, ...defaultList])];
  };

  if (normalized === 'mureka') {
    const generatePathCandidates = buildPathCandidates({
      primary: process.env.MUREKA_GENERATE_PATH,
      backups: process.env.MUREKA_GENERATE_PATH_BACKUPS,
      defaults: ['/v1/generate']
    });
    const statusPathCandidates = buildPathCandidates({
      primary: process.env.MUREKA_STATUS_PATH,
      backups: process.env.MUREKA_STATUS_PATH_BACKUPS,
      defaults: ['/v1/jobs/{jobId}']
    });

    return {
      normalized,
      apiKey: process.env.MUREKA_API_KEY,
      baseUrl: (process.env.MUREKA_BASE_URL || 'https://api.mureka.ai').replace(/\/$/, ''),
      generatePathCandidates,
      statusPathCandidates,
      generatePath: generatePathCandidates[0] || '',
      statusPathTemplate: statusPathCandidates[0] || '',
      statusJobIdQueryKey: process.env.MUREKA_STATUS_JOBID_QUERY_KEY || 'jobId'
    };
  }

  if (normalized === 'udio') {
    return {
      normalized,
      apiKey: process.env.UDIO_API_KEY || process.env.UDIOPROAPI_API_KEY,
      baseUrl: (process.env.UDIO_BASE_URL || process.env.UDIOPROAPI_BASE_URL || '').replace(/\/$/, ''),
      generatePath: process.env.UDIO_GENERATE_PATH || process.env.UDIOPROAPI_UDIO_GENERATE_PATH || process.env.UDIOPROAPI_GENERATE_PATH || '/v2/generate',
      statusPathTemplate: process.env.UDIO_STATUS_PATH || process.env.UDIOPROAPI_STATUS_PATH || '/v2/jobs/{jobId}',
      model: process.env.UDIO_MODEL || 'udio'
    };
  }

  if (normalized === 'elevenlabs') {
    const generatePathCandidates = buildPathCandidates({
      primary: process.env.ELEVENLABS_GENERATE_PATH,
      backups: process.env.ELEVENLABS_GENERATE_PATH_BACKUPS,
      defaults: []
    });
    const statusPathCandidates = buildPathCandidates({
      primary: process.env.ELEVENLABS_STATUS_PATH,
      backups: process.env.ELEVENLABS_STATUS_PATH_BACKUPS,
      defaults: []
    });

    return {
      normalized,
      apiKey: process.env.ELEVENLABS_API_KEY,
      baseUrl: (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, ''),
      generatePathCandidates,
      statusPathCandidates,
      generatePath: generatePathCandidates[0] || '',
      statusPathTemplate: statusPathCandidates[0] || '',
      statusJobIdQueryKey: process.env.ELEVENLABS_STATUS_JOBID_QUERY_KEY || 'jobId'
    };
  }

  const defaultGeneratePathCandidates = buildPathCandidates({
    primary: process.env.UDIOPROAPI_SUNO_GENERATE_PATH || process.env.SUNO_GENERATE_PATH,
    backups: process.env.SUNO_GENERATE_PATH_BACKUPS,
    defaults: [process.env.UDIOPROAPI_GENERATE_PATH || '/v2/generate']
  });
  const defaultStatusPathCandidates = buildPathCandidates({
    primary: process.env.UDIOPROAPI_STATUS_PATH || process.env.SUNO_STATUS_PATH,
    backups: process.env.SUNO_STATUS_PATH_BACKUPS,
    defaults: ['/v2/jobs/{jobId}']
  });

  return {
    normalized,
    apiKey: process.env.UDIOPROAPI_API_KEY || process.env.SUNO_API_KEY,
    baseUrl: (process.env.UDIOPROAPI_BASE_URL || process.env.SUNO_BASE_URL || '').replace(/\/$/, ''),
    generatePathCandidates: defaultGeneratePathCandidates,
    statusPathCandidates: defaultStatusPathCandidates,
    generatePath: defaultGeneratePathCandidates[0] || '',
    statusPathTemplate: defaultStatusPathCandidates[0] || '',
    statusJobIdQueryKey: process.env.SUNO_STATUS_JOBID_QUERY_KEY || 'jobId',
    model: process.env.SUNO_MODEL || 'suno'
  };
}

function applyPathTokens(pathTemplate, tokens = {}) {
  return String(pathTemplate || '').replace(/\{([^}]+)\}/g, (match, tokenName) => {
    const key = String(tokenName || '').trim();
    if (!(key in tokens)) return match;
    const value = tokens[key];
    if (value === undefined || value === null || value === '') return match;
    return encodeURIComponent(String(value));
  });
}

function buildStatusPath(pathTemplate, jobId, queryKey = 'jobId') {
  const withStandardToken = applyPathTokens(pathTemplate, { jobId });
  const withAltToken = withStandardToken.replace(':jobId', encodeURIComponent(jobId));

  if (withAltToken.includes(encodeURIComponent(jobId))) {
    return withAltToken;
  }

  const separator = withAltToken.includes('?') ? '&' : '?';
  return `${withAltToken}${separator}${encodeURIComponent(queryKey)}=${encodeURIComponent(jobId)}`;
}

async function fetchWithFallbackPaths({ method, baseUrl, pathCandidates, headers, body, pathBuilder }) {
  let lastResponse = null;
  let lastError = null;

  for (const candidate of pathCandidates) {
    const resolvedPath = typeof pathBuilder === 'function' ? pathBuilder(candidate) : candidate;
    const upstreamUrl = `${baseUrl}${resolvedPath}`;

    try {
      const upstreamRes = await fetch(upstreamUrl, {
        method,
        headers,
        ...(body !== undefined ? { body } : {})
      });

      lastResponse = { upstreamRes, upstreamUrl, resolvedPath };

      // Continue only when endpoint is missing and we have backups to try.
      if (upstreamRes.status === 404) {
        continue;
      }

      return { upstreamRes, upstreamUrl, resolvedPath };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error('No upstream path candidates configured.');
}

function buildHeaders(apiKey, provider = '') {
  const normalizedProvider = String(provider || '').toLowerCase();

  if (normalizedProvider === 'elevenlabs') {
    return {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    };
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey
  };
}

function resolveElevenLabsVoiceId(payload = {}) {
  const envVoice1 = String(process.env.ELEVENLABS_VOICE_ID_1 || '').trim();
  const envVoice2 = String(process.env.ELEVENLABS_VOICE_ID_2 || '').trim();
  const defaultVoice = String(process.env.ELEVENLABS_VOICE_ID || envVoice1 || envVoice2 || '').trim();
  const requestedVoice = payload.voiceId ?? payload.voice_id ?? payload.voiceSlot ?? payload.voice_slot;

  if (requestedVoice === 1 || requestedVoice === '1' || requestedVoice === 'voice1' || requestedVoice === 'VOICE_1') {
    return envVoice1 || defaultVoice;
  }

  if (requestedVoice === 2 || requestedVoice === '2' || requestedVoice === 'voice2' || requestedVoice === 'VOICE_2') {
    return envVoice2 || defaultVoice;
  }

  if (typeof requestedVoice === 'string' && requestedVoice.trim()) {
    return requestedVoice.trim();
  }

  return defaultVoice;
}

function isDryRunEnabled() {
  const value = String(process.env.PROVIDER_DRY_RUN || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function sanitizeTableName(tableName) {
  if (typeof tableName !== 'string') return 'pnf_request_jobs';
  return /^[A-Za-z0-9_]+$/.test(tableName) ? tableName : 'pnf_request_jobs';
}

function getEnvValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return '';
}

function getMySqlConfig() {
  const host = getEnvValue('MYSQL_HOST', 'DB_HOST');
  const user = getEnvValue('MYSQL_USER', 'DB_USER');
  const database = getEnvValue('MYSQL_DATABASE', 'DB_NAME');

  if (!host || !user || !database) {
    return null;
  }

  mysqlTable = sanitizeTableName(getEnvValue('MYSQL_TABLE', 'DB_TABLE') || 'pnf_request_jobs');

  const sslEnabled = String(getEnvValue('MYSQL_SSL', 'DB_SSL') || '').toLowerCase() === 'true';
  const sslRejectUnauthorized = String(getEnvValue('MYSQL_SSL_REJECT_UNAUTHORIZED', 'DB_SSL_REJECT_UNAUTHORIZED') || 'true').toLowerCase() !== 'false';
  const sslCaBase64 = getEnvValue('MYSQL_SSL_CA_BASE64', 'DB_SSL_CA_BASE64');
  const sslCaPath = getEnvValue('MYSQL_SSL_CA_PATH', 'DB_SSL_CA_PATH');

  let ssl;
  if (sslEnabled) {
    ssl = {
      rejectUnauthorized: sslRejectUnauthorized
    };

    if (sslCaBase64) {
      try {
        ssl.ca = Buffer.from(sslCaBase64, 'base64').toString('utf8');
      } catch (_) {
        console.warn('Invalid MYSQL_SSL_CA_BASE64 value; continuing without custom CA.');
      }
    } else if (sslCaPath) {
      try {
        ssl.ca = fs.readFileSync(sslCaPath, 'utf8');
      } catch (error) {
        console.warn(`Unable to read MySQL CA certificate at ${sslCaPath}: ${error.message}`);
      }
    }
  }

  return {
    host,
    port: Number(getEnvValue('MYSQL_PORT', 'DB_PORT') || 3306),
    user,
    password: getEnvValue('MYSQL_PASSWORD', 'DB_PASSWORD') || '',
    database,
    waitForConnections: true,
    connectionLimit: Number(getEnvValue('MYSQL_CONNECTION_LIMIT', 'DB_CONNECTION_LIMIT') || 10),
    queueLimit: 0,
    ...(ssl ? { ssl } : {})
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

function extractErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const direct = getFirstString(payload, [
    'error',
    'message',
    'error.message',
    'detail',
    'details',
    'data.error',
    'data.message',
    'result.error',
    'result.message'
  ]);

  return direct || '';
}

function statusLabel(status) {
  if (status === 200) return 'ok';
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === 500) return 'upstream_error';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'client_error';
  if (status >= 200) return 'success';
  return 'unknown';
}

function buildKnownStatusFallback(status) {
  if (status === 401) return 'Unauthorized request to provider. Check API credentials.';
  if (status === 404) return 'Provider endpoint or resource was not found.';
  if (status === 429) return 'Too many requests. Please retry after a delay.';
  if (status === 500) return 'Provider returned an internal server error.';
  return '';
}

function sendUpstreamResponse({ res, upstreamRes, data, normalized, hasCompareContext = false }) {
  const status = upstreamRes.status;
  const retryAfter = upstreamRes.headers.get('retry-after');
  const pnfMeta = {
    ...normalized,
    ...(hasCompareContext ? { hasCompareContext } : {}),
    http: {
      status,
      label: statusLabel(status),
      ...(retryAfter ? { retryAfter } : {})
    }
  };

  if ([401, 404, 429, 500].includes(status)) {
    const errorMessage = extractErrorMessage(data) || buildKnownStatusFallback(status);
    res.status(status).json({
      ...data,
      ...(errorMessage ? { error: errorMessage } : {}),
      _pnf: pnfMeta
    });
    return;
  }

  res.status(status).json({
    ...data,
    _pnf: pnfMeta
  });
}

function sendInternalServerError(res, error, fallbackMessage) {
  res.status(500).json({
    error: (error && error.message) || fallbackMessage || 'Internal server error.',
    _pnf: {
      http: {
        status: 500,
        label: statusLabel(500)
      }
    }
  });
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

app.post(['/api/provider/generate', '/api/apiframe/generate'], async (req, res) => {
  try {
    const defaultGenerator = process.env.PREFERRED_PROVIDER || 'mureka';
    const {
      prompt,
      generator = defaultGenerator,
      payload = {},
      compare = null,
      requestId: providedRequestId
    } = req.body || {};
    const cfg = resolveProviderConfig(generator);
    const requestId =
      typeof providedRequestId === 'string' && providedRequestId.trim()
        ? providedRequestId.trim()
        : crypto.randomUUID();

    if (!cfg.apiKey) {
      res.status(400).json({ error: `Missing API key for generator: ${generator}` });
      return;
    }

    const generatePathCandidates = Array.isArray(cfg.generatePathCandidates) ? cfg.generatePathCandidates : [cfg.generatePath];

    if (!cfg.baseUrl || generatePathCandidates.length === 0) {
      res.status(400).json({ error: `Missing base URL or generate path for generator: ${generator}` });
      return;
    }

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required and must be a string.' });
      return;
    }

    if (isDryRunEnabled()) {
      const providerJobId = `dryrun-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const data = {
        dryRun: true,
        accepted: true,
        status: 'queued',
        jobId: providerJobId,
        message: 'Dry-run mode enabled. No upstream provider call was made.',
        echoed: {
          generator: String(generator || '').toLowerCase(),
          prompt,
          payload
        }
      };

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
        upstreamStatus: 202,
        responseBody: data
      });

      res.status(202).json({
        ...data,
        _pnf: {
          ...normalized,
          ...(compare ? { hasCompareContext: true } : {}),
          dryRun: true,
          http: {
            status: 202,
            label: statusLabel(202)
          }
        }
      });
      return;
    }

    const isElevenLabs = String(cfg.normalized || generator || '').toLowerCase() === 'elevenlabs';
    const templateTokens = {
      voiceId: isElevenLabs
        ? resolveElevenLabsVoiceId(payload)
        : (payload.voiceId || payload.voice_id || process.env.ELEVENLABS_VOICE_ID || '')
    };

    const upstreamBody = {
      ...payload,
      ...(payload.model || cfg.model ? { model: payload.model || cfg.model } : {}),
      prompt,
      ...(isElevenLabs ? { text: payload.text || prompt } : {})
    };

    const { upstreamRes } = await fetchWithFallbackPaths({
      method: 'POST',
      baseUrl: cfg.baseUrl,
      pathCandidates: generatePathCandidates,
      headers: buildHeaders(cfg.apiKey, cfg.normalized),
      body: JSON.stringify(upstreamBody),
      pathBuilder: (pathTemplate) => applyPathTokens(pathTemplate, templateTokens)
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

    sendUpstreamResponse({
      res,
      upstreamRes,
      data,
      normalized,
      hasCompareContext: Boolean(compare)
    });
  } catch (error) {
    sendInternalServerError(res, error, 'Provider generate request failed.');
  }
});

app.get(['/api/provider/status/:jobId', '/api/apiframe/status/:jobId'], async (req, res) => {
  try {
    const defaultGenerator = process.env.PREFERRED_PROVIDER || 'mureka';
    const { generator = defaultGenerator } = req.query || {};
    const { jobId } = req.params;
    const cfg = resolveProviderConfig(generator);

    if (isDryRunEnabled()) {
      if (!jobId) {
        res.status(400).json({ error: 'jobId is required.' });
        return;
      }

      const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
      const data = {
        dryRun: true,
        status: 'completed',
        jobId,
        message: 'Dry-run mode enabled. No upstream provider polling was performed.'
      };

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
          upstreamStatus: 200,
          responseBody: data
        });
      }

      res.status(200).json({
        ...data,
        _pnf: {
          ...normalized,
          dryRun: true,
          http: {
            status: 200,
            label: statusLabel(200)
          }
        }
      });
      return;
    }

    if (!cfg.apiKey) {
      res.status(400).json({ error: `Missing API key for generator: ${generator}` });
      return;
    }

    if (!jobId) {
      res.status(400).json({ error: 'jobId is required.' });
      return;
    }

    const statusPathCandidates = Array.isArray(cfg.statusPathCandidates) ? cfg.statusPathCandidates : [cfg.statusPathTemplate];

    if (!cfg.baseUrl || statusPathCandidates.length === 0) {
      res.status(400).json({ error: `Missing base URL or status path for generator: ${generator}` });
      return;
    }

    const { upstreamRes } = await fetchWithFallbackPaths({
      method: 'GET',
      baseUrl: cfg.baseUrl,
      pathCandidates: statusPathCandidates,
      headers: buildHeaders(cfg.apiKey, cfg.normalized),
      pathBuilder: (statusTemplate) => buildStatusPath(statusTemplate, jobId, cfg.statusJobIdQueryKey)
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

    sendUpstreamResponse({
      res,
      upstreamRes,
      data,
      normalized
    });
  } catch (error) {
    sendInternalServerError(res, error, 'Provider status request failed.');
  }
});

app.get(['/api/provider/requests/:requestId', '/api/apiframe/requests/:requestId'], async (req, res) => {
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

app.get(['/api/provider/health', '/api/apiframe/health'], (req, res) => {
  const defaultGenerator = process.env.PREFERRED_PROVIDER || 'mureka';
  const { generator = defaultGenerator } = req.query || {};
  const cfg = resolveProviderConfig(generator);
  const dryRun = isDryRunEnabled();

  const keyPresent = Boolean(cfg.apiKey && String(cfg.apiKey).trim());
  const baseUrlPresent = Boolean(cfg.baseUrl && String(cfg.baseUrl).trim());
  const generatePathPresent = Boolean(cfg.generatePath && String(cfg.generatePath).trim());
  const statusPathPresent = Boolean(cfg.statusPathTemplate && String(cfg.statusPathTemplate).trim());

  const ready = dryRun || (keyPresent && baseUrlPresent && generatePathPresent && statusPathPresent);

  res.status(ready ? 200 : 503).json({
    ok: ready,
    generator: cfg.normalized,
    dryRun,
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
    },
    persistence: {
      mysqlConfigured: Boolean(getMySqlConfig()),
      mysqlConnected: Boolean(mysqlPool),
      mode: mysqlPool ? 'mysql' : 'memory'
    }
  });
});

app.get('/api/mysql/health', async (req, res) => {
  const config = getMySqlConfig();
  if (!config) {
    res.status(503).json({
      ok: false,
      configured: false,
      connected: false,
      error: 'MySQL is not configured. Set MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE.',
      mode: 'memory'
    });
    return;
  }

  try {
    await ensureMySqlInit();
    if (!mysqlPool) {
      throw new Error('MySQL pool unavailable after initialization.');
    }

    await mysqlPool.execute('SELECT 1 AS ok');

    res.json({
      ok: true,
      configured: true,
      connected: true,
      host: config.host,
      port: config.port,
      database: config.database,
      table: mysqlTable,
      mode: 'mysql'
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      configured: true,
      connected: false,
      host: config.host,
      port: config.port,
      database: config.database,
      table: mysqlTable,
      error: error.message,
      mode: 'memory'
    });
  }
});

validateStartup();
ensureMySqlInit();

// Serve built GUI from gui/dist if present
const guiDist = path.join(__dirname, '..', 'gui', 'dist');
if (fs.existsSync(guiDist)) {
  app.use(express.static(guiDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(guiDist, 'index.html'));
  });
}

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
