// src/config/validate-startup.js
// Validates environment and configuration on application startup.
// Call this once during app initialization.

const { loadEnv } = require('./env-loader');

function validateStartup() {
  console.log('🔐 Validating PNF-AIMS environment...');

  try {
    const config = loadEnv();
    console.log('✅ Environment validation passed.');
    console.log('   - Music provider: at least one key present (Suno or Mureka)');
    console.log('   - Voice provider: ElevenLabs key + voice ID present');
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
