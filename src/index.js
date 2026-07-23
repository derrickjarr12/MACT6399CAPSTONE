
// index.js
// Public API barrel for PNF-AIMS v1 pipeline.

// --- Module imports ---
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
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
const {
  getFfmpegFeatureConfig,
  probeFfmpegBinary,
  getFfmpegCapabilities,
  preprocessSourceAudioPayload,
  postprocessGeneratedAudioExport,
  generateAudioVisualArtifacts
} = require('./media/ffmpeg');

// --- Express server setup ---
const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

const requestStore = new Map();
const mediaArtifactStore = new Map();
const requestSubscriptions = new Map();
let mysqlPool = null;
let mysqlTable = 'pnf_request_jobs';
let mysqlInitPromise = null;

const MEDIA_ARTIFACT_TTL_MS = 60 * 60 * 1000;

function cleanupExpiredMediaArtifacts() {
  const now = Date.now();
  for (const [artifactId, record] of mediaArtifactStore.entries()) {
    if (!record || !record.expiresAt || record.expiresAt > now) continue;
    mediaArtifactStore.delete(artifactId);
    if (record.filePath) {
      fs.promises.unlink(record.filePath).catch(() => {});
    }
  }
}

function registerMediaArtifact({ filePath, mimeType, extension, ttlMs = MEDIA_ARTIFACT_TTL_MS }) {
  cleanupExpiredMediaArtifacts();
  const artifactId = crypto.randomUUID();
  const now = Date.now();
  mediaArtifactStore.set(artifactId, {
    filePath,
    mimeType,
    extension,
    createdAt: now,
    expiresAt: now + ttlMs
  });

  return artifactId;
}

function extensionFromMimeType(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('mpeg')) return 'mp3';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('flac')) return 'flac';
  return 'bin';
}

function toAbsoluteUrl(req, maybePath) {
  const value = String(maybePath || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const origin = `${req.protocol}://${req.get('host')}`;
  return value.startsWith('/') ? `${origin}${value}` : `${origin}/${value}`;
}

function hasSourceAudioPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return false;

  const candidates = [
    payload.sourceAudioUrl,
    payload.source_audio_url,
    payload.inputAudioUrl,
    payload.input_audio_url,
    payload.sourceAudioData,
    payload.source_audio_data,
    payload.inputAudioData,
    payload.input_audio_data
  ];

  return candidates.some((value) => typeof value === 'string' && value.trim().length > 0);
}

function extractBearerToken(authorizationHeader = '') {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') return '';
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}

function getCallbackTokenFromRequest(req) {
  return String(
    req.headers['x-callback-token'] ||
    extractBearerToken(req.headers.authorization || '') ||
    req.query.callbackToken ||
    req.body?.callbackToken ||
    ''
  ).trim();
}

function parseBooleanEnvFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function isProductionRuntime() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function isCallbackTokenEnforced() {
  const explicit = parseBooleanEnvFlag(process.env.CALLBACK_AUTH_REQUIRED);
  if (explicit !== null) return explicit;
  return isProductionRuntime();
}

function isElevenLabsSignatureStrictModeEnabled() {
  const explicit = parseBooleanEnvFlag(process.env.ELEVENLABS_REQUIRE_SIGNATURE);
  if (explicit !== null) return explicit;
  return isProductionRuntime();
}

function secureTokenEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isCallbackAuthorized(req) {
  const expectedToken = String(
    process.env.NOCODE_CALLBACK_TOKEN ||
    process.env.PROVIDER_CALLBACK_TOKEN ||
    process.env.CALLBACK_TOKEN ||
    ''
  ).trim();

  const tokenRequired = Boolean(expectedToken) || isCallbackTokenEnforced();

  if (tokenRequired && !expectedToken) {
    return {
      ok: false,
      tokenRequired: true,
      reason: 'missing_server_callback_token'
    };
  }

  if (!tokenRequired) {
    return { ok: true, tokenRequired: false, reason: 'token_not_required' };
  }

  const providedToken = getCallbackTokenFromRequest(req);
  if (!providedToken) {
    return { ok: false, tokenRequired: true, reason: 'missing_callback_token' };
  }

  return {
    ok: secureTokenEquals(providedToken, expectedToken),
    tokenRequired: true,
    reason: 'token_checked'
  };
}

