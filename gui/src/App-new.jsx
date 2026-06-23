import './styles-match.css';
import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { Howl, Howler } from "howler";
import ThreeGearDial from "./ThreeGearDial";
import GyroscopicDial, { AMBER } from "./GyroscopicDial";
import saionLogo from "../images/logos/SAION.png";
const HolographicGlobe = lazy(() => import("./HolographicGlobe"));

function CornerDial({ value, onChange, color, label, style }) {
  // color: 'blue' | 'yellow' | 'orange'
  const accent = color === 'blue' ? '#4fdcff' : color === 'yellow' ? '#ffe066' : '#ffb347';
  return (
    <div className="corner-dial" style={style}>
      <ThreeGearDial
        value={value}
        variant="vocal"
        onChange={onChange}
      />
      <span className="corner-dial-label" style={{ color: accent }}>{label}</span>
    </div>
  );
}
function angleToDialValue(degrees) {
  let normalized = degrees % 360;
  if (normalized < 0) normalized += 360;
  return Math.max(0, Math.min(100, (normalized / 360) * 100));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rangeLabel(value, low, mid, high) {
  if (value <= 33) return low;
  if (value <= 66) return mid;
  return high;
}

function weightedParentScore(mainValue, modifierValues) {
  const safeMain = Number(mainValue) || 0;
  const safeModifiers = modifierValues.map((value) => Number(value) || 0);
  const modifierAverage = safeModifiers.length
    ? safeModifiers.reduce((sum, value) => sum + value, 0) / safeModifiers.length
    : 0;
  return clampPercent(safeMain * 0.7 + modifierAverage * 0.3);
}

function sciFiBarColor(value) {
  const clamped = clampPercent(value);
  const hue = 195 - (clamped / 100) * 165;
  return `hsl(${hue} 96% 56%)`;
}

function extractAudioUrl(payload) {
  if (!payload || typeof payload !== "object") return "";

  const directKeys = [
    "audioUrl",
    "audio_url",
    "url",
    "trackUrl",
    "track_url",
    "outputUrl",
    "output_url"
  ];

  for (const key of directKeys) {
    if (typeof payload[key] === "string" && payload[key].startsWith("http")) {
      return payload[key];
    }
  }

  const arrayKeys = ["audioUrls", "audio_urls", "tracks", "outputs", "artifacts"];
  for (const key of arrayKeys) {
    if (!Array.isArray(payload[key]) || payload[key].length === 0) continue;
    const item = payload[key][0];
    if (typeof item === "string" && item.startsWith("http")) return item;
    if (item && typeof item === "object") {
      const nested = extractAudioUrl(item);
      if (nested) return nested;
    }
  }

  const nestedKeys = ["data", "result", "job", "response", "output"];
  for (const key of nestedKeys) {
    if (payload[key] && typeof payload[key] === "object") {
      const nested = extractAudioUrl(payload[key]);
      if (nested) return nested;
    }
  }

  return "";
}

function extractJobId(payload) {
  if (!payload || typeof payload !== "object") return "";
  const keys = ["jobId", "job_id", "id", "taskId", "task_id"];
  for (const key of keys) {
    if (typeof payload[key] === "string" && payload[key].trim()) return payload[key];
  }
  if (payload.data && typeof payload.data === "object") return extractJobId(payload.data);
  if (payload.result && typeof payload.result === "object") return extractJobId(payload.result);
  return "";
}

function isSuccessStatus(payload) {
  const raw = payload?.status || payload?.state || payload?.jobStatus || payload?.job_status;
  if (!raw || typeof raw !== "string") return false;
  return ["succeeded", "completed", "success", "done", "finished"].includes(raw.toLowerCase());
}

function isFailureStatus(payload) {
  const raw = payload?.status || payload?.state || payload?.jobStatus || payload?.job_status;
  if (!raw || typeof raw !== "string") return false;
  return ["failed", "error", "cancelled", "canceled"].includes(raw.toLowerCase());
}

function buildNotation(settings, context, fxControls) {
  const vocalDelivery = settings.vocal.delivery ?? settings.vocal.texture;
  return [
    `[PERFORMANCE]: BPM:${context.tempo} TSIG:${context.timeSignature}`,
    `EMOTION:${context.emotionPreset}`,
    `VOCAL:${context.vocalPreset}`,
    `VDEL:${vocalDelivery}`,
    `INT:${settings.emotion.intensity}`,
    `VULN:${settings.emotion.vulnerability}`,
    `CONF:${settings.emotion.confidence}`,
    `TENS:${settings.emotion.tension}`,
    `TEXT:${settings.vocal.texture}`,
    `STATE:${settings.vocal.performanceState}`,
    `BREATH:${settings.vocal.breath}`,
    `RASP:${settings.vocal.rasp}`,
    `RUNS:${settings.vocal.runs}`,
    `TIMING:${settings.vocal.timing}`,
    `WARMTH:${settings.vocal.warmth}`,
    `RELEASE:${settings.vocal.release}`,
    `FX_REVERB:${fxControls.reverb}`,
    `FX_EQ:${fxControls.eq}`,
    `FX_COMPRESSION:${fxControls.compression}`,
    `FX_DELAY:${fxControls.delay}`
  ].join("\n");
}

function buildPrompt(settings, context, fxControls) {
  const vocalDelivery = settings.vocal.delivery ?? settings.vocal.texture;
  const intensityText = rangeLabel(settings.emotion.intensity, "subdued", "balanced", "charged");
  const vulnerabilityText = rangeLabel(settings.emotion.vulnerability, "guarded", "open", "exposed");
  const confidenceText = rangeLabel(settings.emotion.confidence, "uncertain", "steady", "assured");
  const deliveryText = rangeLabel(vocalDelivery, "gentle", "controlled", "driving");
  const textureText = rangeLabel(settings.vocal.texture, "smooth", "textured", "raspy");
  const timingText = rangeLabel(settings.vocal.timing, "tight", "centered", "laid-back");

  return [
    `Generate a ${context.emotionPreset.toLowerCase()} / ${context.vocalPreset.toLowerCase()} performance at ${context.tempo} BPM in ${context.timeSignature}.`,
    `Delivery should feel ${intensityText}, ${vulnerabilityText}, and ${confidenceText}.`,
    `Overall vocal delivery should be ${deliveryText}.`,
    `Voice should be ${textureText} with breath:${settings.vocal.breath}, rasp:${settings.vocal.rasp}, runs:${settings.vocal.runs}.`,
    `Phrase timing should be ${timingText} with release:${settings.vocal.release} and warmth:${settings.vocal.warmth}.`,
    `Apply polish FX during rendering: reverb ${fxControls.reverb}%, EQ ${fxControls.eq}%, compression ${fxControls.compression}%, delay ${fxControls.delay}%.`,
    "Preserve lyrical clarity and produce a performance-ready render."
  ].join(" ");
}

function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function detectAudioFormat(file) {
  const mimeSubtype = file?.type?.startsWith("audio/")
    ? file.type.slice("audio/".length).split(";")[0].toLowerCase()
    : "";

  if (mimeSubtype) {
    if (mimeSubtype === "mpeg") return "mp3";
    if (mimeSubtype === "mp4") return "m4a";
    if (mimeSubtype === "x-wav" || mimeSubtype === "wav") return "wav";
    return mimeSubtype;
  }

  const extension = file?.name?.split(".").pop()?.toLowerCase() || "";
  if (!extension) return "";
  if (extension === "mpeg") return "mp3";
  if (extension === "aif") return "aiff";
  return extension;
}

function createImpulseResponse(audioCtx, seconds = 1.8, decay = 2.4) {
  const sampleRate = audioCtx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const impulse = audioCtx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const envelope = Math.pow(1 - i / length, decay);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return impulse;
}

function createRaspCurve(amount = 0) {
  const clamped = Math.max(0, Math.min(1, amount));
  const drive = 1 + clamped * 14;
  const samples = 2048;
  const curve = new Float32Array(samples);

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }

  return curve;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read audio file."));
    reader.readAsDataURL(file);
  });
}

function isAudioDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:audio/");
}

function dataUrlToObjectUrl(dataUrl) {
  if (!isAudioDataUrl(dataUrl)) return "";
  try {
    const [header, payload] = dataUrl.split(",", 2);
    if (!header || !payload) return "";
    const mimeMatch = header.match(/^data:([^;,]+)(;base64)?/i);
    const mimeType = mimeMatch?.[1] || "audio/wav";

    let bytes;
    if (header.includes(";base64")) {
      const binary = atob(payload);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }

    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  } catch (_) {
    return "";
  }
}

