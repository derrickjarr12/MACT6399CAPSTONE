# Provider API Keys Setup

This guide walks you through setting up secure provider API keys for PNF-AIMS.

## Step 1: Create .env File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

## Step 2: Get Your API Keys

### Suno AI

1. Go to [suno.ai](https://suno.ai)
2. Create an account or sign in
3. Navigate to API settings
4. Copy your API key
5. Paste into `.env`:

   ```env
   SUNO_API_KEY=your_actual_suno_key_here
   ```

### Mureka

1. Go to [murekastudio.com](https://murekastudio.com) or your Mureka provider
2. Create an account or sign in
3. Navigate to API settings
4. Copy your API key
5. Paste into `.env`:

   ```env
   MUREKA_API_KEY=your_actual_mureka_key_here
   MUREKA_BASE_URL=https://api.mureka.ai
   MUREKA_GENERATE_PATH=/v1/generate
   MUREKA_STATUS_PATH=/v1/jobs/{jobId}
   # Optional backups (comma-separated)
   MUREKA_GENERATE_PATH_BACKUPS=/v1/song/generate,/v1/music/generate
   MUREKA_STATUS_PATH_BACKUPS=/v1/job/{jobId},/v1/jobs/status?job_id={jobId}
   # If status path has no token, backend will append ?jobId=... by default
   MUREKA_STATUS_JOBID_QUERY_KEY=jobId
   ```

### ElevenLabs

1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Create an account or sign in
3. Go to Profile > API Keys
4. Copy your API key
5. Go to VoicesStudio and note a voice ID (or use default)
6. Paste into `.env`:

   ```env
   ELEVENLABS_API_KEY=your_actual_elevenlabs_key_here
   ELEVENLABS_VOICE_ID=default_voice_id_or_custom_voice_id
   ELEVENLABS_BASE_URL=https://api.elevenlabs.io
   # Use your async endpoint path(s) that return a provider job ID
   ELEVENLABS_GENERATE_PATH=/v1/your-async-generate-path
   ELEVENLABS_STATUS_PATH=/v1/your-status-path/{jobId}
   # Optional backups (comma-separated)
   ELEVENLABS_GENERATE_PATH_BACKUPS=/v1/your-backup-generate-path
   ELEVENLABS_STATUS_PATH_BACKUPS=/v1/your-backup-status-path?jobId={jobId}
   ELEVENLABS_STATUS_JOBID_QUERY_KEY=jobId
   ```

## Step 2.5: Path-First Behavior (What You Asked For)

- Generate and status endpoints now support **backup path fallback**.
- If the first path returns `404`, backend automatically tries the next configured path.
- Status path can use `{jobId}` or `:jobId` tokens.
- If no token exists, backend appends `?jobId=<value>` (or your configured query key).

## Step 2.6: Official Mureka MCP Server Option

Use this mode if you want MCP clients (Claude Desktop, OpenAI Agents, and others) to call Mureka through the official MCP server for lyrics, song, and background music workflows.

Recommended approach:

1. Keep existing direct API path settings as fallback.
2. Run the official Mureka MCP server in a separate process.
3. Connect your MCP client to that server.
4. Validate three operations: lyrics, song, and instrumental/BGM.
5. Record requestId and provider jobId from the MCP responses for status polling.

Operational note:

- Treat MCP as primary transport and direct HTTP paths as backup transport.
- Keep both path sets in `.env` so you can fail over quickly during demos.

## Step 2.7: Sure-Fire Demo Mode (Mureka + ElevenLabs Only)

If SUNO/UDIO are unstable, use this minimal reliable path:

```env
PREFERRED_PROVIDER=mureka
FALLBACK_PROVIDERS=elevenlabs
```

Then run proof commands:

```bash
npm run proof:mureka
npm run proof:elevenlabs
```

Both commands call your backend generate endpoint and poll status to terminal state.

## Step 2.8: Prompt-Only Test Mode (No External Requests)

If you want to test prompt flow without sending anything to Mureka/ElevenLabs, enable dry-run mode:

```env
PROVIDER_DRY_RUN=true
```

Behavior in this mode:

1. `/api/provider/generate` validates input and returns a mock `jobId`.
2. `/api/provider/status/:jobId` returns `completed` without provider polling.
3. Request records are still stored in app persistence (memory/MySQL), so UI/request tracing still works.

## Step 3: Verify Setup

Start your application. On startup, it will validate that all required keys are present and not placeholders.

If successful, you should see:

```text
🔐 Validating PNF-AIMS environment...
✅ All required environment variables loaded.
   - Suno API key: ✓
   - Mureka API key: ✓
   - ElevenLabs API key: ✓
   - ElevenLabs Voice ID: ✓
```

Then verify provider shape via health endpoints:

```bash
curl "http://localhost:3000/api/provider/health?generator=mureka"
curl "http://localhost:3000/api/provider/health?generator=elevenlabs"
```

Expected:

- `ok: true` when key + base URL + generate path + status path are present.
- Response includes non-secret config values (`baseUrl`, selected `generatePath`, selected `statusPathTemplate`).

If keys are missing or still placeholders, the app will fail with clear instructions.

## Security Best Practices

- ✅ **DO**: Store real keys only in `.env` (server-side)
- ✅ **DO**: Add `.env` to `.gitignore` (already done)
- ✅ **DO**: Use unique keys per provider
- ✅ **DO**: Rotate keys periodically
- ❌ **DON'T**: Commit `.env` to version control
- ❌ **DON'T**: Expose keys in frontend code or logs
- ❌ **DON'T**: Share keys in screenshots or documentation

## Optional Configuration

Edit `.env` to set optional values:

```env
# Preferred provider for fallback logic
PREFERRED_PROVIDER=suno

# Comma-separated fallback order
FALLBACK_PROVIDERS=mureka,elevenlabs

# Request timeout in milliseconds
PROVIDER_REQUEST_TIMEOUT=30000

# Enable debug logging (true/false)
PROVIDER_DEBUG=false

# Optional MySQL persistence for request/job tracking
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=pnf_aims
MYSQL_TABLE=pnf_request_jobs

# Optional MySQL pool size
MYSQL_CONNECTION_LIMIT=10

# Optional FFmpeg feature flags (backend-only)
FFMPEG_ENABLED=false
FFMPEG_BIN=ffmpeg
FFPROBE_BIN=ffprobe
FFMPEG_TIMEOUT_MS=8000

# Phase 2a ingest preprocessing
FFMPEG_INGEST_PREPROCESS_ENABLED=false
FFMPEG_INGEST_NORMALIZE=true
FFMPEG_INGEST_TRIM_SILENCE=false
FFMPEG_INGEST_SAMPLE_RATE=44100
FFMPEG_INGEST_CHANNELS=1

# Phase 2b postprocess export
FFMPEG_EXPORT_POSTPROCESS_ENABLED=false
FFMPEG_EXPORT_FORMAT=mp3
FFMPEG_EXPORT_BITRATE=192k
FFMPEG_MAX_INPUT_MB=30
```

## Troubleshooting

### Error: Missing required environment variables

- Ensure `.env` exists in the project root
- Verify all keys are filled in (not placeholder text)
- Check for typos in variable names

### Error: SUNO_API_KEY appears to be a placeholder

- The key still contains "your_" or is empty
- Replace with your actual API key from Suno

### Connection timeout

- Check your internet connection
- Verify the provider is online
- Increase `PROVIDER_REQUEST_TIMEOUT` if needed