function toSseData(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function subscribeRequestStream(requestId, res) {
  const key = String(requestId || '').trim();
  if (!key) return;

  const subscribers = requestSubscriptions.get(key) || new Set();
  subscribers.add(res);
  requestSubscriptions.set(key, subscribers);
}

function unsubscribeRequestStream(requestId, res) {
  const key = String(requestId || '').trim();
  if (!key) return;

  const subscribers = requestSubscriptions.get(key);
  if (!subscribers) return;

  subscribers.delete(res);
  if (subscribers.size === 0) {
    requestSubscriptions.delete(key);
  }
}

function publishRequestUpdate(requestId, eventName, payload) {
  const key = String(requestId || '').trim();
  if (!key) return;

  const subscribers = requestSubscriptions.get(key);
  if (!subscribers || subscribers.size === 0) return;

  const eventLine = eventName ? `event: ${eventName}\n` : '';
  const body = `${eventLine}${toSseData(payload)}`;

  for (const subscriber of subscribers) {
    if (subscriber.writableEnded || subscriber.destroyed) continue;
    subscriber.write(body);
  }
}

app.use(express.json({
  limit: '25mb',
  verify: (req, _res, buf) => {
    req.rawBody = Buffer.from(buf || []).toString('utf8');
  }
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-callback-token, x-elevenlabs-signature, x-elevenlabs-timestamp');
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

function resolveCallbackEnvelope(body = {}) {
  const raw = body && typeof body === 'object' ? body : {};
  const wrappedResponse = raw.response && typeof raw.response === 'object' ? raw.response : null;
  const wrappedPayload = raw.payload && typeof raw.payload === 'object' ? raw.payload : null;
  const data = wrappedResponse || wrappedPayload || raw;

  const requestId = getFirstString(raw, ['requestId']) || getFirstString(data, ['requestId', 'request_id']);
  const generator = getFirstString(raw, ['generator', 'provider']) || getFirstString(data, ['generator', 'provider']) || 'elevenlabs';
  const providerJobId =
    getFirstString(raw, ['providerJobId', 'jobId', 'job_id']) ||
    extractJobId(data) ||
    extractJobId(raw);

  const statusCodeRaw = Number(raw.statusCode ?? raw.status ?? raw.httpStatus ?? 200);
  const statusCode = Number.isFinite(statusCodeRaw) ? statusCodeRaw : 200;

  return {
    requestId,
    generator,
    providerJobId,
    statusCode,
    responseBody: data,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null
  };
}

function parseSignatureParts(signatureHeader = '') {
  if (!signatureHeader || typeof signatureHeader !== 'string') return [];
  return signatureHeader
    .split(',')
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .map((part) => {
      const eqIndex = part.indexOf('=');
      if (eqIndex === -1) {
        return { key: '', value: part };
      }
      return {
        key: part.slice(0, eqIndex).trim().toLowerCase(),
        value: part.slice(eqIndex + 1).trim()
      };
    });
}

function getSignatureMetadata(req) {
  const signatureHeader = String(
    req.headers['x-elevenlabs-signature'] ||
    req.headers['elevenlabs-signature'] ||
    req.headers['x-signature'] ||
    req.headers.signature ||
    ''
  ).trim();

  const timestamp = String(
    req.headers['x-elevenlabs-timestamp'] ||
    req.headers['elevenlabs-timestamp'] ||
    req.headers['x-webhook-timestamp'] ||
    req.headers['webhook-timestamp'] ||
    ''
  ).trim();

  const parts = parseSignatureParts(signatureHeader);
  const candidateSignatures = new Set();
  for (const part of parts) {
    if (!part.value) continue;
    candidateSignatures.add(part.value);
  }

  const directHeaderParts = signatureHeader
    .split(/[\s,]+/)
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  for (const value of directHeaderParts) {
    if (value.includes('=')) {
      const parsed = parseSignatureParts(value);
      for (const item of parsed) {
        if (item.value) candidateSignatures.add(item.value);
      }
      continue;
    }
    candidateSignatures.add(value);
  }

  return {
    signatureHeaderPresent: Boolean(signatureHeader),
    signatureHeader,
    timestampPresent: Boolean(timestamp),
    timestamp,
    candidateSignatures: [...candidateSignatures]
  };
}

function buildExpectedSignatureCandidates({ secret, timestamp, rawBody }) {
  if (!secret) return [];

  const body = String(rawBody || '');
  const baseDigest = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const candidates = new Set([baseDigest, `sha256=${baseDigest}`]);

  if (timestamp) {
    const tsDigest = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    candidates.add(tsDigest);
    candidates.add(`sha256=${tsDigest}`);
  }

  return [...candidates];
}

function verifyElevenLabsCallbackSignature(req, generator) {
  const normalizedGenerator = String(generator || '').toLowerCase();
  const shouldEvaluate =
    normalizedGenerator === 'elevenlabs' ||
    Boolean(req.headers['x-elevenlabs-signature']) ||
    Boolean(req.headers['elevenlabs-signature']);

  const strictMode = isElevenLabsSignatureStrictModeEnabled();
  const signingSecret = String(process.env.ELEVENLABS_WEBHOOK_SIGNING_SECRET || '').trim();

  if (!shouldEvaluate) {
    return {
      evaluated: false,
      valid: true,
      strictMode,
      reason: 'not_elevenlabs_callback'
    };
  }

  const signatureMeta = getSignatureMetadata(req);
  if (!signatureMeta.signatureHeaderPresent) {
    return {
      evaluated: true,
      valid: !strictMode,
      strictMode,
      reason: 'missing_signature_header',
      signatureMeta
    };
  }

  if (!signingSecret) {
    return {
      evaluated: true,
      valid: !strictMode,
      strictMode,
      reason: 'missing_signing_secret',
      signatureMeta
    };
  }

  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
  const expectedCandidates = buildExpectedSignatureCandidates({
    secret: signingSecret,
    timestamp: signatureMeta.timestamp,
    rawBody
  });

  const provided = signatureMeta.candidateSignatures;
  const matched = provided.some((value) => expectedCandidates.includes(value));

  return {
    evaluated: true,
    valid: matched,
    strictMode,
    reason: matched ? 'signature_valid' : 'signature_mismatch',
    signatureMeta: {
      ...signatureMeta,
      candidateSignatures: provided
    }
  };
}

function logCallbackAudit(req, envelope, authResult, signatureResult) {
  const audit = {
    ts: new Date().toISOString(),
    event: 'provider_callback',
    route: req.originalUrl || req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    requestId: envelope.requestId || '',
    generator: String(envelope.generator || '').toLowerCase(),
    providerJobId: envelope.providerJobId || '',
    upstreamStatus: envelope.statusCode,
    auth: {
      tokenRequired: Boolean(authResult?.tokenRequired),
      authorized: Boolean(authResult?.ok)
    },
    signature: {
      evaluated: Boolean(signatureResult?.evaluated),
      valid: Boolean(signatureResult?.valid),
      strictMode: Boolean(signatureResult?.strictMode),
      reason: signatureResult?.reason || '',
      signatureHeaderPresent: Boolean(signatureResult?.signatureMeta?.signatureHeaderPresent),
      timestampPresent: Boolean(signatureResult?.signatureMeta?.timestampPresent)
    }
  };

  const auditLine = `[callback-audit] ${JSON.stringify(audit)}`;
  if (signatureResult && signatureResult.evaluated && !signatureResult.valid) {
    console.warn(auditLine);
    return;
  }
  console.info(auditLine);
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
  publishRequestUpdate(requestId, 'request-updated', {
    requestId,
    normalizedStatus: record.normalizedStatus,
    providerJobId: record.providerJobId,
    audioUrl: record.audioUrl,
    upstreamStatus: record.upstreamStatus,
    updatedAt: record.updatedAt,
    lastResponse: record.lastResponse
  });

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

    let generatePathCandidates = Array.isArray(cfg.generatePathCandidates) ? cfg.generatePathCandidates : [cfg.generatePath];

    if (!cfg.baseUrl || generatePathCandidates.length === 0) {
      res.status(400).json({ error: `Missing base URL or generate path for generator: ${generator}` });
      return;
    }

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required and must be a string.' });
      return;
    }

    // Phase 2a: optional backend-only ingest preprocessing for data-URI source audio.
    let effectivePayload = payload;
    let ffmpegIngestMeta = null;
    try {
      const preprocess = await preprocessSourceAudioPayload(payload);
      effectivePayload = preprocess.payload || payload;
      ffmpegIngestMeta = {
        applied: preprocess.applied,
        skipped: preprocess.skipped,
        reason: preprocess.reason,
        ...(preprocess.applied
          ? {
              sourceKey: preprocess.sourceKey,
              originalMimeType: preprocess.originalMimeType,
              outputMimeType: preprocess.outputMimeType,
              outputSampleRate: preprocess.outputSampleRate,
              outputChannels: preprocess.outputChannels,
              filters: preprocess.filters
            }
          : {}),
        ...(preprocess.error ? { error: preprocess.error } : {})
      };
    } catch (error) {
      ffmpegIngestMeta = {
        applied: false,
        skipped: true,
        reason: 'ingest_preprocess_failed_safe_fallback',
        error: error.message
      };
      effectivePayload = payload;
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
          payload: effectivePayload
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
        payload: effectivePayload,
        upstreamStatus: 202,
        responseBody: data
      });

      res.status(202).json({
        ...data,
        _pnf: {
          ...normalized,
          ...(compare ? { hasCompareContext: true } : {}),
          ffmpegIngest: ffmpegIngestMeta,
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
    const wantsSourceDrivenRender = hasSourceAudioPayload(effectivePayload);

    if (isElevenLabs && wantsSourceDrivenRender) {
      // For uploaded audio workflows, prefer music/transform-style routes before TTS paths
      // so SAION doesn't return a spoken reading of the general prompt.
      const prioritized = [];
      const fallback = [];
      for (const candidatePath of generatePathCandidates) {
        const normalizedCandidate = String(candidatePath || '').toLowerCase();
        if (normalizedCandidate.includes('/music/compose')) {
          prioritized.push(candidatePath);
        } else {
          fallback.push(candidatePath);
        }
      }
      if (prioritized.length > 0) {
        generatePathCandidates = [...prioritized, ...fallback];
      }
    }

    const activePrimaryGeneratePath = String(generatePathCandidates[0] || '').toLowerCase();
    const shouldInjectElevenLabsText =
      isElevenLabs &&
      !wantsSourceDrivenRender &&
      activePrimaryGeneratePath.includes('/text-to-speech');

    const templateTokens = {
      voiceId: isElevenLabs
        ? resolveElevenLabsVoiceId(payload)
        : (payload.voiceId || payload.voice_id || process.env.ELEVENLABS_VOICE_ID || '')
    };

    const upstreamBody = {
      ...effectivePayload,
      ...(effectivePayload.model || cfg.model ? { model: effectivePayload.model || cfg.model } : {}),
      prompt,
      ...(shouldInjectElevenLabsText ? { text: effectivePayload.text || prompt } : {})
    };

    const { upstreamRes } = await fetchWithFallbackPaths({
      method: 'POST',
      baseUrl: cfg.baseUrl,
      pathCandidates: generatePathCandidates,
      headers: buildHeaders(cfg.apiKey, cfg.normalized),
      body: JSON.stringify(upstreamBody),
      pathBuilder: (pathTemplate) => applyPathTokens(pathTemplate, templateTokens)
    });

    const responseContentType = String(upstreamRes.headers.get('content-type') || '').toLowerCase();
    const isBinaryAudioResponse = responseContentType.startsWith('audio/');

    let data;
    if (isBinaryAudioResponse) {
      const audioBytes = Buffer.from(await upstreamRes.arrayBuffer());
      const audioMimeType = responseContentType.split(';')[0] || 'audio/mpeg';

      if (upstreamRes.ok && audioBytes.length > 0) {
        const extension = extensionFromMimeType(audioMimeType);
        const tempFilePath = path.join(
          os.tmpdir(),
          `saion-elevenlabs-music-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`
        );
        await fs.promises.writeFile(tempFilePath, audioBytes);

        const artifactId = registerMediaArtifact({
          filePath: tempFilePath,
          mimeType: audioMimeType,
          extension
        });

        const artifactPath = `/api/media/ffmpeg/artifacts/${artifactId}`;
        data = {
          status: 'completed',
          audioUrl: toAbsoluteUrl(req, artifactPath),
          artifactUrl: toAbsoluteUrl(req, artifactPath),
          artifactId,
          mimeType: audioMimeType,
          bytes: audioBytes.length,
          source: 'elevenlabs_binary_audio_response'
        };
      } else {
        data = {
          status: 'failed',
          error: 'Audio response was empty or upstream request failed.',
          mimeType: audioMimeType,
          bytes: audioBytes.length
        };
      }
    } else {
      const text = await upstreamRes.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
    }

    const providerJobId = extractJobId(data);
    const normalized = buildNormalizedMetadata({
      requestId,
      generator,
      providerJobId,
      payload: data
    });

    let ffmpegExportMeta = null;
    if (upstreamRes.ok && normalized.audioUrl && !isBinaryAudioResponse) {
      const exportResult = await postprocessGeneratedAudioExport(normalized.audioUrl);
      ffmpegExportMeta = {
        applied: exportResult.applied,
        skipped: exportResult.skipped,
        reason: exportResult.reason,
        ...(exportResult.applied
          ? {
              sourceType: exportResult.sourceType,
              sourceMimeType: exportResult.sourceMimeType,
              outputFormat: exportResult.outputFormat,
              outputMimeType: exportResult.outputMimeType,
              outputSizeBytes: exportResult.outputSizeBytes
            }
          : {}),
        ...(exportResult.error ? { error: exportResult.error } : {})
      };

      if (exportResult.applied && exportResult.outputPath) {
        const artifactId = registerMediaArtifact({
          filePath: exportResult.outputPath,
          mimeType: exportResult.outputMimeType,
          extension: exportResult.outputFormat
        });

        const artifactUrl = `/api/media/ffmpeg/artifacts/${artifactId}`;
        data.postProcessedAudioUrl = artifactUrl;
        data.postProcessedAudioFormat = exportResult.outputFormat;
        ffmpegExportMeta.artifactId = artifactId;
        ffmpegExportMeta.artifactUrl = artifactUrl;
      }

      if (exportResult.cleanupInputPath) {
        fs.promises.unlink(exportResult.cleanupInputPath).catch(() => {});
      }
    }

    const normalizedWithFfmpeg = {
      ...normalized,
      ffmpegIngest: ffmpegIngestMeta,
      ffmpegExport: ffmpegExportMeta
    };

    await upsertRequestRecord({
      requestId,
      generator,
      providerJobId,
      compareContext: compare,
      prompt,
      payload: effectivePayload,
      upstreamStatus: upstreamRes.status,
      responseBody: data
    });

    sendUpstreamResponse({
      res,
      upstreamRes,
      data,
      normalized: normalizedWithFfmpeg,
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

app.get(['/api/provider/stream/:requestId', '/api/apiframe/stream/:requestId'], async (req, res) => {
  const { requestId } = req.params;
  if (!requestId) {
    res.status(400).json({ error: 'requestId is required.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  subscribeRequestStream(requestId, res);

  const existing = await readRequestRecord(requestId);
  res.write(`event: stream-open\n${toSseData({ requestId, hasExistingRecord: Boolean(existing) })}`);

  if (existing) {
    res.write(`event: request-snapshot\n${toSseData(existing)}`);
  }

  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      return;
    }
    res.write(`event: heartbeat\n${toSseData({ ts: new Date().toISOString() })}`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribeRequestStream(requestId, res);
  });
});

app.post(['/api/provider/callback', '/api/no-code/callback', '/api/apiframe/callback'], async (req, res) => {
  try {
    const envelope = resolveCallbackEnvelope(req.body || {});
    const auth = isCallbackAuthorized(req);
    const signatureResult = verifyElevenLabsCallbackSignature(req, envelope.generator);

    logCallbackAudit(req, envelope, auth, signatureResult);

    if (!auth.ok) {
      res.status(401).json({
        error: 'Unauthorized callback request.',
        _pnf: {
          callbackAuthReason: auth.reason || '',
          http: {
            status: 401,
            label: statusLabel(401)
          }
        }
      });
      return;
    }

    if (signatureResult.strictMode && signatureResult.evaluated && !signatureResult.valid) {
      res.status(401).json({
        error: 'Invalid ElevenLabs callback signature.',
        _pnf: {
          http: {
            status: 401,
            label: statusLabel(401)
          }
        }
      });
      return;
    }

    if (!envelope.requestId) {
      res.status(400).json({
        error: 'requestId is required in callback payload.',
        _pnf: {
          http: {
            status: 400,
            label: statusLabel(400)
          }
        }
      });
      return;
    }

    const record = await upsertRequestRecord({
      requestId: envelope.requestId,
      generator: envelope.generator,
      providerJobId: envelope.providerJobId,
      compareContext: envelope.metadata?.compareContext,
      prompt: envelope.metadata?.prompt,
      payload: envelope.metadata?.payload,
      upstreamStatus: envelope.statusCode,
      responseBody: envelope.responseBody
    });

    const normalized = buildNormalizedMetadata({
      requestId: envelope.requestId,
      generator: envelope.generator,
      providerJobId: envelope.providerJobId,
      payload: envelope.responseBody
    });

    res.status(200).json({
      accepted: true,
      source: 'provider-callback',
      tokenRequired: auth.tokenRequired,
      signature: {
        evaluated: signatureResult.evaluated,
        valid: signatureResult.valid,
        strictMode: signatureResult.strictMode,
        reason: signatureResult.reason
      },
      record,
      _pnf: {
        ...normalized,
        http: {
          status: 200,
          label: statusLabel(200)
        }
      }
    });
  } catch (error) {
    sendInternalServerError(res, error, 'Provider callback processing failed.');
  }
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
    callbackSecurity: {
      tokenRequired: isCallbackTokenEnforced() || Boolean(String(process.env.NOCODE_CALLBACK_TOKEN || process.env.PROVIDER_CALLBACK_TOKEN || process.env.CALLBACK_TOKEN || '').trim()),
      tokenConfigured: Boolean(String(process.env.NOCODE_CALLBACK_TOKEN || process.env.PROVIDER_CALLBACK_TOKEN || process.env.CALLBACK_TOKEN || '').trim()),
      elevenlabsSignatureStrict: isElevenLabsSignatureStrictModeEnabled(),
      elevenlabsSigningSecretConfigured: Boolean(String(process.env.ELEVENLABS_WEBHOOK_SIGNING_SECRET || '').trim())
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

app.get('/api/media/ffmpeg/health', async (req, res) => {
  const cfg = getFfmpegFeatureConfig();

  try {
    const probe = await probeFfmpegBinary();
    const ready = Boolean(cfg.enabled && probe.binaries.ffmpeg.ok && probe.binaries.ffprobe.ok);

    res.status(ready ? 200 : 503).json({
      ok: ready,
      enabled: cfg.enabled,
      timeoutMs: cfg.timeoutMs,
      binaries: probe.binaries,
      capabilities: getFfmpegCapabilities(),
      mode: 'phase1_health_only'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      enabled: cfg.enabled,
      error: error.message,
      capabilities: getFfmpegCapabilities(),
      mode: 'phase1_health_only'
    });
  }
});

app.get('/api/media/ffmpeg/artifacts/:artifactId', async (req, res) => {
  const { artifactId } = req.params;
  const record = mediaArtifactStore.get(artifactId);

  if (!record) {
    res.status(404).json({ error: 'artifact not found' });
    return;
  }

  if (record.expiresAt <= Date.now()) {
    mediaArtifactStore.delete(artifactId);
    if (record.filePath) {
      fs.promises.unlink(record.filePath).catch(() => {});
    }
    res.status(410).json({ error: 'artifact expired' });
    return;
  }

  try {
    const stats = await fs.promises.stat(record.filePath);
    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(stats.size));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(record.filePath);
  } catch {
    mediaArtifactStore.delete(artifactId);
    res.status(404).json({ error: 'artifact file unavailable' });
  }
});

app.post('/api/media/ffmpeg/visualize', async (req, res) => {
  try {
    const sourceAudio = typeof req.body?.audioUrl === 'string' ? req.body.audioUrl : '';
    if (!sourceAudio.trim()) {
      res.status(400).json({ error: 'audioUrl is required and must be a string.' });
      return;
    }

    const visualResult = await generateAudioVisualArtifacts(sourceAudio);
    const metadata = {
      applied: visualResult.applied,
      skipped: visualResult.skipped,
      reason: visualResult.reason,
      ...(visualResult.sourceType ? { sourceType: visualResult.sourceType } : {}),
      ...(visualResult.sourceMimeType ? { sourceMimeType: visualResult.sourceMimeType } : {}),
      ...(visualResult.error ? { error: visualResult.error } : {})
    };

    const artifacts = {};

    if (visualResult.waveform && visualResult.waveform.path) {
      const waveformId = registerMediaArtifact({
        filePath: visualResult.waveform.path,
        mimeType: visualResult.waveform.mimeType,
        extension: 'png'
      });
      artifacts.waveform = {
        artifactId: waveformId,
        artifactUrl: `/api/media/ffmpeg/artifacts/${waveformId}`,
        mimeType: visualResult.waveform.mimeType,
        sizeBytes: visualResult.waveform.sizeBytes,
        resolution: visualResult.waveform.resolution
      };
    }

    if (visualResult.spectrogram && visualResult.spectrogram.path) {
      const spectrogramId = registerMediaArtifact({
        filePath: visualResult.spectrogram.path,
        mimeType: visualResult.spectrogram.mimeType,
        extension: 'png'
      });
      artifacts.spectrogram = {
        artifactId: spectrogramId,
        artifactUrl: `/api/media/ffmpeg/artifacts/${spectrogramId}`,
        mimeType: visualResult.spectrogram.mimeType,
        sizeBytes: visualResult.spectrogram.sizeBytes,
        resolution: visualResult.spectrogram.resolution
      };
    }

    if (visualResult.cleanupInputPath) {
      fs.promises.unlink(visualResult.cleanupInputPath).catch(() => {});
    }

    res.status(visualResult.applied ? 200 : 202).json({
      ok: visualResult.applied,
      artifacts,
      _pnf: {
        ffmpegVisual: metadata
      }
    });
  } catch (error) {
    sendInternalServerError(res, error, 'FFmpeg visualization request failed.');
  }
});

// Asset texture presets endpoint - serves CDN URLs with local fallback
app.get('/api/assets/texture-presets', (req, res) => {
  const CDN_BASE = 'https://saion-assets.nyc3.cdn.digitaloceanspaces.com/saion-folder/';
  const LOCAL_BASE = '/images/logos/';
  const THUMB_BASE = '/images/logos/thumbs/';

  const texturePresets = [
    {
      id: 'alternate',
      label: 'Alternate',
      thumbnailUrl: `${THUMB_BASE}Alternate.png`,
      textureUrl: `${CDN_BASE}Alternate%20.png`,
      textureUrlFallback: `${LOCAL_BASE}Alternate .png`
    },
    {
      id: 'atlantist',
      label: 'Atlantist',
      thumbnailUrl: `${THUMB_BASE}Atlantist.png`,
      textureUrl: `${CDN_BASE}Atlantist.png`,
      textureUrlFallback: `${LOCAL_BASE}Atlantist.png`
    },
    {
      id: 'bubble-lips',
      label: 'Bubble Lips',
      thumbnailUrl: `${THUMB_BASE}Bubble_LIps.png`,
      textureUrl: `${CDN_BASE}Bubble_LIps.png`,
      textureUrlFallback: `${LOCAL_BASE}Bubble_LIps.png`
    },
    {
      id: 'chicken-good',
      label: 'Chicken Good',
      thumbnailUrl: `${THUMB_BASE}Chicken_Good.jpeg`,
      textureUrl: `${CDN_BASE}Chicken_Good.jpeg`,
      textureUrlFallback: `${LOCAL_BASE}Chicken_Good.jpeg`
    },
    {
      id: 'red-kiss',
      label: 'Red Kiss',
      thumbnailUrl: `${THUMB_BASE}Red_Kiss.png`,
      textureUrl: `${CDN_BASE}Red_Kiss.png`,
      textureUrlFallback: `${LOCAL_BASE}Red_Kiss.png`
    },
    {
      id: 'saion',
      label: 'Saion',
      thumbnailUrl: `${THUMB_BASE}SAION.png`,
      textureUrl: `${CDN_BASE}SAION.png`,
      textureUrlFallback: `${LOCAL_BASE}SAION.png`
    },
    {
      id: 'saion-logo',
      label: 'Saion Logo',
      thumbnailUrl: `${THUMB_BASE}SAION_Logo.png`,
      textureUrl: `${CDN_BASE}SAION%20LOGO.png`,
      textureUrlFallback: `${LOCAL_BASE}SAION LOGO.png`
    },
    {
      id: 'saion-logo-variant',
      label: 'Saion Logo Variant',
      thumbnailUrl: `${THUMB_BASE}SAION.png`,
      textureUrl: `${CDN_BASE}SAION_Logo.png`,
      textureUrlFallback: `${LOCAL_BASE}SAION_Logo.png`
    },
    {
      id: 'shot-glass',
      label: 'Shot Glass',
      thumbnailUrl: `${THUMB_BASE}Shot_Glass.png`,
      textureUrl: `${CDN_BASE}Shot_Glass.png`,
      textureUrlFallback: `${LOCAL_BASE}Shot_Glass.png`
    },
    {
      id: 'shots',
      label: 'Shots',
      thumbnailUrl: `${THUMB_BASE}Shots.jpeg`,
      textureUrl: `${CDN_BASE}Shots.jpeg`,
      textureUrlFallback: `${LOCAL_BASE}Shots.jpeg`
    },
    {
      id: 'buttons',
      label: 'Buttons',
      thumbnailUrl: `${THUMB_BASE}buttons.png`,
      textureUrl: `${CDN_BASE}buttons.png`,
      textureUrlFallback: `${LOCAL_BASE}buttons.png`
    },
    {
      id: 'zero-one',
      label: 'Zero One',
      thumbnailUrl: `${THUMB_BASE}0_1.jpeg`,
      textureUrl: `${THUMB_BASE}0_1.jpeg`,
      textureUrlFallback: `${LOCAL_BASE}0_1.jpeg`
    }
  ];

  res.json({
    status: 'success',
    count: texturePresets.length,
    cdnBase: CDN_BASE,
    presets: texturePresets
  });
});

validateStartup();
ensureMySqlInit();

// Serve built GUI from gui/dist if present
const guiDist = path.join(__dirname, '..', 'gui', 'dist');
if (fs.existsSync(guiDist)) {
  app.use(express.static(guiDist));
  // SPA catch-all: serve index.html for any non-API route that doesn't have a file
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(guiDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  const ffmpegCfg = getFfmpegFeatureConfig();
  console.log(`FFmpeg feature: ${ffmpegCfg.enabled ? 'enabled' : 'disabled'} (phase 1)`);
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
  validateStartup,
  getFfmpegFeatureConfig,
  probeFfmpegBinary,
  getFfmpegCapabilities
};
