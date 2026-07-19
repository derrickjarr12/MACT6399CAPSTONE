const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseImageSize(value, fallback) {
  const candidate = String(value || '').trim();
  return /^\d{2,5}x\d{2,5}$/i.test(candidate) ? candidate : fallback;
}

function getFfmpegFeatureConfig() {
  const enabled = parseBoolean(process.env.FFMPEG_ENABLED, false);
  const ffmpegBin = String(process.env.FFMPEG_BIN || 'ffmpeg').trim() || 'ffmpeg';
  const ffprobeBin = String(process.env.FFPROBE_BIN || 'ffprobe').trim() || 'ffprobe';
  const timeoutMsRaw = Number(process.env.FFMPEG_TIMEOUT_MS || 8000);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 8000;
  const ingestEnabled = parseBoolean(process.env.FFMPEG_INGEST_PREPROCESS_ENABLED, false);
  const ingestNormalize = parseBoolean(process.env.FFMPEG_INGEST_NORMALIZE, true);
  const ingestTrimSilence = parseBoolean(process.env.FFMPEG_INGEST_TRIM_SILENCE, false);
  const ingestSampleRateRaw = Number(process.env.FFMPEG_INGEST_SAMPLE_RATE || 44100);
  const ingestChannelsRaw = Number(process.env.FFMPEG_INGEST_CHANNELS || 1);
  const ingestSampleRate = Number.isFinite(ingestSampleRateRaw) && ingestSampleRateRaw >= 8000 ? ingestSampleRateRaw : 44100;
  const ingestChannels = Number.isFinite(ingestChannelsRaw) && ingestChannelsRaw >= 1 && ingestChannelsRaw <= 2 ? ingestChannelsRaw : 1;
  const exportEnabled = parseBoolean(process.env.FFMPEG_EXPORT_POSTPROCESS_ENABLED, false);
  const exportFormatRaw = String(process.env.FFMPEG_EXPORT_FORMAT || 'mp3').trim().toLowerCase();
  const exportFormat = ['mp3', 'wav', 'flac'].includes(exportFormatRaw) ? exportFormatRaw : 'mp3';
  const exportBitrate = String(process.env.FFMPEG_EXPORT_BITRATE || '192k').trim() || '192k';
  const maxInputMbRaw = Number(process.env.FFMPEG_MAX_INPUT_MB || 30);
  const maxInputMb = Number.isFinite(maxInputMbRaw) && maxInputMbRaw > 1 ? maxInputMbRaw : 30;
  const visualEnabled = parseBoolean(process.env.FFMPEG_VISUAL_ARTIFACTS_ENABLED, false);
  const visualWaveformEnabled = parseBoolean(process.env.FFMPEG_VISUAL_WAVEFORM_ENABLED, true);
  const visualSpectrogramEnabled = parseBoolean(process.env.FFMPEG_VISUAL_SPECTROGRAM_ENABLED, true);
  const waveformSize = parseImageSize(process.env.FFMPEG_WAVEFORM_SIZE, '1200x240');
  const spectrogramSize = parseImageSize(process.env.FFMPEG_SPECTROGRAM_SIZE, '1280x720');

  return {
    enabled,
    ffmpegBin,
    ffprobeBin,
    timeoutMs,
    maxInputMb,
    ingest: {
      enabled: ingestEnabled,
      normalize: ingestNormalize,
      trimSilence: ingestTrimSilence,
      sampleRate: ingestSampleRate,
      channels: ingestChannels
    },
    export: {
      enabled: exportEnabled,
      format: exportFormat,
      bitrate: exportBitrate
    },
    visual: {
      enabled: visualEnabled,
      waveformEnabled: visualWaveformEnabled,
      spectrogramEnabled: visualSpectrogramEnabled,
      waveformSize,
      spectrogramSize
    }
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

function runFfmpegCommand(binary, args, timeoutMs) {
  return new Promise((resolve) => {
    let stderr = '';
    const child = spawn(binary, args, {
      stdio: ['ignore', 'ignore', 'pipe']
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, error: 'timeout' });
    }, timeoutMs);

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

      resolve({ ok: true });
    });
  });
}

