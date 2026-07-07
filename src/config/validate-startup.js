// src/config/validate-startup.js
// Validates environment and configuration on application startup.
// Call this once during app initialization.

const { loadEnv } = require('./env-loader');

function validateStartup() {
  console.log('🔐 Validating PNF-AIMS environment...');

  try {
    const config = loadEnv();
    console.log('✅ Environment validation passed.');
    console.log('   - Music provider: optional for startup (required when calling generation endpoints)');
    console.log('   - Voice provider: ElevenLabs optional (requires voice ID if key is set)');
    console.log(`   - Suno API key: ${config.SUNO_API_KEY ? '✓' : '✗'}`);
    console.log(`   - Mureka API key: ${config.MUREKA_API_KEY ? '✓' : '✗'}`);
    console.log(`   - ElevenLabs API key: ${config.ELEVENLABS_API_KEY ? '✓' : '✗'}`);
    console.log(`   - ElevenLabs Voice ID: ${config.ELEVENLABS_VOICE_ID ? '✓' : '✗'}`);
    return config;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  validateStartup
};

if (require.main === module) {
  validateStartup();
}
