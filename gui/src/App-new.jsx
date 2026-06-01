import './styles-match.css';
import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import ThreeGearDial from "./ThreeGearDial";
import GyroscopicDial, { AMBER } from "./GyroscopicDial";
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

function buildNotation(settings, context) {
  return [
    `[PERFORMANCE]: BPM:${context.tempo} TSIG:${context.timeSignature}`,
    `EMOTION:${context.emotionPreset}`,
    `VOCAL:${context.vocalPreset}`,
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
    `RELEASE:${settings.vocal.release}`
  ].join("\n");
}

function buildPrompt(settings, context) {
  const intensityText = rangeLabel(settings.emotion.intensity, "subdued", "balanced", "charged");
  const vulnerabilityText = rangeLabel(settings.emotion.vulnerability, "guarded", "open", "exposed");
  const confidenceText = rangeLabel(settings.emotion.confidence, "uncertain", "steady", "assured");
  const textureText = rangeLabel(settings.vocal.texture, "smooth", "textured", "raspy");
  const timingText = rangeLabel(settings.vocal.timing, "tight", "centered", "laid-back");

  return [
    `Generate a ${context.emotionPreset.toLowerCase()} / ${context.vocalPreset.toLowerCase()} performance at ${context.tempo} BPM in ${context.timeSignature}.`,
    `Delivery should feel ${intensityText}, ${vulnerabilityText}, and ${confidenceText}.`,
    `Voice should be ${textureText} with breath:${settings.vocal.breath}, rasp:${settings.vocal.rasp}, runs:${settings.vocal.runs}.`,
    `Phrase timing should be ${timingText} with release:${settings.vocal.release} and warmth:${settings.vocal.warmth}.`,
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

function MiniDial({ value, label, variant = "emotion", onChange }) {
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
    onChange(angleToDialValue(angle));
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
      onChange(Math.max(0, currentValue - 1));
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(Math.min(100, currentValue + 1));
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

export default function App() {
  const [compareOpen, setCompareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [savedSessions, setSavedSessions] = useState([]);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState("-1");
  const [coreDials, setCoreDials] = useState({
    harmony: 74,
    rhythm: 63,
    dynamics: 71
  });
  const currentSettings = settings;

  const handleCoreDialChange = (key, value) => {
    setCoreDials(prev => ({
      ...prev,
      [key]: Number(value)
    }));
  };

  const analysisData = useMemo(() => ({
    emotion: weightedParentScore(currentSettings.emotion.intensity, [
      currentSettings.emotion.warmth,
      currentSettings.emotion.tension,
      currentSettings.emotion.release
    ]),
    vocal: weightedParentScore(currentSettings.vocal.texture, [
      currentSettings.vocal.rasp,
      currentSettings.vocal.warmth,
      currentSettings.vocal.breath
    ]),
    harmony: clampPercent(coreDials.harmony),
    rhythm: clampPercent(coreDials.rhythm),
    dynamics: clampPercent(coreDials.dynamics)
  }), [
    currentSettings.emotion.intensity,
    currentSettings.emotion.warmth,
    currentSettings.emotion.tension,
    currentSettings.emotion.release,
    currentSettings.vocal.texture,
    currentSettings.vocal.rasp,
    currentSettings.vocal.warmth,
    currentSettings.vocal.breath,
    coreDials.harmony,
    coreDials.rhythm,
    coreDials.dynamics
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

  const handleTempoChange = (value) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    setTempo(Math.max(40, Math.min(240, next)));
  };

  const triggerTransport = (action) => {
    if (action === "togglePlay") {
      setIsPlaying(prev => {
        const next = !prev;
        setTransportStatus(next ? "PLAYING" : "PAUSED");
        return next;
      });
      return;
    }

    if (action === "previous") {
      setWaveformSeed(prev => prev + 1);
      setTransportStatus("PREVIOUS");
      return;
    }

    if (action === "next") {
      setWaveformSeed(prev => prev + 1);
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

  const generatedPrompt = useMemo(() => buildPrompt(currentSettings, context), [currentSettings, tempo, timeSignature, emotionPreset, vocalPreset]);
  const generatedNotation = useMemo(() => buildNotation(currentSettings, context), [currentSettings, tempo, timeSignature, emotionPreset, vocalPreset]);
  const originalNotation = useMemo(() => buildNotation(originalSettings, context), [originalSettings, tempo, timeSignature, emotionPreset, vocalPreset]);
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
      activeVersion,
      original: originalSettings,
      current: currentSettings
    },
    beforeAudio,
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
    setBeforeAudio(session.beforeAudio || "");
    setAfterAudio(session.afterAudio || "");
    setTempo(session.settings.tempo || 120);
    setTimeSignature(session.settings.timeSignature || "4/4");
    setEmotionPreset(session.settings.emotionPreset || "LONGING");
    setVocalPreset(session.settings.vocalPreset || "SOULFUL");
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
  const vocalDial = currentSettings.vocal.texture;
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
      {/* Top Navigation */}
      <header className="top-nav">
        <div className="nav-brand">PNF·AIMS</div>
        <nav className="nav-tabs">
          {["PROJECT", "PERFORMANCE", "GENERATE", "VISUALIZE", "EXPORT"].map(tab => (
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
        {navTab === "VISUALIZE" ? (
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
                    drive={emotionDial / 100}
                    bass={bassDrive}
                    treble={trebleDrive}
                    distortion={distortionDrive}
                  />
                </Suspense>
              </div>
              <div className="orb-module-readout">
                <span>OUTPUT: {currentOutput}</span>
                <span>PROCESSING: {processingPercent}%</span>
              </div>
            </div>
          </div>
        ) : (
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
                onChange={(nextValue) => handleVocalChange("texture", nextValue)}
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

            <div className="core-gyro-row">
              <div className="core-gyro-item">
                <GyroscopicDial
                  value={coreDials.harmony}
                  label="HARMONY"
                  color={AMBER}
                  size={150}
                  onChange={(nextValue) => handleCoreDialChange("harmony", nextValue)}
                />
              </div>
              <div className="core-gyro-item">
                <GyroscopicDial
                  value={coreDials.rhythm}
                  label="RHYTHM"
                  color={AMBER}
                  size={150}
                  onChange={(nextValue) => handleCoreDialChange("rhythm", nextValue)}
                />
              </div>
              <div className="core-gyro-item">
                <GyroscopicDial
                  value={coreDials.dynamics}
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
        )}
      </main>

      <div className="floating-action-buttons">
        <button
          className="floating-action-btn"
          onClick={() => {
            setCompareOpen(true);
            setSettingsOpen(false);
            setArrangementOpen(false);
          }}
        >
          ⇄ Compare
        </button>

        <button
          className="floating-action-btn"
          onClick={() => {
            setSettingsOpen(true);
            setCompareOpen(false);
            setArrangementOpen(false);
          }}
        >
          ⚙ Settings
        </button>

      </div>
      {compareOpen && (
        <div className="panel-overlay" onClick={() => setCompareOpen(false)}>
          <div className="bottom-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h2>Before / After Comparison</h2>
              <button onClick={() => setCompareOpen(false)}>Close</button>
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
                  <input type="text" value={beforeAudio} onChange={(e) => setBeforeAudio(e.target.value)} placeholder="https://..." />
                </label>

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
                  <input type="text" value={afterAudio} onChange={(e) => setAfterAudio(e.target.value)} placeholder="https://..." />
                </label>

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
      )}

      {settingsOpen && (
        <div className="panel-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="bottom-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h2>Settings</h2>
              <button onClick={() => setSettingsOpen(false)}>Close</button>
            </div>

            <div className="settings-section">
              <h3>Performance Engine</h3>

              <label>
                Generator
                <select value={generator} onChange={(e) => setGenerator(e.target.value)}>
                  <option>Suno</option>
                  <option>Mureka</option>
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
            </div>

            <div className="profile-summary">
              <h4>Notation Engine</h4>
              <p>Hidden under the hood. Used to shape performance, phrasing, harmony, and emotional delivery.</p>
            </div>
          </div>
        </div>
      )}

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

            <div className="waveform-display">
              <div className="waveform-label">
                {activeVersion === "A" ? "ORIGINAL" : "GENERATED"}
              </div>
              <svg className="waveform" viewBox="0 0 200 40">
                {waveformHeights.map((height, i) => {
                  return (
                    <rect
                      key={i}
                      x={i}
                      y={20 - height / 2}
                      width="0.8"
                      height={height}
                      className="wave-bar"
                    />
                  );
                })}
              </svg>
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
            <span className="volume-label">{volume}%</span>
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