function parseDataAudioUri(dataUri) {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:audio/')) return null;

  const parts = dataUri.split(',', 2);
  if (parts.length !== 2) return null;

  const [meta, dataPart] = parts;
  const mimeMatch = meta.match(/^data:([^;,]+)(;base64)?/i);
  if (!mimeMatch) return null;

  const mimeType = String(mimeMatch[1] || 'audio/wav').toLowerCase();
  const isBase64 = meta.includes(';base64');
  const buffer = isBase64
    ? Buffer.from(dataPart, 'base64')
    : Buffer.from(decodeURIComponent(dataPart), 'utf8');

  return {
    mimeType,
    buffer
  };
}

function mimeToExtension(mimeType) {
  if (!mimeType) return 'bin';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('wav') || mimeType.includes('x-wav')) return 'wav';
  if (mimeType.includes('flac')) return 'flac';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  return 'bin';
}

function extensionToMime(extension) {
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'flac') return 'audio/flac';
  if (extension === 'png') return 'image/png';
  return 'application/octet-stream';
}

function buildWavDataUri(buffer) {
  return `data:audio/wav;base64,${buffer.toString('base64')}`;
}

function resolveIngestSourceKey(payload) {
  const keys = ['sourceAudioData', 'source_audio_data', 'inputAudioData', 'input_audio_data'];
  for (const key of keys) {
    if (typeof payload[key] === 'string' && payload[key].startsWith('data:audio/')) {
      return key;
    }
  }
  return null;
}

