import { useMemo, useState } from "react";
import HolographicGlobe from "./HolographicGlobe";

const SECTION_TABS = ["Emotion", "Musicality", "Vocal Character", "Versions", "Output"];

const INITIAL_SETTINGS = {
  emotion: {
    vulnerability: 78,
    intensity: 56,
    confidence: 40,
    tension: 64
  },
  musicality: {
    timingFeel: 70,
    syncopation: 50,
    ornamentation: 42,
    dynamics: 45
  },
  vocalCharacter: {
    texture: "Breathy",
    performanceState: "Fragile"
  }
};

const INITIAL_VERSIONS = [
  { id: "v01", name: "Version 01 - Raw", settings: INITIAL_SETTINGS },
  {
    id: "v02",
    name: "Version 02 - Vulnerable",
    settings: {
      ...INITIAL_SETTINGS,
      emotion: { ...INITIAL_SETTINGS.emotion, vulnerability: 88, confidence: 33 },
      vocalCharacter: { texture: "Breathy", performanceState: "Fragile" }
    }
  },
  {
    id: "v03",
    name: "Version 03 - Confident",
    settings: {
      ...INITIAL_SETTINGS,
      emotion: { ...INITIAL_SETTINGS.emotion, confidence: 81, tension: 34 },
      vocalCharacter: { texture: "Powerful", performanceState: "Confident" }
    }
  }
];

const EMOTION_FIELDS = {
  vulnerability: {
    label: "Vulnerability",
    low: "Guarded",
    high: "Vulnerability"
  },
  intensity: {
    label: "Intensity",
    low: "Calm",
    high: "Charged"
  },
  confidence: {
    label: "Confidence",
    low: "Hesitant",
    high: "Assured"
  },
  tension: {
    label: "Tension",
    low: "Released",
    high: "Coiled"
  }
};

const MUSICALITY_FIELDS = {
  timingFeel: {
    label: "Timing Feel",
    low: "Tight",
    high: "Laid-back"
  },
  syncopation: {
    label: "Syncopation",
    low: "Straight",
    high: "Complex"
  },
  ornamentation: {
    label: "Ornamentation",
    low: "Plain",
    high: "Decorative"
  },
  dynamics: {
    label: "Dynamics",
    low: "Flat",
    high: "Expressive"
  }
};

const EMOTION_LEVELS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function labelForRange(value, low, mid, high) {
  if (value <= 33) return low;
  if (value <= 66) return mid;
  return high;
}

function buildNotation(settings) {
  return [
    `EMO:VULN(${settings.emotion.vulnerability})`,
    `EMO:INT(${settings.emotion.intensity})`,
    `EMO:CONF(${settings.emotion.confidence})`,
    `EMO:TENS(${settings.emotion.tension})`,
    `TIM:LAYBACK(${settings.musicality.timingFeel})`,
    `SYNC:${settings.musicality.syncopation}`,
    `ORN:${settings.musicality.ornamentation}`,
    `DYN:${settings.musicality.dynamics}`,
    `DEL:${settings.vocalCharacter.texture.toUpperCase()}`,
    `STATE:${settings.vocalCharacter.performanceState.toUpperCase()}`
  ].join("\n");
}