function MiniDial({ value, label, variant = "emotion", onChange, step = 1 }) {
  const isVocal = variant === "vocal";
  const currentValue = value || 0;
  const activePointerIdRef = useRef(null);
  const levelRingRadius = 32;
  const levelRingCircumference = 2 * Math.PI * levelRingRadius;
  const levelStrokeOffset = levelRingCircumference * (1 - currentValue / 100);
  const levelColor = isVocal
    ? `hsl(192 96% ${36 + currentValue * 0.34}%)`
    : `hsl(${35 - currentValue * 0.22} 95% ${38 + currentValue * 0.3}%)`;
  const levelFillOpacity = 0.14 + currentValue * 0.0046;

  const updateFromPointer = (event) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI + 90;
    const rawValue = angleToDialValue(angle);
    const snappedValue = Math.round(rawValue / step) * step;
    onChange(Math.max(0, Math.min(100, Number(snappedValue.toFixed(2)))));
  };

  const handlePointerDown = (event) => {
    updateFromPointer(event);
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    updateFromPointer(event);
  };

  const handlePointerUp = (event) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(Math.max(0, Number((currentValue - step).toFixed(2))));
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(Math.min(100, Number((currentValue + step).toFixed(2))));
    }

    if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      onChange(100);
    }
  };

  return (
    <div className="sub-dial">
      <svg
        viewBox="0 0 100 100"
        className="sub-dial-face"
        role="slider"
        tabIndex={0}
        aria-label={`${label} dial`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={currentValue}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <circle cx="50" cy="50" r="40" className={isVocal ? "sub-dial-bg vocal" : "sub-dial-bg"} />
        <circle
          cx="50"
          cy="50"
          r="26"
          className={isVocal ? "sub-level-core vocal" : "sub-level-core"}
          style={{ fill: levelColor, opacity: levelFillOpacity }}
        />
        <circle cx="50" cy="50" r="35" className={isVocal ? "sub-dial-ring vocal" : "sub-dial-ring"} />
        <circle
          cx="50"
          cy="50"
          r={levelRingRadius}
          className="sub-level-track"
        />
        <circle
          cx="50"
          cy="50"
          r={levelRingRadius}
          className="sub-level-progress"
          style={{
            stroke: levelColor,
            strokeDasharray: levelRingCircumference,
            strokeDashoffset: levelStrokeOffset
          }}
          transform="rotate(-90 50 50)"
        />
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * 360 - 90;
          const x1 = 50 + 20 * Math.cos((angle * Math.PI) / 180);
          const y1 = 50 + 20 * Math.sin((angle * Math.PI) / 180);
          const x2 = 50 + 31 * Math.cos((angle * Math.PI) / 180);
          const y2 = 50 + 31 * Math.sin((angle * Math.PI) / 180);
          return <line key={`${label}-tooth-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className={isVocal ? "mini-gear-tooth vocal" : "mini-gear-tooth"} />;
        })}
        <g transform={`rotate(${currentValue * 3.6} 50 50)`}>
          <line x1="50" y1="15" x2="50" y2="25" className={isVocal ? "sub-pointer vocal" : "sub-pointer"} strokeWidth="2" />
        </g>
        <circle cx="50" cy="50" r="12" className={isVocal ? "sub-center vocal" : "sub-center"} />
        <text
          x="50"
          y="54"
          textAnchor="middle"
          className="sub-level-value"
          style={{ fill: levelColor }}
        >
          {Math.round(currentValue)}
        </text>
      </svg>
      <label>{label}</label>
    </div>
  );
}

const EMOTION_PARAMS = {
  intensity: { label: "Intensity", low: "Subdued", high: "Intense" },
  vulnerability: { label: "Vulnerability", low: "Guarded", high: "Exposed" },
  confidence: { label: "Confidence", low: "Uncertain", high: "Assured" },
  tension: { label: "Tension", low: "Relaxed", high: "Tense" }
};

const VOCAL_PARAMS = {
  texture: { label: "Texture", low: "Smooth", high: "Raspy" },
  performanceState: { label: "State", low: "Restrained", high: "Free" },
  breath: { label: "Breath", low: "Controlled", high: "Open" },
  rasp: { label: "Rasp", low: "Clean", high: "Rough" },
  runs: { label: "Runs", low: "Minimal", high: "Elaborate" },
  timing: { label: "Timing", low: "Tight", high: "Laid-back" },
  warmth: { label: "Warmth", low: "Cold", high: "Warm" },
  release: { label: "Release", low: "Clipped", high: "Extended" }
};

const SUB_DIAL_PARAMS = {
  emotion: [
    { key: "warmth", label: "WARMTH" },
    { key: "tension", label: "TENSION" },
    { key: "release", label: "RELEASE" }
  ],
  vocal: [
    { key: "texture", label: "TEXTURE" },
    { key: "performanceState", label: "PERFORMANCE STATE" },
    { key: "breath", label: "BREATH" },
    { key: "rasp", label: "RASP" },
    { key: "runs", label: "RUNS" },
    { key: "timing", label: "TIMING" },
    { key: "warmth", label: "WARMTH" },
    { key: "release", label: "RELEASE" }
  ]
};

const INITIAL_SETTINGS = {
  emotion: {
    intensity: 68,
    vulnerability: 45,
    confidence: 55,
    tension: 34
  },
  vocal: {
    delivery: 58,
    texture: 55,
    performanceState: 62,
    breath: 62,
    rasp: 28,
    runs: 45,
    timing: 73,
    warmth: 72,
    release: 63
  }
};

const INITIAL_FX_CONTROLS = {
  reverb: 42,
  eq: 50,
  compression: 38,
  delay: 29
};

const FX_CONTROL_PARAMS = [
  { key: "reverb", label: "Reverb" },
  { key: "eq", label: "EQ" },
  { key: "compression", label: "Compression" },
  { key: "delay", label: "Delay" }
];

export default function App() {
  const [generator, setGenerator] = useState("Suno");
  const [vocalDetailLevel, setVocalDetailLevel] = useState("Balanced");
  const [harmonyStyle, setHarmonyStyle] = useState("Soft Layered");
  const [sessionTitle, setSessionTitle] = useState("Song Idea 1");
  const [navTab, setNavTab] = useState("PERFORMANCE");
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [versionA, setVersionA] = useState(INITIAL_SETTINGS);
  const [versionB, setVersionB] = useState(INITIAL_SETTINGS);
  const [activeVersion, setActiveVersion] = useState("A");
  const [tempo, setTempo] = useState(120);
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [emotionPreset, setEmotionPreset] = useState("LONGING");
  const [vocalPreset, setVocalPreset] = useState("SOULFUL");
  const [volume, setVolume] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [transportStatus, setTransportStatus] = useState("IDLE");
  const [waveformSeed, setWaveformSeed] = useState(1);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [savedState, setSavedState] = useState("NOT SAVED");
  const [originalPrompt, setOriginalPrompt] = useState(
    "Original idea prompt: soulful modern R&B with intimate vocal dynamics and emotional phrasing."
  );
  const [beforeAudio, setBeforeAudio] = useState("");
  const [afterAudio, setAfterAudio] = useState("");
  const [beforeAudioFileName, setBeforeAudioFileName] = useState("");
  const [afterAudioFileName, setAfterAudioFileName] = useState("");
  const [beforeAudioFormat, setBeforeAudioFormat] = useState("");
  const [afterAudioFormat, setAfterAudioFormat] = useState("");
  const [beforeAudioDataUrl, setBeforeAudioDataUrl] = useState("");
  const [savedSessions, setSavedSessions] = useState([]);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState("-1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [localPreviewOnly, setLocalPreviewOnly] = useState(false);
  const [activeAudioIndex, setActiveAudioIndex] = useState(0);
  const [fxControls, setFxControls] = useState(INITIAL_FX_CONTROLS);
  const [coreSyncEnabled, setCoreSyncEnabled] = useState(false);
  const [coreDials, setCoreDials] = useState({
    harmony: 74,
    rhythm: 63,
    dynamics: 71
  });
  const howlRef = useRef(null);
  const beforeAudioFileInputRef = useRef(null);
  const afterAudioFileInputRef = useRef(null);
  const localAudioUrlsRef = useRef({ before: "", after: "" });
  const analyserRef = useRef(null);
  const fxNodesRef = useRef(null);
  const fftRef = useRef(new Uint8Array(128));
  const audioEnvelopeRef = useRef({ drive: 0.3, bass: 0.3, treble: 0.3, distortion: 0.3 });
  const prevSpectrumRef = useRef(new Uint8Array(128));
  const globeRafRef = useRef(null);
  const [waveformDragOver, setWaveformDragOver] = useState(false);
  const [globeAudio, setGlobeAudio] = useState({ drive: 0.3, bass: 0.3, treble: 0.3, distortion: 0.3 });
  const [insideView, setInsideView] = useState(false);
  const [chaosSensitivity, setChaosSensitivity] = useState(67);
  const [reformSpeed, setReformSpeed] = useState(20);
  const [flareIntensity, setFlareIntensity] = useState(72);
  const [colorSpeed, setColorSpeed] = useState(14);
  const currentSettings = settings;

  const audioTracks = useMemo(() => {
    const tracks = [];
    if (beforeAudio.trim()) tracks.push({ label: "ORIGINAL", url: beforeAudio.trim(), format: beforeAudioFormat || undefined });
    if (afterAudio.trim()) tracks.push({ label: "GENERATED", url: afterAudio.trim(), format: afterAudioFormat || undefined });
    return tracks;
  }, [beforeAudio, afterAudio, beforeAudioFormat, afterAudioFormat]);

  const handleCoreDialChange = (key, value) => {
    setCoreDials(prev => ({
      ...prev,
      [key]: Number(value)
    }));
  };

  const syncedCoreDials = useMemo(() => {
    const vocalDelivery = currentSettings.vocal.delivery ?? currentSettings.vocal.texture;
    return {
      harmony: clampPercent(
        currentSettings.emotion.intensity * 0.45 +
        vocalDelivery * 0.35 +
        currentSettings.vocal.warmth * 0.2
      ),
      rhythm: clampPercent(
        currentSettings.emotion.tension * 0.35 +
        currentSettings.vocal.timing * 0.4 +
        currentSettings.vocal.runs * 0.25
      ),
      dynamics: clampPercent(
        currentSettings.emotion.intensity * 0.4 +
        vocalDelivery * 0.35 +
        currentSettings.vocal.rasp * 0.25
      )
    };
  }, [
    currentSettings.emotion.intensity,
    currentSettings.emotion.tension,
    currentSettings.vocal.delivery,
    currentSettings.vocal.texture,
    currentSettings.vocal.warmth,
    currentSettings.vocal.timing,
    currentSettings.vocal.runs,
    currentSettings.vocal.rasp
  ]);

  const activeCoreDials = coreSyncEnabled
    ? {
        harmony: clampPercent(syncedCoreDials.harmony * 0.7 + coreDials.harmony * 0.3),
        rhythm: clampPercent(syncedCoreDials.rhythm * 0.7 + coreDials.rhythm * 0.3),
        dynamics: clampPercent(syncedCoreDials.dynamics * 0.7 + coreDials.dynamics * 0.3)
      }
    : {
        harmony: clampPercent(coreDials.harmony),
        rhythm: clampPercent(coreDials.rhythm),
        dynamics: clampPercent(coreDials.dynamics)
      };

  const handleCoreSyncToggle = (event) => {
    setCoreSyncEnabled(event.target.checked);
  };

  const handleFxControlChange = (key, nextRawValue) => {
    if (nextRawValue === "") return;
    const parsed = Number(nextRawValue);
    if (Number.isNaN(parsed)) return;
    setFxControls((prev) => ({
      ...prev,
      [key]: clampPercent(parsed)
    }));
  };

  const applyFxSettingsToChain = (nextFxControls, nextSettings = currentSettings) => {
    const fxNodes = fxNodesRef.current;
    if (!fxNodes) return;

    const clampUnit = (value) => Math.max(0, Math.min(1, value));
    const audioCtx = Howler.ctx;
    const now = audioCtx?.currentTime ?? 0;
    const setParam = (audioParam, targetValue, glide = 0.02) => {
      if (!audioParam) return;
      if (audioCtx && typeof audioParam.setTargetAtTime === "function") {
        audioParam.cancelScheduledValues(now);
        audioParam.setTargetAtTime(targetValue, now, glide);
        return;
      }
      audioParam.value = targetValue;
    };

    const reverb = (nextFxControls.reverb ?? 0) / 100;
    const eq = (nextFxControls.eq ?? 0) / 100;
    const compression = (nextFxControls.compression ?? 0) / 100;
    const delay = (nextFxControls.delay ?? 0) / 100;

    const intensity = ((nextSettings?.emotion?.intensity ?? 50) / 100);
    const vulnerability = ((nextSettings?.emotion?.vulnerability ?? 50) / 100);
    const confidence = ((nextSettings?.emotion?.confidence ?? 50) / 100);
    const tension = ((nextSettings?.emotion?.tension ?? 50) / 100);
    const emotionWarmth = ((nextSettings?.emotion?.warmth ?? 50) / 100);
    const emotionRelease = ((nextSettings?.emotion?.release ?? 50) / 100);
    const delivery = (((nextSettings?.vocal?.delivery ?? nextSettings?.vocal?.texture ?? 50)) / 100);
    const texture = ((nextSettings?.vocal?.texture ?? 50) / 100);
    const performanceState = ((nextSettings?.vocal?.performanceState ?? 50) / 100);
    const breath = ((nextSettings?.vocal?.breath ?? 50) / 100);
    const rasp = ((nextSettings?.vocal?.rasp ?? 0) / 100);
    const runs = ((nextSettings?.vocal?.runs ?? 50) / 100);
    const timing = ((nextSettings?.vocal?.timing ?? 50) / 100);
    const vocalWarmth = ((nextSettings?.vocal?.warmth ?? 50) / 100);
    const vocalRelease = ((nextSettings?.vocal?.release ?? 50) / 100);

    const emotionDrive = clampUnit(
      intensity * 0.28 +
      tension * 0.2 +
      vulnerability * 0.18 +
      confidence * 0.12 +
      emotionWarmth * 0.12 +
      emotionRelease * 0.1
    );
    const emotionLift = clampUnit(emotionDrive * 0.58 + emotionWarmth * 0.18 + emotionRelease * 0.18);
    const vocalDrive = clampUnit(
      delivery * 0.24 +
      texture * 0.16 +
      performanceState * 0.12 +
      breath * 0.1 +
      rasp * 0.14 +
      runs * 0.08 +
      (1 - timing) * 0.08 +
      vocalWarmth * 0.05 +
      vocalRelease * 0.03
    );

    const vocalAir = clampUnit(breath * 0.65 + delivery * 0.14 + (1 - compression) * 0.11);
    const vocalWarmthTone = clampUnit(vocalWarmth * 0.68 + vocalRelease * 0.14 + (1 - rasp) * 0.1);
    const vocalRaspDrive = clampUnit(rasp * 0.74 + texture * 0.08 + (1 - vocalWarmth) * 0.06);

    const eqBlend = clampUnit(eq * 0.3 + vocalDrive * 0.38 + emotionLift * 0.24);
    const compressionBlend = clampUnit(compression * 0.22 + emotionDrive * 0.3 + performanceState * 0.16 + delivery * 0.1 + (1 - vocalRelease) * 0.08);
    const reverbBlend = clampUnit(reverb * 0.18 + vulnerability * 0.26 + emotionRelease * 0.16 + breath * 0.16 + (1 - tension) * 0.1);
    const delayBlend = clampUnit(delay * 0.14 + rasp * 0.24 + runs * 0.2 + (1 - timing) * 0.12 + (1 - vocalRelease) * 0.08 + intensity * 0.08);

    const harmony = ((nextSettings?.harmony?.harmony ?? 50) / 100) || ((nextSettings?.core?.harmony ?? 50) / 100);
    const rhythm = ((nextSettings?.rhythm?.rhythm ?? 50) / 100) || ((nextSettings?.core?.rhythm ?? 50) / 100);
    const dynamics = ((nextSettings?.dynamics?.dynamics ?? 50) / 100) || ((nextSettings?.core?.dynamics ?? 50) / 100);

    const harmonyTone = clampUnit(harmony * 0.6 + emotionWarmth * 0.2 + (1 - rasp) * 0.2);
    const rhythmTiming = clampUnit(rhythm * 0.5 + timing * 0.25 + (1 - tension) * 0.25);
    const dynamicsRange = clampUnit(dynamics * 0.6 + intensity * 0.18 + performanceState * 0.14 + (1 - vocalRelease) * 0.08);

    const eqBlendUpdated = clampUnit(eqBlend * 0.65 + harmonyTone * 0.35);
    const reverbBlendUpdated = reverbBlend;
    const delayBlendUpdated = delayBlend;
    const compressionBlendUpdated = clampUnit(compressionBlend * 0.6 + dynamicsRange * 0.4);

    setParam(fxNodes.emotionNode.gain, -7 + emotionLift * 14, 0.015);
    setParam(fxNodes.emotionNode.frequency, 560 + vulnerability * 820 + emotionRelease * 420, 0.015);
    setParam(fxNodes.emotionNode.Q, 0.8 + tension * 1.8, 0.015);
    setParam(fxNodes.eqNode.gain, -10 + eqBlendUpdated * 18, 0.015);
    setParam(fxNodes.warmthNode.gain, -4 + vocalWarmthTone * 8, 0.015);
    setParam(fxNodes.airNode.gain, -2.5 + vocalAir * 10, 0.015);
    if (fxNodes.raspNode) {
      fxNodes.raspNode.curve = createRaspCurve(vocalRaspDrive);
    }
    setParam(fxNodes.compressor.threshold, -46 + compressionBlendUpdated * 32, 0.025);
    setParam(fxNodes.compressor.ratio, 1.6 + compressionBlendUpdated * 10.8, 0.025);
    setParam(fxNodes.compressor.attack, 0.025 + (1 - rhythmTiming) * 0.03, 0.025);
    setParam(fxNodes.compressor.release, 0.08 + (1 - rhythmTiming) * 0.4, 0.025);

    setParam(fxNodes.reverbWetGain.gain, 0.1 + reverbBlendUpdated * 0.84, 0.02);
    setParam(fxNodes.dryGain.gain, 1 - reverbBlendUpdated * 0.64, 0.02);

    setParam(fxNodes.delayNode.delayTime, 0.03 + delayBlendUpdated * 0.54, 0.02);
    setParam(fxNodes.delayFeedbackGain.gain, 0.08 + delayBlendUpdated * 0.68, 0.02);
    setParam(fxNodes.delayWetGain.gain, 0.05 + delayBlendUpdated * 0.74, 0.02);
  };

  const analysisData = useMemo(() => ({
    emotion: weightedParentScore(currentSettings.emotion.intensity, [
      currentSettings.emotion.warmth,
      currentSettings.emotion.tension,
      currentSettings.emotion.release
    ]),
    vocal: weightedParentScore(currentSettings.vocal.delivery ?? currentSettings.vocal.texture, [
      currentSettings.vocal.rasp,
      currentSettings.vocal.warmth,
      currentSettings.vocal.breath
    ]),
    harmony: clampPercent(activeCoreDials.harmony),
    rhythm: clampPercent(activeCoreDials.rhythm),
    dynamics: clampPercent(activeCoreDials.dynamics)
  }), [
    currentSettings.emotion.intensity,
    currentSettings.emotion.warmth,
    currentSettings.emotion.tension,
    currentSettings.emotion.release,
    currentSettings.vocal.delivery,
    currentSettings.vocal.texture,
    currentSettings.vocal.rasp,
    currentSettings.vocal.warmth,
    currentSettings.vocal.breath,
    activeCoreDials.harmony,
    activeCoreDials.rhythm,
    activeCoreDials.dynamics
  ]);

  const analysisRows = useMemo(() => [
    { key: "emotion", label: "EMOTION", value: analysisData.emotion },
    { key: "vocal", label: "VOCAL DELIVERY", value: analysisData.vocal },
    { key: "harmony", label: "HARMONY", value: analysisData.harmony },
    { key: "rhythm", label: "RHYTHM", value: analysisData.rhythm },
    { key: "dynamics", label: "DYNAMICS", value: analysisData.dynamics }
  ].map((row) => ({
    ...row,
    color: sciFiBarColor(row.value)
  })), [analysisData]);

  useEffect(() => {
    setSettings(activeVersion === "A" ? versionA : versionB);
  }, [activeVersion, versionA, versionB]);

  useEffect(() => {
    const raw = window.localStorage.getItem("pnf-aims-sessions");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedSessions(parsed);
      }
    } catch (error) {
      setSavedState("SESSION LOAD FAILED");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("pnf-aims-sessions", JSON.stringify(savedSessions));
  }, [savedSessions]);

  useEffect(() => {
    return () => {
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      }

      if (localAudioUrlsRef.current.before) {
        URL.revokeObjectURL(localAudioUrlsRef.current.before);
        localAudioUrlsRef.current.before = "";
      }

      if (localAudioUrlsRef.current.after) {
        URL.revokeObjectURL(localAudioUrlsRef.current.after);
        localAudioUrlsRef.current.after = "";
      }
    };
  }, []);

  useEffect(() => {
    const localBeforeUrl = localAudioUrlsRef.current.before;
    if (!localBeforeUrl || beforeAudio === localBeforeUrl) return;
    URL.revokeObjectURL(localBeforeUrl);
    localAudioUrlsRef.current.before = "";
  }, [beforeAudio]);

  useEffect(() => {
    const localAfterUrl = localAudioUrlsRef.current.after;
    if (!localAfterUrl || afterAudio === localAfterUrl) return;
    URL.revokeObjectURL(localAfterUrl);
    localAudioUrlsRef.current.after = "";
  }, [afterAudio]);

  useEffect(() => {
    if (activeAudioIndex < audioTracks.length) return;
    setActiveAudioIndex(0);
  }, [activeAudioIndex, audioTracks.length]);

  useEffect(() => {
    if (!howlRef.current) return;
    howlRef.current.volume(volume / 100);
  }, [volume]);

  useEffect(() => {
    applyFxSettingsToChain(fxControls, currentSettings);
  }, [fxControls, currentSettings]);

  // Drive the holographic globe from live audio FFT data while playing
  useEffect(() => {
    if (!isPlaying) {
      if (globeRafRef.current) {
        cancelAnimationFrame(globeRafRef.current);
        globeRafRef.current = null;
      }
      audioEnvelopeRef.current = { drive: 0.3, bass: 0.3, treble: 0.3, distortion: 0.3 };
      prevSpectrumRef.current = new Uint8Array(128);
      return;
    }

    const tick = () => {
      const analyser = analyserRef.current;
      if (analyser) {
        const data = fftRef.current;
        const prevSpectrum = prevSpectrumRef.current;
        analyser.getByteFrequencyData(data);
        const binCount = data.length; // 128 bins for fftSize 256

        const bandEnergy = (from, to) => {
          const start = Math.max(0, from);
          const end = Math.min(binCount - 1, to);
          if (end < start) return 0;
          let sum = 0;
          for (let i = start; i <= end; i += 1) sum += data[i] || 0;
          return Math.min(1, sum / ((end - start + 1) * 255));
        };

        // Full-spectrum bands so melody, harmony, cymbals, and presence all contribute.
        const subRaw = bandEnergy(0, 3);
        const bassRaw = bandEnergy(4, 12);
        const lowMidRaw = bandEnergy(13, 28);
        const midRaw = bandEnergy(29, 55);
        const highMidRaw = bandEnergy(56, 88);
        const airRaw = bandEnergy(89, binCount - 1);

        let rms = 0;
        let magnitude = 0;
        let centroidWeighted = 0;
        let fluxSum = 0;
        let roughnessSum = 0;
        let peak = 0;
        for (let i = 0; i < binCount; i += 1) rms += (data[i] || 0) * (data[i] || 0);
        for (let i = 0; i < binCount; i += 1) {
          const current = (data[i] || 0) / 255;
          const prev = (prevSpectrum[i] || 0) / 255;
          peak = Math.max(peak, current);
          magnitude += current;
          centroidWeighted += current * i;
          fluxSum += Math.max(0, current - prev);
          if (i > 0) {
            const left = (data[i - 1] || 0) / 255;
            roughnessSum += Math.abs(current - left);
          }
          prevSpectrum[i] = data[i] || 0;
        }

        const rmsRaw = Math.min(1, Math.sqrt(rms / binCount) / 255);
        const centroidRaw = magnitude > 0 ? centroidWeighted / (magnitude * (binCount - 1)) : 0;
        const fluxRaw = Math.min(1, fluxSum / binCount);
        const roughnessRaw = Math.min(1, roughnessSum / Math.max(1, binCount - 1));
        const dynamicRaw = Math.min(1, Math.max(0, peak - rmsRaw));

        const prev = audioEnvelopeRef.current;
        const lowBandRaw = subRaw * 0.45 + bassRaw * 0.55;
        const pulseRaw = Math.max(0, lowBandRaw - prev.bass * 0.9);
        const transientRaw = Math.min(1, pulseRaw * 2.4 + fluxRaw * 0.8 + dynamicRaw * 0.4);

        const bassTarget = Math.min(1, lowBandRaw * 1.6 + transientRaw * 0.42 + lowMidRaw * 0.22);
        const trebleTarget = Math.min(1, highMidRaw * 1.25 + airRaw * 1.45 + centroidRaw * 0.35);
        const distortionTarget = Math.min(1, midRaw * 1.25 + roughnessRaw * 0.7 + fluxRaw * 0.45 + transientRaw * 0.2);
        const driveTarget = Math.min(
          1,
          rmsRaw * 1.25 +
          transientRaw * 0.3 +
          (lowMidRaw + midRaw + highMidRaw) * 0.22 +
          centroidRaw * 0.18
        );

        const smooth = (current, target, attack, release) => (
          target > current
            ? current + (target - current) * attack
            : current + (target - current) * release
        );

        const next = {
          drive: smooth(prev.drive, driveTarget, 0.38, 0.12),
          bass: smooth(prev.bass, bassTarget, 0.45, 0.12),
          treble: smooth(prev.treble, trebleTarget, 0.34, 0.11),
          distortion: smooth(prev.distortion, distortionTarget, 0.36, 0.12)
        };

        audioEnvelopeRef.current = next;
        setGlobeAudio(next);
      }
      globeRafRef.current = requestAnimationFrame(tick);
    };

    globeRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (globeRafRef.current) {
        cancelAnimationFrame(globeRafRef.current);
        globeRafRef.current = null;
      }
    };
  }, [isPlaying]);

  const handleEmotionChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      emotion: { ...prev.emotion, [key]: Number(value) }
    }));
  };

  const handleVocalChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      vocal: { ...prev.vocal, [key]: Number(value) }
    }));
  };

  const handleSaveVersion = (version) => {
    const snapshot = {
      emotion: { ...settings.emotion },
      vocal: { ...settings.vocal }
    };

    if (version === "A") {
      setVersionA(snapshot);
      setSavedState("VERSION A SAVED");
      return;
    }

    setVersionB(snapshot);
    setSavedState("VERSION B SAVED");
  };

  const openLocalAudioPicker = (target) => {
    if (target === "before") {
      beforeAudioFileInputRef.current?.click();
      return;
    }
    afterAudioFileInputRef.current?.click();
  };

  const applyLocalAudioFile = async (target, file) => {
    if (!file) return;

    if (file.type && !file.type.startsWith("audio/")) {
      setSavedState("INVALID AUDIO FILE");
      setTransportStatus("UPLOAD FAILED");
      return;
    }

    const key = target === "before" ? "before" : "after";
    const previousUrl = localAudioUrlsRef.current[key];
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      localAudioUrlsRef.current[key] = "";
    }

    const localUrl = URL.createObjectURL(file);
    const format = detectAudioFormat(file);
    localAudioUrlsRef.current[key] = localUrl;

    if (key === "before") {
      setBeforeAudio(localUrl);
      setBeforeAudioFileName(file.name);
      setBeforeAudioFormat(format);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setBeforeAudioDataUrl(dataUrl);
      } catch (_) {
        setBeforeAudioDataUrl("");
      }
      setSavedState("ORIGINAL AUDIO UPLOADED");
    } else {
      setAfterAudio(localUrl);
      setAfterAudioFileName(file.name);
      setAfterAudioFormat(format);
      setSavedState("NEW AUDIO UPLOADED");
    }

    setTransportStatus("LOCAL AUDIO READY");
  };

  const handleLocalAudioSelected = (target, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void applyLocalAudioFile(target, file);
  };

  const handleTempoChange = (value) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    setTempo(Math.max(40, Math.min(240, next)));
  };

  const triggerTransport = (action) => {
    const unloadAudio = () => {
      if (!howlRef.current) return;
      howlRef.current.stop();
      howlRef.current.unload();
      howlRef.current = null;
      analyserRef.current = null;
      fxNodesRef.current = null;
    };

    const connectAnalyser = (sound) => {
      try {
        const audioCtx = Howler.ctx;
        if (!audioCtx) return;
        const sounds = sound._sounds;
        if (!sounds || !sounds.length) return;
        const audioEl = sounds[0]._node;
        if (!audioEl) return;
        if (audioEl._saionAnalyserConnected) return;
        if (audioCtx.state === "suspended") audioCtx.resume();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.42;
        const source = audioCtx.createMediaElementSource(audioEl);

        const emotionNode = audioCtx.createBiquadFilter();
        emotionNode.type = "peaking";
        emotionNode.frequency.value = 900;
        emotionNode.Q.value = 0.9;

        const eqNode = audioCtx.createBiquadFilter();
        eqNode.type = "peaking";
        eqNode.frequency.value = 1200;
        eqNode.Q.value = 0.8;

        const compressor = audioCtx.createDynamicsCompressor();
        compressor.knee.value = 18;

        const warmthNode = audioCtx.createBiquadFilter();
        warmthNode.type = "lowshelf";
        warmthNode.frequency.value = 260;

        const airNode = audioCtx.createBiquadFilter();
        airNode.type = "highshelf";
        airNode.frequency.value = 5200;

        const raspNode = audioCtx.createWaveShaper();
        raspNode.oversample = "4x";
        raspNode.curve = createRaspCurve(0);

        const delayNode = audioCtx.createDelay(1.5);
        const delayFeedbackGain = audioCtx.createGain();
        const delayWetGain = audioCtx.createGain();
        delayFeedbackGain.gain.value = 0.05;

        const convolver = audioCtx.createConvolver();
        convolver.buffer = createImpulseResponse(audioCtx);
        const reverbWetGain = audioCtx.createGain();
        const dryGain = audioCtx.createGain();

        source.connect(emotionNode);
        emotionNode.connect(eqNode);
        eqNode.connect(warmthNode);
        warmthNode.connect(airNode);
        airNode.connect(raspNode);
        raspNode.connect(compressor);

        compressor.connect(dryGain);
        dryGain.connect(analyser);

        compressor.connect(convolver);
        convolver.connect(reverbWetGain);
        reverbWetGain.connect(analyser);

        compressor.connect(delayNode);
        delayNode.connect(delayFeedbackGain);
        delayFeedbackGain.connect(delayNode);
        delayNode.connect(delayWetGain);
        delayWetGain.connect(analyser);

        analyser.connect(Howler.masterGain || audioCtx.destination);

        fxNodesRef.current = {
          emotionNode,
          eqNode,
          warmthNode,
          airNode,
          raspNode,
          compressor,
          delayNode,
          delayFeedbackGain,
          delayWetGain,
          reverbWetGain,
          dryGain
        };
        applyFxSettingsToChain(fxControls, currentSettings);
        analyserRef.current = analyser;
        fftRef.current = new Uint8Array(analyser.frequencyBinCount);
        audioEl._saionAnalyserConnected = true;
      } catch (_) {
        // analyser is optional — playback still works
      }
    };

    const loadAudioTrack = (index, autoplay = false) => {
      if (!audioTracks.length) {
        unloadAudio();
        setIsPlaying(false);
        setTransportStatus("NO AUDIO URL");
        return;
      }

      const safeIndex = ((index % audioTracks.length) + audioTracks.length) % audioTracks.length;
      const track = audioTracks[safeIndex];
      setActiveAudioIndex(safeIndex);
      unloadAudio();

      const sound = new Howl({
        src: [track.url],
        ...(track.format ? { format: [track.format] } : {}),
        preload: true,
        html5: true,
        volume: volume / 100,
        onload: () => {
          setTransportStatus(`READY ${track.label}`);
        },
        onplay: () => {
          setIsPlaying(true);
          setTransportStatus(`PLAYING ${track.label}`);
        },
        onpause: () => {
          setIsPlaying(false);
          setTransportStatus("PAUSED");
        },
        onstop: () => {
          setIsPlaying(false);
        },
        onend: () => {
          setIsPlaying(false);
          setTransportStatus("ENDED");
        },
        onloaderror: () => {
          setIsPlaying(false);
          setTransportStatus("AUDIO LOAD FAILED");
        },
        onplayerror: () => {
          setIsPlaying(false);
          setTransportStatus("PLAYBACK BLOCKED — RETRYING");
          sound.once("unlock", () => {
            sound.play();
          });
        }
      });

      // Connect Web Audio analyser once the track is loaded
      sound.once("load", () => connectAnalyser(sound));

      howlRef.current = sound;

      if (autoplay) {
        setTransportStatus(`LOADING ${track.label}`);
        sound.play();
      } else {
        setTransportStatus(`LOADING ${track.label}`);
      }
    };

    if (action === "togglePlay") {
      if (!audioTracks.length) {
        setTransportStatus("NO AUDIO URL");
        return;
      }

      if (Howler.ctx?.state === "suspended") {
        void Howler.ctx.resume();
      }
      if (Howler._muted) {
        Howler.mute(false);
      }

      if (!howlRef.current) {
        loadAudioTrack(activeAudioIndex, true);
        return;
      }

      if (isPlaying) {
        howlRef.current.pause();
      } else {
        howlRef.current.play();
      }
      return;
    }

    if (action === "previous") {
      setWaveformSeed(prev => prev + 1);
      const nextIndex = shuffleEnabled
        ? Math.floor(Math.random() * Math.max(audioTracks.length, 1))
        : activeAudioIndex - 1;
      loadAudioTrack(nextIndex, isPlaying);
      if (!audioTracks.length) return;
      setTransportStatus("PREVIOUS");
      return;
    }

    if (action === "next") {
      setWaveformSeed(prev => prev + 1);
      const nextIndex = shuffleEnabled
        ? Math.floor(Math.random() * Math.max(audioTracks.length, 1))
        : activeAudioIndex + 1;
      loadAudioTrack(nextIndex, isPlaying);
      if (!audioTracks.length) return;
      setTransportStatus("NEXT");
      return;
    }

    if (action === "shuffle") {
      setShuffleEnabled(prev => {
        const next = !prev;
        setTransportStatus(next ? "SHUFFLE ON" : "SHUFFLE OFF");
        return next;
      });
      return;
    }

    if (action === "library") {
      setLibraryOpen(prev => {
        const next = !prev;
        setTransportStatus(next ? "LIBRARY OPEN" : "LIBRARY CLOSED");
        return next;
      });
    }
  };

  const originalSettings = versionA;
  const context = {
    tempo,
    timeSignature,
    emotionPreset,
    vocalPreset
  };

  const generatedPrompt = useMemo(() => buildPrompt(currentSettings, context, fxControls), [currentSettings, tempo, timeSignature, emotionPreset, vocalPreset, fxControls]);
  const generatedNotation = useMemo(() => buildNotation(currentSettings, context, fxControls), [currentSettings, tempo, timeSignature, emotionPreset, vocalPreset, fxControls]);
  const originalNotation = useMemo(() => buildNotation(originalSettings, context, fxControls), [originalSettings, tempo, timeSignature, emotionPreset, vocalPreset, fxControls]);
  const notationWithLocalSettings = useMemo(() => {
    return [`GENERATOR:${generator.toUpperCase()}`, generatedNotation].join("\n");
  }, [generator, generatedNotation]);

  const buildSessionPayload = () => ({
    title: sessionTitle || "Untitled Session",
    originalPrompt,
    generatedPrompt,
    notation: notationWithLocalSettings,
    settings: {
      tempo,
      timeSignature,
      emotionPreset,
      vocalPreset,
      localPreviewOnly,
      activeVersion,
      fxControls,
      original: originalSettings,
      current: currentSettings
    },
    beforeAudio,
    beforeAudioDataUrl,
    beforeAudioFileName,
    beforeAudioFormat,
    afterAudio
  });

  const handleSaveSession = () => {
    const payload = {
      ...buildSessionPayload(),
      savedAt: new Date().toISOString()
    };
    setSavedSessions(prev => [payload, ...prev].slice(0, 20));
    setSelectedSessionIndex("0");
    setSavedState("SESSION SAVED");
  };

  const handleLoadSession = () => {
    const index = Number(selectedSessionIndex);
    if (Number.isNaN(index) || index < 0 || index >= savedSessions.length) {
      setSavedState("NO SESSION SELECTED");
      return;
    }

    const session = savedSessions[index];
    if (!session || !session.settings || !session.settings.current || !session.settings.original) {
      setSavedState("INVALID SESSION");
      return;
    }

    setSessionTitle(session.title || "Song Idea 1");
    setOriginalPrompt(session.originalPrompt || "");
    const restoredBeforeAudio = (() => {
      if (session.beforeAudio && session.beforeAudio.startsWith("blob:") && session.beforeAudioDataUrl) {
        return session.beforeAudioDataUrl;
      }
      return session.beforeAudio || session.beforeAudioDataUrl || "";
    })();

    const previousBeforeLocalUrl = localAudioUrlsRef.current.before;
    if (previousBeforeLocalUrl) {
      URL.revokeObjectURL(previousBeforeLocalUrl);
      localAudioUrlsRef.current.before = "";
    }

    const restoredBeforeObjectUrl = dataUrlToObjectUrl(restoredBeforeAudio);
    if (restoredBeforeObjectUrl) {
      localAudioUrlsRef.current.before = restoredBeforeObjectUrl;
    }

    setBeforeAudio(restoredBeforeObjectUrl || restoredBeforeAudio);
    setAfterAudio(session.afterAudio || "");
    setBeforeAudioDataUrl(
      session.beforeAudioDataUrl ||
      (isAudioDataUrl(restoredBeforeAudio) ? restoredBeforeAudio : "")
    );
    setBeforeAudioFileName(session.beforeAudioFileName || "");
    setBeforeAudioFormat(session.beforeAudioFormat || "");
    setAfterAudioFormat("");
    setAfterAudioFileName("");
    setTempo(session.settings.tempo || 120);
    setTimeSignature(session.settings.timeSignature || "4/4");
    setEmotionPreset(session.settings.emotionPreset || "LONGING");
    setVocalPreset(session.settings.vocalPreset || "SOULFUL");
    if (typeof session.settings.localPreviewOnly === "boolean") {
      setLocalPreviewOnly(session.settings.localPreviewOnly);
    }
    setFxControls({
      ...INITIAL_FX_CONTROLS,
      ...(session.settings.fxControls || {})
    });
    setVersionA(session.settings.original);
    setVersionB(session.settings.current);
    setActiveVersion("B");
    setSavedState("SESSION LOADED");
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setSavedState("PROMPT COPIED");
    } catch (error) {
      setSavedState("COPY FAILED");
    }
  };

  const handleGenerateAudio = async () => {
    if (isGenerating) return;

    if (localPreviewOnly) {
      setSavedState("LOCAL PREVIEW ONLY");
      setTransportStatus("LOCAL PREVIEW MODE");
      return;
    }

    const apiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

    try {
      setIsGenerating(true);
      setTransportStatus("GENERATING");
      setSavedState("GENERATING AUDIO");

      const hasSourceAudio = Boolean(beforeAudio.trim());
      const sourceAudioValue = beforeAudio.trim();
      const sourceAudioIsBlob = sourceAudioValue.startsWith("blob:");
      const sourceAudioIsDataUrl = isAudioDataUrl(sourceAudioValue);
      const sourceAudioData = beforeAudioDataUrl || (sourceAudioIsDataUrl ? sourceAudioValue : "");
      const hasSourceAudioUrl = hasSourceAudio && !sourceAudioIsBlob && !sourceAudioIsDataUrl;
      const hasSourceAudioData = hasSourceAudio && (sourceAudioIsBlob || sourceAudioIsDataUrl) && Boolean(sourceAudioData);

      if (hasSourceAudio && !hasSourceAudioUrl && !hasSourceAudioData) {
        throw new Error("Source vocal is local but not ready yet. Re-upload the file and try again.");
      }

      const sourcePayload = hasSourceAudio
        ? {
            ...(hasSourceAudioUrl
              ? {
                  sourceAudioUrl: beforeAudio.trim(),
                  source_audio_url: beforeAudio.trim(),
                  inputAudioUrl: beforeAudio.trim(),
                  input_audio_url: beforeAudio.trim()
                }
              : {
                  sourceAudioData: sourceAudioData,
                  source_audio_data: sourceAudioData,
                  inputAudioData: sourceAudioData,
                  input_audio_data: sourceAudioData,
                  sourceAudioFileName: beforeAudioFileName || undefined,
                  sourceAudioFormat: beforeAudioFormat || undefined
                })
          }
        : {};

      const generateRes = await fetch(`${apiBase}/api/apiframe/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generator,
          prompt: generatedPrompt,
          payload: {
            prompt: generatedPrompt,
            notation: generatedNotation,
            effects: { ...fxControls },
            ...sourcePayload,
            metadata: {
              tempo,
              timeSignature,
              emotionPreset,
              vocalPreset,
              fxControls: { ...fxControls }
            }
          }
        })
      });

      const generateData = await generateRes.json();
      if (!generateRes.ok) {
        throw new Error(generateData?.error || "Generate request failed.");
      }

      const immediateAudio = extractAudioUrl(generateData);
      if (immediateAudio) {
        setAfterAudio(immediateAudio);
        setAfterAudioFormat("");
        setAfterAudioFileName("");
        setSavedState("AUDIO GENERATED");
        setTransportStatus("READY GENERATED");
        return;
      }

      const jobId = extractJobId(generateData);
      if (!jobId) {
        throw new Error("No audio URL or job id returned by APIframe.");
      }

      const maxPolls = 20;
      for (let attempt = 0; attempt < maxPolls; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const statusRes = await fetch(`${apiBase}/api/apiframe/status/${encodeURIComponent(jobId)}?generator=${encodeURIComponent(generator)}`);
        const statusData = await statusRes.json();
        if (!statusRes.ok) {
          throw new Error(statusData?.error || "Status request failed.");
        }

        const polledAudio = extractAudioUrl(statusData);
        if (polledAudio) {
          setAfterAudio(polledAudio);
          setAfterAudioFormat("");
          setAfterAudioFileName("");
          setSavedState("AUDIO GENERATED");
          setTransportStatus("READY GENERATED");
          return;
        }

        if (isSuccessStatus(statusData)) {
          throw new Error("Job completed but no audio URL was found.");
        }

        if (isFailureStatus(statusData)) {
          throw new Error("APIFRAME JOB FAILED");
        }
      }

      throw new Error("Generation timed out while polling status.");
    } catch (error) {
      setSavedState("GENERATION FAILED");
      setTransportStatus("GENERATION FAILED");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadNotation = () => {
    downloadTextFile(
      `${(sessionTitle || "song-idea").replace(/\s+/g, "-").toLowerCase()}-notation.txt`,
      notationWithLocalSettings
    );
    setSavedState("NOTATION DOWNLOADED");
  };

  const handleExportSessionJson = () => {
    const payload = {
      ...buildSessionPayload(),
      exportedAt: new Date().toISOString()
    };
    downloadTextFile(
      `${(sessionTitle || "song-idea").replace(/\s+/g, "-").toLowerCase()}-session.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    setSavedState("SESSION JSON EXPORTED");
  };

  const emotionDial = currentSettings.emotion.intensity;
  const vocalDial = currentSettings.vocal.delivery ?? currentSettings.vocal.texture;
  const waveformHeights = useMemo(() => {
    let seed = waveformSeed * 9973;
    return Array.from({ length: 200 }).map(() => {
      seed = (seed * 48271) % 2147483647;
      return 5 + (seed % 31);
    });
  }, [waveformSeed]);
  const currentOutput = `${emotionPreset} • ${vocalPreset}`;
  const processingPercent = Math.round(
    Object.values(analysisData).reduce((sum, value) => sum + value, 0) /
      Object.values(analysisData).length
  );
  const processingWidth = `${processingPercent}%`;
  const processingColor = sciFiBarColor(processingPercent);
  const bassDrive = Math.min(
    1,
    (emotionDial * 0.35 + currentSettings.vocal.warmth * 0.4 + volume * 0.25) / 100
  );
  const trebleDrive = Math.min(
    1,
    (currentSettings.vocal.rasp * 0.5 + currentSettings.vocal.runs * 0.25 + currentSettings.vocal.timing * 0.25) / 100
  );
  const distortionDrive = Math.min(
    1,
    (currentSettings.emotion.tension * 0.45 + currentSettings.vocal.rasp * 0.35 + currentSettings.vocal.texture * 0.2) / 100
  );

  return (
    <div className="app-redesign">
      {/* Hidden file inputs — always mounted so refs work from any tab */}
      <input
        ref={beforeAudioFileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac"
        onChange={(event) => handleLocalAudioSelected("before", event)}
        style={{ display: "none" }}
      />
      <input
        ref={afterAudioFileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac"
        onChange={(event) => handleLocalAudioSelected("after", event)}
        style={{ display: "none" }}
      />

      {/* Top Navigation */}
      <header className="top-nav">
        <button
          type="button"
          className="nav-brand nav-brand-link"
          onClick={() => setNavTab("PERFORMANCE")}
          aria-label="Go to homepage"
        >
          <img className="nav-brand-logo" src={saionLogo} alt="SAION" />
        </button>
        <nav className="nav-tabs">
          {["PERFORMANCE", "GENERATE", "VISUALIZE", "CONTROLS"].map(tab => (
            <button
              key={tab}
              className={`nav-tab ${navTab === tab ? "is-active" : ""}`}
              onClick={() => setNavTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="nav-meta">
          <label className="meta-item meta-control" htmlFor="tempo-input">
            <input
              id="tempo-input"
              className="meta-input"
              type="number"
              min="40"
              max="240"
              value={tempo}
              onChange={(e) => handleTempoChange(e.target.value)}
            />
            <small>BPM</small>
          </label>
          <label className="meta-item meta-control" htmlFor="time-input">
            <select
              id="time-input"
              className="meta-select"
              value={timeSignature}
              onChange={(e) => setTimeSignature(e.target.value)}
            >
              <option value="2/2">2/2</option>
              <option value="2/4">2/4</option>
              <option value="3/4">3/4</option>
              <option value="4/4">4/4</option>
              <option value="5/4">5/4</option>
              <option value="6/8">6/8</option>
              <option value="7/8">7/8</option>
            </select>
            <small>TIME</small>
          </label>
        </div>
      </header>

      {/* Main Content */}
      <main className="content-area">
        {navTab === "GENERATE" ? (
          <div className="generate-view">
            <div className="generate-panel-shell">
              <div className="panel-header">
                <h2>Before / After Comparison & Generation</h2>
                <button onClick={() => setNavTab("PERFORMANCE")}>← BACK TO PERFORMANCE</button>
              </div>

              <label>
                Session Title
                <input type="text" value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="Song Idea 1" />
              </label>

              <div className="compare-grid">
                <div className="compare-card">
                  <h3>Before</h3>

                  <label>
                    Original Audio / Song URL
                    <input
                      type="text"
                      value={beforeAudio}
                      onChange={(e) => {
                        setBeforeAudio(e.target.value);
                        setBeforeAudioFormat("");
                        setBeforeAudioDataUrl("");
                        if (e.target.value !== localAudioUrlsRef.current.before) {
                          setBeforeAudioFileName("");
                        }
                      }}
                      placeholder="https://..."
                    />
                  </label>

                  <div className="upload-row">
                    <button
                      type="button"
                      className="upload-local-btn"
                      onClick={() => openLocalAudioPicker("before")}
                    >
                      Upload Local Audio
                    </button>
                    <span className="upload-file-name">{beforeAudioFileName || "No local file selected"}</span>
                  </div>

                  {beforeAudio && (
                    <audio
                      key={beforeAudio}
                      controls
                      src={beforeAudio}
                      className="inline-audio-player"
                    />
                  )}

                  <label>
                    Original Prompt
                    <textarea value={originalPrompt} onChange={(e) => setOriginalPrompt(e.target.value)} placeholder="Original idea prompt..." />
                  </label>

                  <div className="profile-summary">
                    <h4>Original Performance Profile</h4>
                    <p>Warm, soulful, intimate, restrained, emotional.</p>
                  </div>
                </div>

                <div className="compare-card">
                  <h3>After</h3>

                  <label>
                    New Audio / Song URL
                    <input
                      type="text"
                      value={afterAudio}
                      onChange={(e) => {
                        setAfterAudio(e.target.value);
                        setAfterAudioFormat("");
                        if (e.target.value !== localAudioUrlsRef.current.after) {
                          setAfterAudioFileName("");
                        }
                      }}
                      placeholder="https://..."
                    />
                  </label>

                  <div className="upload-row">
                    <button
                      type="button"
                      className="upload-local-btn"
                      onClick={() => openLocalAudioPicker("after")}
                    >
                      Upload Local Audio
                    </button>
                    <span className="upload-file-name">{afterAudioFileName || "No local file selected"}</span>
                  </div>

                  {afterAudio && (
                    <audio
                      key={afterAudio}
                      controls
                      src={afterAudio}
                      className="inline-audio-player"
                    />
                  )}

                  <label>
                    Generated Prompt
                    <textarea value={generatedPrompt} readOnly placeholder="GUI-generated prompt..." />
                  </label>

                  <div className="profile-summary">
                    <h4>New Performance Profile</h4>
                    <p>More intense, layered, vulnerable, wide, expressive.</p>
                  </div>
                </div>
              </div>

              <div className="panel-actions">
                <label className="local-preview-toggle">
                  <input
                    type="checkbox"
                    checked={localPreviewOnly}
                    onChange={(e) => setLocalPreviewOnly(e.target.checked)}
                  />
                  Local Preview Only (no upload/send)
                </label>
                <button onClick={handleGenerateAudio} disabled={isGenerating}>
                  {isGenerating ? "Generating..." : "Generate Audio"}
                </button>
                <button onClick={handleExportSessionJson}>Export Session</button>
                <button onClick={handleCopyPrompt}>Copy Prompt</button>
                <button onClick={handleDownloadNotation}>Download Notation</button>
                <button onClick={handleSaveSession}>Save Session</button>
                <button onClick={handleLoadSession}>Load Session</button>
              </div>

              <label>
                Saved Sessions
                <select value={selectedSessionIndex} onChange={(e) => setSelectedSessionIndex(e.target.value)}>
                  <option value="-1">Select saved session</option>
                  {savedSessions.map((session, index) => (
                    <option key={`${session.savedAt || "session"}-${index}`} value={String(index)}>
                      {session.title || `Session ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : navTab === "VISUALIZE" ? (
          <div className="orb-module-view">
            <div className="orb-module-shell">
              <div className="orb-module-header">
                <div>
                  <h2>HOLOGRAPHIC ORB MODULE</h2>
                  <p>Dedicated visualizer view with live performance drive</p>
                </div>
                <button className="orb-module-back-btn" onClick={() => setNavTab("PERFORMANCE")}>BACK TO PERFORMANCE</button>
              </div>
              <div className="orb-module-stage">
                <Suspense fallback={<div>Loading Orb...</div>}>
                  <HolographicGlobe
                    drive={isPlaying ? globeAudio.drive : emotionDial / 100}
                    bass={isPlaying ? globeAudio.bass : bassDrive}
                    treble={isPlaying ? globeAudio.treble : trebleDrive}
                    distortion={isPlaying ? globeAudio.distortion : distortionDrive}
                    chaosSensitivity={chaosSensitivity / 100}
                    reformSpeed={0.5 + (reformSpeed / 100) * 4.5}
                    flareIntensity={flareIntensity / 100}
                    colorSpeed={(colorSpeed / 100) * 2.0}
                    insideView={insideView}
                  />
                </Suspense>
              </div>
              <div className="orb-module-controls">
                <button
                  className={insideView ? "preview-toggle is-active" : "preview-toggle"}
                  onClick={() => setInsideView((value) => !value)}
                >
                  {insideView ? "Exit Interior" : "View Inside"}
                </button>
                <div className="globe-controls">
                  <div className="globe-control-row">
                    <div className="globe-control-label">
                      <span>Chaos Sensitivity</span>
                      <span>{chaosSensitivity}%</span>
                    </div>
                    <input
                      type="range"
                      className="glass-range"
                      min="20"
                      max="90"
                      value={chaosSensitivity}
                      onChange={(event) => setChaosSensitivity(Number(event.target.value))}
                    />
                  </div>
                  <div className="globe-control-row">
                    <div className="globe-control-label">
                      <span>Reform Speed</span>
                      <span>{Math.round((0.5 + (reformSpeed / 100) * 4.5) * 10) / 10}x</span>
                    </div>
                    <input
                      type="range"
                      className="glass-range"
                      min="5"
                      max="100"
                      value={reformSpeed}
                      onChange={(event) => setReformSpeed(Number(event.target.value))}
                    />
                  </div>
                  <div className="globe-control-row">
                    <div className="globe-control-label">
                      <span>Flare Intensity</span>
                      <span>{flareIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      className="glass-range"
                      min="0"
                      max="100"
                      value={flareIntensity}
                      onChange={(event) => setFlareIntensity(Number(event.target.value))}
                    />
                  </div>
                  <div className="globe-control-row">
                    <div className="globe-control-label">
                      <span>Color Speed</span>
                      <span>{((colorSpeed / 100) * 2.0).toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      className="glass-range"
                      min="0"
                      max="100"
                      value={colorSpeed}
                      onChange={(event) => setColorSpeed(Number(event.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="orb-module-readout">
                <span>OUTPUT: {currentOutput}</span>
                <span>PROCESSING: {processingPercent}%</span>
              </div>
            </div>
          </div>
        ) : navTab === "CONTROLS" ? (
          <div className="generate-view">
            <div className="generate-panel-shell">
              <div className="panel-header">
                <h2>Controls</h2>
                <button onClick={() => setNavTab("PERFORMANCE")}>← BACK TO PERFORMANCE</button>
              </div>

              <div className="settings-section">
                <label>
                  Generator
                  <select value={generator} onChange={(e) => setGenerator(e.target.value)}>
                    <option>Suno</option>
                    <option>Mureka</option>
                    <option>Udio</option>
                  </select>
                </label>

                <label>
                  Vocal Detail Level
                  <select value={vocalDetailLevel} onChange={(e) => setVocalDetailLevel(e.target.value)}>
                    <option>Simple</option>
                    <option>Balanced</option>
                    <option>Advanced</option>
                  </select>
                </label>

                <label>
                  Harmony Style
                  <select value={harmonyStyle} onChange={(e) => setHarmonyStyle(e.target.value)}>
                    <option>Soft Layered</option>
                    <option>Gospel Inspired</option>
                    <option>Wide R&amp;B Stacks</option>
                  </select>
                </label>

                <h3>Effects Rack</h3>
                <div className="controls-effects-grid">
                  {FX_CONTROL_PARAMS.map((param) => {
                    const value = fxControls[param.key] ?? 0;
                    return (
                      <div className="controls-effect-row" key={param.key}>
                        <span className="controls-effect-label">{param.label}</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => handleFxControlChange(param.key, e.target.value)}
                          className="sub-slider controls-effect-slider"
                          aria-label={`${param.label} slider`}
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => handleFxControlChange(param.key, e.target.value)}
                          className="sub-manual-input controls-effect-input"
                          aria-label={`${param.label} value`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        ) : (
        <>
          <div className="cards-grid">
          {/* Emotion Card */}
          <div className="card emotion-card">
            <div className="card-header">
              <div>
                <h2>EMOTION</h2>
                <p className="card-subtitle">INTENSITY</p>
              </div>
              <span className="card-icon">♥</span>
            </div>
            
            <div className="main-dial-wrapper align-bar">
              <ThreeGearDial
                value={emotionDial}
                variant="emotion"
                onChange={(nextValue) => handleEmotionChange("intensity", nextValue)}
              />
              <div className="dial-labels">
                <span className="dial-label-left">0%</span>
                <span className="dial-label-right">100%</span>
              </div>
            </div>


            <div className="card-dropdown">
              <select
                className="dropdown"
                value={emotionPreset}
                onChange={(e) => setEmotionPreset(e.target.value)}
              >
                <option value="LONGING">LONGING</option>
                <option value="CONFIDENT">CONFIDENT</option>
                <option value="VULNERABLE">VULNERABLE</option>
              </select>
            </div>


            {/* Sub-dials */}
            <div className="sub-dials">
              {SUB_DIAL_PARAMS.emotion.map(param => (
                <MiniDial
                  key={param.key}
                  label={param.label}
                  value={currentSettings.emotion[param.key] || 0}
                  step={0.5}
                  onChange={(nextValue) => handleEmotionChange(param.key, nextValue)}
                />
              ))}
            </div>
          </div>

          {/* Vocal Delivery Card */}
          <div className="card vocal-card" style={{ position: 'relative' }}>
            <div className="card-header">
              <div>
                <h2>VOCAL DELIVERY</h2>
                <p className="card-subtitle">CHARACTER</p>
              </div>
              <span className="card-icon">♪</span>
            </div>
            
            <div className="main-dial-wrapper align-bar">
              <ThreeGearDial
                value={vocalDial}
                variant="vocal"
                onChange={(nextValue) => handleVocalChange("delivery", nextValue)}
              />
              <div className="dial-labels">
                <span className="dial-label-left">SOFT</span>
                <span className="dial-label-right">POWERFUL</span>
              </div>
            </div>


            <div className="card-dropdown">
              <select
                className="dropdown"
                value={vocalPreset}
                onChange={(e) => setVocalPreset(e.target.value)}
              >
                <option value="SOULFUL">SOULFUL</option>
                <option value="TECHNICAL">TECHNICAL</option>
                <option value="INTIMATE">INTIMATE</option>
              </select>
            </div>


            {/* Sub-dials */}
            <div className="sub-dials">
              {SUB_DIAL_PARAMS.vocal.map(param => (
                <MiniDial
                  key={param.key}
                  label={param.label}
                  variant="vocal"
                  value={currentSettings.vocal[param.key] || 0}
                  step={0.5}
                  onChange={(nextValue) => handleVocalChange(param.key, nextValue)}
                />
              ))}
            </div>

          </div>

          {/* AI Performance Core Card */}
          <div className="card core-card">
            <div className="card-header">
              <div>
                <h2>AI PERFORMANCE CORE</h2>
                <p className="card-subtitle">ANALYTIC ENGINE</p>
              </div>
              <span className="card-icon">⚛</span>
            </div>

            <div className="core-sync-row">
              <label className="core-sync-toggle">
                <input
                  type="checkbox"
                  checked={coreSyncEnabled}
                  onChange={handleCoreSyncToggle}
                />
                <span>HRD SYNC TO PERFORMANCE</span>
              </label>
              <small>
                {coreSyncEnabled
                  ? "HRD synced mode: 70% main-performance influence + 30% HRD dial influence."
                  : "HRD independent mode: 100% HRD dial control without affecting other dials."}
              </small>
            </div>

            <div className={`core-gyro-row ${coreSyncEnabled ? "is-synced" : ""}`}>
              <div className="core-gyro-item">
                <GyroscopicDial
                  value={activeCoreDials.harmony}
                  label="HARMONY"
                  color={AMBER}
                  size={150}
                  onChange={(nextValue) => handleCoreDialChange("harmony", nextValue)}
                />
              </div>
              <div className="core-gyro-item">
                <GyroscopicDial
                  value={activeCoreDials.rhythm}
                  label="RHYTHM"
                  color={AMBER}
                  size={150}
                  onChange={(nextValue) => handleCoreDialChange("rhythm", nextValue)}
                />
              </div>
              <div className="core-gyro-item">
                <GyroscopicDial
                  value={activeCoreDials.dynamics}
                  label="DYNAMICS"
                  color={AMBER}
                  size={150}
                  onChange={(nextValue) => handleCoreDialChange("dynamics", nextValue)}
                />
              </div>
            </div>

            <div className="analysis-section">
              <h3 className="analysis-title">ANALYZING</h3>
              <div className="analysis-grid">
                {analysisRows.map((row) => (
                  <div
                    key={row.key}
                    className="analysis-item"
                    style={{ borderLeftColor: row.color }}
                  >
                    <div className="analysis-item-head">
                      <span className="analysis-label">{row.label}</span>
                      <span className="analysis-value" style={{ color: row.color }}>{row.value}%</span>
                    </div>
                    <div className="analysis-meter">
                      <div
                        className="analysis-meter-fill"
                        style={{
                          width: `${row.value}%`,
                          background: `linear-gradient(90deg, rgba(34, 243, 255, 0.35), ${row.color})`,
                          boxShadow: `0 0 12px ${row.color}`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="processing-bar">
                <div
                  className="bar-fill"
                  style={{
                    width: processingWidth,
                    background: `linear-gradient(90deg, rgba(34, 243, 255, 0.45), ${processingColor})`,
                    boxShadow: `0 0 14px ${processingColor}`
                  }}
                />
              </div>
              <small>PROCESSING PERFORMANCE DATA</small>
              <p className="current-output">{currentOutput}</p>
            </div>
          </div>

        </div>
        </>
        )}
      </main>

      {/* Bottom A/B Section */}
      <footer className="ab-section">
        <div className="ab-container">
          <div className="ab-comparison">
            <div className="ab-label">A / B COMPARISON</div>
            
            <div className="version-selector">
              <button
                className={`version-btn ${activeVersion === "A" ? "is-active" : ""}`}
                onClick={() => setActiveVersion("A")}
              >
                A
              </button>
              <button
                className={`version-btn ${activeVersion === "B" ? "is-active" : ""}`}
                onClick={() => setActiveVersion("B")}
              >
                B
              </button>
            </div>

            <div
              className={`waveform-display waveform-dropzone ${waveformDragOver ? "is-drag-over" : ""} ${beforeAudio ? "has-audio" : ""}`}
              onClick={() => openLocalAudioPicker("before")}
              onDragOver={(e) => { e.preventDefault(); setWaveformDragOver(true); }}
              onDragLeave={() => setWaveformDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setWaveformDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                void applyLocalAudioFile("before", file);
              }}
              role="button"
              tabIndex={0}
              aria-label="Drop audio here or click to upload"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openLocalAudioPicker("before"); }}
            >
              <div className="waveform-label">
                {beforeAudio
                  ? (beforeAudioFileName || (activeVersion === "A" ? "ORIGINAL" : "GENERATED"))
                  : "Drop audio here or click to upload"}
              </div>
              <svg className="waveform" viewBox="0 0 200 40">
                {waveformHeights.map((height, i) => (
                  <rect
                    key={i}
                    x={i}
                    y={20 - height / 2}
                    width="0.8"
                    height={height}
                    className="wave-bar"
                  />
                ))}
              </svg>
              {beforeAudio && (
                <audio
                  key={beforeAudio}
                  controls
                  src={beforeAudio}
                  className="waveform-audio-player"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>

          <div className="playback-controls">
            <button
              className={`control-btn shuffle ${shuffleEnabled ? "is-active" : ""}`}
              onClick={() => triggerTransport("shuffle")}
              aria-label="Toggle shuffle"
            >
              ⤨
            </button>
            <button
              className="control-btn skip"
              onClick={() => triggerTransport("previous")}
              aria-label="Previous"
            >
              ⏮
            </button>
            <button
              className="control-btn play"
              onClick={() => triggerTransport("togglePlay")}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              className="control-btn skip"
              onClick={() => triggerTransport("next")}
              aria-label="Next"
            >
              ⏭
            </button>
            <button
              className={`control-btn folder ${libraryOpen ? "is-active" : ""}`}
              onClick={() => triggerTransport("library")}
              aria-label="Toggle library"
            >
              📁
            </button>
          </div>

          <div className="volume-control">
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(clampPercent(Number(e.target.value)))}
              className="volume-slider"
              aria-label="Volume Control"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => {
                if (e.target.value === "") return;
                const parsed = Number(e.target.value);
                if (!Number.isNaN(parsed)) {
                  setVolume(clampPercent(parsed));
                }
              }}
              className="volume-input"
              aria-label="Volume value"
            />
          </div>

          <div className="version-save">
            <button
              className="save-btn"
              onClick={() => handleSaveVersion("A")}
            >
              Save Version A
            </button>
            <button
              className="save-btn"
              onClick={() => handleSaveVersion("B")}
            >
              Save Version B
            </button>
          </div>
          <div className="waveform-label">{`${transportStatus} · ${savedState}`}</div>
        </div>
      </footer>
    </div>
  );
}