async function preprocessSourceAudioPayload(payload = {}) {
  const cfg = getFfmpegFeatureConfig();
  const response = {
    applied: false,
    skipped: true,
    reason: 'ffmpeg_ingest_disabled',
    payload
  };

  if (!cfg.enabled || !cfg.ingest.enabled) {
    return response;
  }

  const sourceKey = resolveIngestSourceKey(payload);
  if (!sourceKey) {
    return {
      ...response,
      reason: 'no_data_audio_source_found'
    };
  }

  const parsed = parseDataAudioUri(payload[sourceKey]);
  if (!parsed) {
    return {
      ...response,
      reason: 'invalid_data_audio_uri'
    };
  }

  const tmpPrefix = `saion-ffmpeg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const inputExt = mimeToExtension(parsed.mimeType);
  const inputPath = path.join(os.tmpdir(), `${tmpPrefix}-input.${inputExt}`);
  const outputPath = path.join(os.tmpdir(), `${tmpPrefix}-output.wav`);

  try {
    await fs.writeFile(inputPath, parsed.buffer);

    const filters = [];
    if (cfg.ingest.normalize) {
      filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    }
    if (cfg.ingest.trimSilence) {
      filters.push('silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=1:stop_duration=0.2:stop_threshold=-50dB');
    }

    const args = ['-y', '-i', inputPath, '-vn'];
    if (filters.length > 0) {
      args.push('-af', filters.join(','));
    }
    args.push(
      '-ac', String(cfg.ingest.channels),
      '-ar', String(cfg.ingest.sampleRate),
      '-c:a', 'pcm_s16le',
      outputPath
    );

    const run = await runFfmpegCommand(cfg.ffmpegBin, args, cfg.timeoutMs);
    if (!run.ok) {
      return {
        ...response,
        reason: 'ffmpeg_process_failed',
        error: run.error
      };
    }

    const converted = await fs.readFile(outputPath);
    const nextPayload = {
      ...payload,
      [sourceKey]: buildWavDataUri(converted),
      sourceAudioFormat: 'wav',
      inputAudioFormat: 'wav'
    };

    return {
      applied: true,
      skipped: false,
      reason: 'converted_to_wav',
      sourceKey,
      originalMimeType: parsed.mimeType,
      outputMimeType: 'audio/wav',
      outputSampleRate: cfg.ingest.sampleRate,
      outputChannels: cfg.ingest.channels,
      filters,
      payload: nextPayload
    };
  } catch (error) {
    return {
      ...response,
      reason: 'ffmpeg_preprocess_exception',
      error: error.message
    };
  } finally {
    await fs.rm(inputPath, { force: true }).catch(() => {});
    await fs.rm(outputPath, { force: true }).catch(() => {});
  }
}

async function downloadAudioUrlToBuffer(sourceUrl, maxBytes, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(sourceUrl, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, error: `download_failed_${response.status}` };
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength && contentLength > maxBytes) {
      return { ok: false, error: 'source_too_large' };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > maxBytes) {
      return { ok: false, error: 'source_too_large' };
    }

    const mimeType = String(response.headers.get('content-type') || 'audio/mpeg').toLowerCase();
    return { ok: true, buffer, mimeType };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function postprocessGeneratedAudioExport(sourceAudio) {
  const cfg = getFfmpegFeatureConfig();
  const response = {
    applied: false,
    skipped: true,
    reason: 'ffmpeg_export_disabled'
  };

  if (!cfg.enabled || !cfg.export.enabled) {
    return response;
  }

  if (typeof sourceAudio !== 'string' || !sourceAudio.trim()) {
    return {
      ...response,
      reason: 'no_source_audio_url'
    };
  }

  const source = sourceAudio.trim();
  let parsed;
  let sourceType = 'unknown';
  const maxBytes = Math.floor(cfg.maxInputMb * 1024 * 1024);

  if (source.startsWith('data:audio/')) {
    parsed = parseDataAudioUri(source);
    sourceType = 'data_uri';
    if (!parsed) {
      return {
        ...response,
        reason: 'invalid_data_audio_uri'
      };
    }
  } else if (source.startsWith('http://') || source.startsWith('https://')) {
    const downloaded = await downloadAudioUrlToBuffer(source, maxBytes, cfg.timeoutMs);
    sourceType = 'remote_url';
    if (!downloaded.ok) {
      return {
        ...response,
        reason: 'source_download_failed',
        error: downloaded.error
      };
    }
    parsed = {
      mimeType: downloaded.mimeType,
      buffer: downloaded.buffer
    };
  } else {
    return {
      ...response,
      reason: 'unsupported_source_type'
    };
  }

  const tmpPrefix = `saion-ffmpeg-export-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const inputExt = mimeToExtension(parsed.mimeType);
  const outputExt = cfg.export.format;
  const inputPath = path.join(os.tmpdir(), `${tmpPrefix}-input.${inputExt}`);
  const outputPath = path.join(os.tmpdir(), `${tmpPrefix}-output.${outputExt}`);

  try {
    await fs.writeFile(inputPath, parsed.buffer);

    const args = ['-y', '-i', inputPath, '-vn'];
    if (outputExt === 'mp3') {
      args.push('-codec:a', 'libmp3lame', '-b:a', cfg.export.bitrate);
    } else if (outputExt === 'wav') {
      args.push('-codec:a', 'pcm_s16le');
    } else if (outputExt === 'flac') {
      args.push('-codec:a', 'flac');
    }
    args.push(outputPath);

    const run = await runFfmpegCommand(cfg.ffmpegBin, args, cfg.timeoutMs);
    if (!run.ok) {
      return {
        ...response,
        reason: 'ffmpeg_export_failed',
        error: run.error
      };
    }

    const stats = await fs.stat(outputPath);
    return {
      applied: true,
      skipped: false,
      reason: 'export_transcoded',
      sourceType,
      sourceMimeType: parsed.mimeType,
      outputFormat: outputExt,
      outputMimeType: extensionToMime(outputExt),
      outputPath,
      outputSizeBytes: stats.size,
      cleanupInputPath: inputPath
    };
  } catch (error) {
    return {
      ...response,
      reason: 'ffmpeg_export_exception',
      error: error.message
    };
  }
}