function buildPrompt(settings) {
  const vulnText = labelForRange(settings.emotion.vulnerability, "subtle", "present", "vulnerable");
  const dynText = labelForRange(settings.musicality.dynamics, "soft", "restrained", "powerful");
  const timeText = labelForRange(settings.musicality.timingFeel, "tight", "balanced", "laid-back");

  return `Perform with ${vulnText} emotional delivery, ${settings.vocalCharacter.texture.toLowerCase()} vocal texture, ${dynText} dynamics, and a ${timeText} timing feel.`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function deriveMusicalityFromEmotion(emotion) {
  const { vulnerability, intensity, confidence, tension } = emotion;

  return {
    // More vulnerability and less tension leans into laid-back phrasing.
    timingFeel: clamp(45 + vulnerability * 0.4 - tension * 0.2),
    // Intensity and tension raise syncopation, confidence smooths it slightly.
    syncopation: clamp(20 + intensity * 0.45 + tension * 0.35 - confidence * 0.15),
    // Vulnerability increases ornamental expression while confidence moderates excess.
    ornamentation: clamp(18 + vulnerability * 0.42 + intensity * 0.2 - confidence * 0.1),
    // Dynamics track confidence and intensity, with slight tension support.
    dynamics: clamp(10 + confidence * 0.45 + intensity * 0.32 + tension * 0.1)
  };
}

function App() {
  const [activeSection, setActiveSection] = useState("Emotion");
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [activeVersionId, setActiveVersionId] = useState("v01");
  const [selectedEmotionKey, setSelectedEmotionKey] = useState("vulnerability");
  const [selectedMusicalityKey, setSelectedMusicalityKey] = useState("timingFeel");
  const [isMusicalityLinked, setIsMusicalityLinked] = useState(true);
  const [chaosSensitivity, setChaosSensitivity] = useState(67);
  const [reformSpeed, setReformSpeed] = useState(20);
  const [flareIntensity, setFlareIntensity] = useState(72);
  const [colorSpeed, setColorSpeed] = useState(14);
  const [insideView, setInsideView] = useState(false);

  const notation = useMemo(() => buildNotation(settings), [settings]);
  const prompt = useMemo(() => buildPrompt(settings), [settings]);

  const activeVersionName = useMemo(() => {
    const found = INITIAL_VERSIONS.find((item) => item.id === activeVersionId);
    return found ? found.name : "Version 01 - Raw";
  }, [activeVersionId]);

  const selectedEmotionMeta = EMOTION_FIELDS[selectedEmotionKey];
  const selectedEmotionValue = settings.emotion[selectedEmotionKey];
  const selectedMusicalityMeta = MUSICALITY_FIELDS[selectedMusicalityKey];
  const selectedMusicalityValue = settings.musicality[selectedMusicalityKey];

  const dialAngle = useMemo(() => {
    const min = -135;
    const max = 135;
    return min + (selectedEmotionValue / 100) * (max - min);
  }, [selectedEmotionValue]);

  const musicalityDialAngle = useMemo(() => {
    const min = -135;
    const max = 135;
    return min + (selectedMusicalityValue / 100) * (max - min);
  }, [selectedMusicalityValue]);

  const globeDrive = useMemo(() => {
    const intensity = settings.emotion.intensity / 100;
    const tension = settings.emotion.tension / 100;
    const dynamics = settings.musicality.dynamics / 100;
    const ornamentation = settings.musicality.ornamentation / 100;

    return Math.min(1, intensity * 0.35 + tension * 0.25 + dynamics * 0.25 + ornamentation * 0.15);
  }, [settings]);

  const globeBass = useMemo(() => {
    const intensity = settings.emotion.intensity / 100;
    const dynamics = settings.musicality.dynamics / 100;
    const tension = settings.emotion.tension / 100;

    return Math.min(1, intensity * 0.4 + dynamics * 0.35 + tension * 0.25);
  }, [settings]);

  const globeTreble = useMemo(() => {
    const syncopation = settings.musicality.syncopation / 100;
    const ornamentation = settings.musicality.ornamentation / 100;
    const confidence = settings.emotion.confidence / 100;

    return Math.min(1, syncopation * 0.45 + ornamentation * 0.4 + confidence * 0.15);
  }, [settings]);

  const globeDistortion = useMemo(() => {
    const tension = settings.emotion.tension / 100;
    const intensity = settings.emotion.intensity / 100;
    const syncopation = settings.musicality.syncopation / 100;
    const dynamics = settings.musicality.dynamics / 100;

    return Math.min(1, tension * 0.35 + intensity * 0.25 + syncopation * 0.2 + dynamics * 0.2);
  }, [settings]);

  function updateEmotion(key, value) {
    const numericValue = Number(value);

    setSettings((prev) => {
      const nextEmotion = {
        ...prev.emotion,
        [key]: numericValue
      };

      return {
        ...prev,
        emotion: nextEmotion,
        musicality: isMusicalityLinked ? deriveMusicalityFromEmotion(nextEmotion) : prev.musicality
      };
    });
  }

  function updateMusicality(key, value) {
    const numericValue = Number(value);
    setIsMusicalityLinked(false);

    setSettings((prev) => ({
      ...prev,
      musicality: {
        ...prev.musicality,
        [key]: numericValue
      }
    }));
  }

  function handleMusicalityLinkChange(event) {
    const nextLinked = event.target.checked;
    setIsMusicalityLinked(nextLinked);

    if (nextLinked) {
      setSettings((prev) => ({
        ...prev,
        musicality: deriveMusicalityFromEmotion(prev.emotion)
      }));
    }
  }

  function loadVersion(version) {
    setActiveVersionId(version.id);
    setIsMusicalityLinked(true);
    setSettings({
      ...version.settings,
      musicality: deriveMusicalityFromEmotion(version.settings.emotion)
    });
  }

  return (
    <main className="app">
      <nav className="nav">
        <div className="tab-row" aria-label="Section Navigation">
          {SECTION_TABS.map((tab) => (
            <button
              key={tab}
              className={tab === activeSection ? "tab is-active" : "tab"}
              onClick={() => setActiveSection(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <section className="main">
        <div className="card-grid">
          <aside className="card controls">
          <h2 className="section-title">Emotion Controls</h2>
          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="emotion-select">Emotion Parameter</label>
            </div>
            <select
              id="emotion-select"
              className="glass-select"
              value={selectedEmotionKey}
              onChange={(event) => setSelectedEmotionKey(event.target.value)}
            >
              {Object.entries(EMOTION_FIELDS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="emotion-level">Level</label>
              <span>{selectedEmotionValue}</span>
            </div>
            <select
              id="emotion-level"
              className="glass-select"
              value={selectedEmotionValue}
              onChange={(event) => updateEmotion(selectedEmotionKey, event.target.value)}
            >
              {EMOTION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level} - {level === 0 ? selectedEmotionMeta.low : level === 100 ? selectedEmotionMeta.high : "Balanced"}
                </option>
              ))}
            </select>
          </div>

          <h2 className="section-title">Emotion Dial</h2>
          <div className="dial-indicator">
            <div className="hero-dial-wrap" aria-hidden="true">
              <div className="hero-dial">
                <div className="hero-dial-ticks" />
                <div className="hero-dial-pointer" style={{ transform: `translateX(-50%) rotate(${dialAngle}deg)` }} />
                <div className="hero-dial-inner">
                  <div className="hero-dial-grip" />
                  <div className="hero-dial-mark">P</div>
                </div>
              </div>
              <span className="hero-dial-value">{selectedEmotionValue}%</span>
            </div>
          </div>
        </aside>

        <aside className="panel glass controls square-panel">
          <h2 className="section-title">Musicality Dial</h2>
          <div className="dial-indicator dial-indicator--musicality">

            <div className="hero-dial-wrap" aria-hidden="true">
              <div className="hero-dial hero-dial--musicality">
                <div className="hero-dial-ticks hero-dial-ticks--musicality" />
                <div className="hero-dial-pointer hero-dial-pointer--musicality" style={{ transform: `translateX(-50%) rotate(${musicalityDialAngle}deg)` }} />
                <div className="hero-dial-inner">
                  <div className="hero-dial-grip" />
                  <div className="hero-dial-mark">M</div>
                </div>
              </div>
              <span className="hero-dial-value">{selectedMusicalityValue}%</span>
            </div>
          </div>

          <h2 className="section-title">Musicality Controls</h2>

          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="musicality-link">Follow Emotion</label>
              <input
                id="musicality-link"
                type="checkbox"
                checked={isMusicalityLinked}
                onChange={handleMusicalityLinkChange}
              />
            </div>
            <small>{isMusicalityLinked ? "Musicality auto-follows emotion." : "Manual musicality control enabled."}</small>
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="musicality-select">Musicality Parameter</label>
            </div>
            <select
              id="musicality-select"
              className="glass-select"
              value={selectedMusicalityKey}
              onChange={(event) => setSelectedMusicalityKey(event.target.value)}
            >
              {Object.entries(MUSICALITY_FIELDS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="musicality-level">Level</label>
              <span>{selectedMusicalityValue}</span>
            </div>
            <select
              id="musicality-level"
              className="glass-select"
              value={selectedMusicalityValue}
              onChange={(event) => updateMusicality(selectedMusicalityKey, event.target.value)}
            >
              {EMOTION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level} - {level === 0 ? selectedMusicalityMeta.low : level === 100 ? selectedMusicalityMeta.high : "Balanced"}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <aside className="card orb-card orb-panel">
          <h2 className="section-title">Holographic Core</h2>
          <div className="holo-stage" aria-hidden="true">
            <HolographicGlobe
              drive={globeDrive}
              bass={globeBass}
              treble={globeTreble}
              distortion={globeDistortion}
              chaosSensitivity={chaosSensitivity / 100}
              reformSpeed={0.5 + (reformSpeed / 100) * 4.5}
              flareIntensity={flareIntensity / 100}
              colorSpeed={colorSpeed / 100 * 2.0}
              insideView={insideView}
            />
          </div>
          <button
            className={insideView ? 'preview-toggle is-active' : 'preview-toggle'}
            style={{ alignSelf: 'center', marginTop: '0.6rem' }}
            onClick={() => setInsideView((v) => !v)}
          >
            {insideView ? 'Exit Interior' : 'View Inside'}
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
                onChange={(e) => setChaosSensitivity(Number(e.target.value))}
              />
            </div>
            <div className="globe-control-row">
              <div className="globe-control-label">
                <span>Reform Speed</span>
                <span>{Math.round(0.5 + (reformSpeed / 100) * 4.5 * 10) / 10}x</span>
              </div>
              <input
                type="range"
                className="glass-range"
                min="5"
                max="100"
                value={reformSpeed}
                onChange={(e) => setReformSpeed(Number(e.target.value))}
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
                onChange={(e) => setFlareIntensity(Number(e.target.value))}
              />
            </div>
            <div className="globe-control-row">
              <div className="globe-control-label">
                <span>Color Speed</span>
                <span>{(colorSpeed / 100 * 2.0).toFixed(2)}x</span>
              </div>
              <input
                type="range"
                className="glass-range"
                min="0"
                max="100"
                value={colorSpeed}
                onChange={(e) => setColorSpeed(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="orb-readout">
            <p className="label">Active Version</p>
            <p className="orb-value">{activeVersionName}</p>
            <p className="orb-caption">{prompt}</p>
            <pre>{notation}</pre>
          </div>
        </aside>
        </div>
      </section>

      <footer className="footer">
        <div style={{width: '100%', maxWidth: '1200px'}}>
          <h2 className="section-title">Versions</h2>
          <div className="version-cards">
            {INITIAL_VERSIONS.map((version) => (
              <button
                key={version.id}
                className={version.id === activeVersionId ? "version-card is-active" : "version-card"}
                onClick={() => loadVersion(version)}
              >
                <span>{version.name}</span>
              </button>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

export default App;
