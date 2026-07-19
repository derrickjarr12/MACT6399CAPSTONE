const { spawn } = require('child_process');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function getFfmpegFeatureConfig() {
  const enabled = parseBoolean(process.env.FFMPEG_ENABLED, false);
  const ffmpegBin = String(process.env.FFMPEG_BIN || 'ffmpeg').trim() || 'ffmpeg';
  const ffprobeBin = String(process.env.FFPROBE_BIN || 'ffprobe').trim() || 'ffprobe';
  const timeoutMsRaw = Number(process.env.FFMPEG_TIMEOUT_MS || 8000);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 8000;

  return {
    enabled,
    ffmpegBin,
    ffprobeBin,
    timeoutMs
  };
}

function runBinaryVersion(binary, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(binary, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, error: 'timeout' });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ ok: false, error: stderr.trim() || `exit ${code}` });
        return;
      }

      const firstLine = stdout.split('\n').map((line) => line.trim()).find(Boolean) || '';
      resolve({ ok: true, versionLine: firstLine });
    });
  });
}

async function probeFfmpegBinary() {
  const cfg = getFfmpegFeatureConfig();
  const ffmpeg = await runBinaryVersion(cfg.ffmpegBin, cfg.timeoutMs);
  const ffprobe = await runBinaryVersion(cfg.ffprobeBin, cfg.timeoutMs);

  return {
    enabled: cfg.enabled,
    binaries: {
      ffmpeg: {
        command: cfg.ffmpegBin,
        ok: ffmpeg.ok,
        versionLine: ffmpeg.versionLine || null,
        error: ffmpeg.error || null
      },
      ffprobe: {
        command: cfg.ffprobeBin,
        ok: ffprobe.ok,
        versionLine: ffprobe.versionLine || null,
        error: ffprobe.error || null
      }
    }
  };
}

function getFfmpegCapabilities() {
  // Phase 1 reports planned capabilities without activating route-level processing yet.
  return {
    conversion: ['mp3', 'wav', 'flac'],
    processing: ['normalize_loudness', 'trim_silence', 'join_audio', 'compress_exports'],
    analysisArtifacts: ['spectrogram', 'waveform_image'],
    advanced: ['stem_split']
  };
}

module.exports = {
  getFfmpegFeatureConfig,
  probeFfmpegBinary,
  getFfmpegCapabilities
};