async function generateAudioVisualArtifacts(sourceAudio) {
  const cfg = getFfmpegFeatureConfig();
  const response = {
    applied: false,
    skipped: true,
    reason: 'ffmpeg_visual_artifacts_disabled'
  };

  if (!cfg.enabled || !cfg.visual.enabled) {
    return response;
  }

  if (typeof sourceAudio !== 'string' || !sourceAudio.trim()) {
    return {
      ...response,
      reason: 'no_source_audio_url'
    };
  }

  const source = sourceAudio.trim();
  let parsed;
  let sourceType = 'unknown';
  const maxBytes = Math.floor(cfg.maxInputMb * 1024 * 1024);

  if (source.startsWith('data:audio/')) {
    parsed = parseDataAudioUri(source);
    sourceType = 'data_uri';
    if (!parsed) {
      return {
        ...response,
        reason: 'invalid_data_audio_uri'
      };
    }
  } else if (source.startsWith('http://') || source.startsWith('https://')) {
    const downloaded = await downloadAudioUrlToBuffer(source, maxBytes, cfg.timeoutMs);
    sourceType = 'remote_url';
    if (!downloaded.ok) {
      return {
        ...response,
        reason: 'source_download_failed',
        error: downloaded.error
      };
    }
    parsed = {
      mimeType: downloaded.mimeType,
      buffer: downloaded.buffer
    };
  } else {
    return {
      ...response,
      reason: 'unsupported_source_type'
    };
  }

  const tmpPrefix = `saion-ffmpeg-visual-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const inputExt = mimeToExtension(parsed.mimeType);
  const inputPath = path.join(os.tmpdir(), `${tmpPrefix}-input.${inputExt}`);
  const waveformPath = path.join(os.tmpdir(), `${tmpPrefix}-waveform.png`);
  const spectrogramPath = path.join(os.tmpdir(), `${tmpPrefix}-spectrogram.png`);

  try {
    await fs.writeFile(inputPath, parsed.buffer);

    let waveform = null;
    let spectrogram = null;

    if (cfg.visual.waveformEnabled) {
      const waveformArgs = [
        '-y',
        '-i', inputPath,
        '-filter_complex', `aformat=channel_layouts=mono,showwavespic=s=${cfg.visual.waveformSize}:colors=0x4fdcff`,
        '-frames:v', '1',
        waveformPath
      ];
      const waveformRun = await runFfmpegCommand(cfg.ffmpegBin, waveformArgs, cfg.timeoutMs);
      if (waveformRun.ok) {
        const stats = await fs.stat(waveformPath);
        waveform = {
          path: waveformPath,
          mimeType: 'image/png',
          sizeBytes: stats.size,
          resolution: cfg.visual.waveformSize
        };
      }
    }

    if (cfg.visual.spectrogramEnabled) {
      const spectrogramArgs = [
        '-y',
        '-i', inputPath,
        '-lavfi', `showspectrumpic=s=${cfg.visual.spectrogramSize}:legend=disabled:color=rainbow`,
        '-frames:v', '1',
        spectrogramPath
      ];
      const spectrogramRun = await runFfmpegCommand(cfg.ffmpegBin, spectrogramArgs, cfg.timeoutMs);
      if (spectrogramRun.ok) {
        const stats = await fs.stat(spectrogramPath);
        spectrogram = {
          path: spectrogramPath,
          mimeType: 'image/png',
          sizeBytes: stats.size,
          resolution: cfg.visual.spectrogramSize
        };
      }
    }

    if (!waveform && !spectrogram) {
      return {
        ...response,
        reason: 'ffmpeg_visual_generation_failed'
      };
    }

    return {
      applied: true,
      skipped: false,
      reason: 'visual_artifacts_generated',
      sourceType,
      sourceMimeType: parsed.mimeType,
      waveform,
      spectrogram,
      cleanupInputPath: inputPath
    };
  } catch (error) {
    return {
      ...response,
      reason: 'ffmpeg_visual_exception',
      error: error.message
    };
  }
}

function getFfmpegCapabilities() {
  const cfg = getFfmpegFeatureConfig();
  return {
    conversion: ['mp3', 'wav', 'flac'],
    processing: ['normalize_loudness', 'trim_silence', 'join_audio', 'compress_exports'],
    analysisArtifacts: ['spectrogram', 'waveform_image'],
    advanced: ['stem_split'],
    phase2a: {
      ingestPreprocessEnabled: cfg.enabled && cfg.ingest.enabled,
      ingestNormalize: cfg.ingest.normalize,
      ingestTrimSilence: cfg.ingest.trimSilence,
      ingestSampleRate: cfg.ingest.sampleRate,
      ingestChannels: cfg.ingest.channels
    },
    phase2b: {
      exportPostprocessEnabled: cfg.enabled && cfg.export.enabled,
      exportFormat: cfg.export.format,
      exportBitrate: cfg.export.bitrate
    },
    phase2c: {
      visualArtifactsEnabled: cfg.enabled && cfg.visual.enabled,
      waveformEnabled: cfg.visual.waveformEnabled,
      spectrogramEnabled: cfg.visual.spectrogramEnabled,
      waveformSize: cfg.visual.waveformSize,
      spectrogramSize: cfg.visual.spectrogramSize
    }
  };
}

module.exports = {
  getFfmpegFeatureConfig,
  probeFfmpegBinary,
  getFfmpegCapabilities,
  preprocessSourceAudioPayload,
  postprocessGeneratedAudioExport,
  generateAudioVisualArtifacts
};
