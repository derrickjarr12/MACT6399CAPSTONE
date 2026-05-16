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
   ```
   SUNO_API_KEY=your_actual_suno_key_here
   ```

### Mureka

1. Go to [murekastudio.com](https://murekastudio.com) or your Mureka provider
2. Create an account or sign in
3. Navigate to API settings
4. Copy your API key
5. Paste into `.env`:
   ```
   MUREKA_API_KEY=your_actual_mureka_key_here
   ```

### ElevenLabs

1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Create an account or sign in
3. Go to Profile > API Keys
4. Copy your API key
5. Go to VoicesStudio and note a voice ID (or use default)
6. Paste into `.env`:
   ```
   ELEVENLABS_API_KEY=your_actual_elevenlabs_key_here
   ELEVENLABS_VOICE_ID=default_voice_id_or_custom_voice_id
   ```

## Step 3: Verify Setup

Start your application. On startup, it will validate that all required keys are present and not placeholders.

If successful, you should see:
```
🔐 Validating PNF-AIMS environment...
✅ All required environment variables loaded.
   - Suno API key: ✓
   - Mureka API key: ✓
   - ElevenLabs API key: ✓
   - ElevenLabs Voice ID: ✓
```

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

```
# Preferred provider for fallback logic
PREFERRED_PROVIDER=suno

# Comma-separated fallback order
FALLBACK_PROVIDERS=mureka,elevenlabs

# Request timeout in milliseconds
PROVIDER_REQUEST_TIMEOUT=30000

# Enable debug logging (true/false)
PROVIDER_DEBUG=false
```

## Troubleshooting

**Error: Missing required environment variables**
- Ensure `.env` exists in the project root
- Verify all keys are filled in (not placeholder text)
- Check for typos in variable names

**Error: SUNO_API_KEY appears to be a placeholder**
- The key still contains "your_" or is empty
- Replace with your actual API key from Suno

**Connection timeout**
- Check your internet connection
- Verify the provider is online
- Increase `PROVIDER_REQUEST_TIMEOUT` if needed
