import { useEffect, useMemo, useRef, useState } from 'react';
import { VIDEO_DISSOLVE_MS } from '@/city/layout';
import { CityLabView } from '@/city/lab/CityLabView';
import { loadCityAssets } from '@/city/engine/assets';
import { cityBuildingTotal } from '@/city/engine/buildCity';
import {
  LAB_LIMITS,
  SAVED_CITY,
  SAVED_LOOK,
  defaultLabSettings,
  frameCity,
  normalizeFogColor,
  readLabSettings,
  videoPoseSettings,
  writeLabSettings,
  type CityMeasure,
  type LabSettings,
} from '@/city/lab/settings';
import '@/styles/bluebook-city-lab.css';

const VIDEO_SRC = encodeURI('/assets/bluebook/Video End.mp4');
/** The aerial that matches the 3D camera is only the end of the clip. */
const VIDEO_AERIAL_AT = 9;
const DISSOLVE_MS = VIDEO_DISSOLVE_MS;

type PlayPhase = 'idle' | 'video' | 'dissolve' | 'move';

type FieldProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function Field({ label, min, max, step, value, suffix, onChange }: FieldProps) {
  const shown = step >= 1 ? Math.round(value) : Math.round(value / step) * step;
  return (
    <label className="city-lab__field">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {suffix ? <em>{suffix}</em> : null}
    </label>
  );
}

export default function BluebookCityLab() {
  const total = useMemo(() => cityBuildingTotal(), []);
  const [settings, setSettings] = useState<LabSettings>(() => readLabSettings(total));
  const [measure, setMeasure] = useState<CityMeasure | null>(null);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [lost, setLost] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fading, setFading] = useState(false);
  const [phase, setPhase] = useState<PlayPhase>('idle');
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CityLabView | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const transitioning = useRef(false);
  const phaseRef = useRef<PlayPhase>('idle');
  const fadeRaf = useRef(0);
  const moveArmed = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const setPhaseNow = (next: PlayPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const view = new CityLabView({
      host,
      reducedMotion,
      onBuilt: setMeasure,
      onContextLost: () => setLost(true),
    });
    view.onCamera = (next) => {
      settingsRef.current = next;
      setSettings(next);
    };
    viewRef.current = view;
    void loadCityAssets()
      .catch(() => null)
      .then((assets) => {
        if (dead) return;
        view.setAssets(assets);
      });
    return () => {
      dead = true;
      cancelAnimationFrame(fadeRaf.current);
      view.dispose();
      viewRef.current = null;
    };
  }, []);

  const parkOnVideo = () => {
    const host = hostRef.current;
    const view = viewRef.current;
    if (!host || !view) return null;
    const next = videoPoseSettings(host.clientWidth / Math.max(1, host.clientHeight), settingsRef.current);
    settingsRef.current = next;
    view.apply(next);
    setSettings(next);
    return next;
  };

  useEffect(() => {
    if (phase !== 'video' && phase !== 'dissolve') return;
    const onResize = () => parkOnVideo();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'video') return;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || phaseRef.current !== 'video') return;
      const aerial = Math.min(VIDEO_AERIAL_AT, Math.max(0, video.duration - 2.2));
      if (video.currentTime < aerial - 0.05) return;
      if (video.duration - video.currentTime <= DISSOLVE_MS / 1000) beginDissolve();
    }, 80);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!transitioning.current) writeLabSettings(settings);
    viewRef.current?.apply(settings);
  }, [settings]);

  const playVideo = async () => {
    const video = videoRef.current;
    const view = viewRef.current;
    if (!video || !view || transitioning.current || !measure) return;
    transitioning.current = true;
    moveArmed.current = false;
    cancelAnimationFrame(fadeRaf.current);
    video.style.opacity = '';
    view.setLocked(true);
    setOpen(false);
    setFading(false);
    setPhaseNow('video');
    parkOnVideo();
    setPlaying(true);
    const jumpToAerial = () => {
      if (!Number.isFinite(video.duration)) return;
      const start = Math.min(VIDEO_AERIAL_AT, Math.max(0, video.duration - 2.2));
      if (Math.abs(video.currentTime - start) > 0.05) video.currentTime = start;
    };
    // play() has to be called in this click, before any await, or the browser rejects it.
    try {
      await video.play();
    } catch {
      transitioning.current = false;
      view.setLocked(false);
      setPlaying(false);
      setPhaseNow('idle');
      return;
    }
    if (video.readyState >= 1) jumpToAerial();
    else video.addEventListener('loadedmetadata', jumpToAerial, { once: true });
  };

  const beginDissolve = () => {
    if (phaseRef.current !== 'video') return;
    setPhaseNow('dissolve');
    setFading(true);
    const view = viewRef.current;
    const buildings = settingsRef.current.buildings;
    const to: LabSettings = { ...SAVED_LOOK, buildings };
    if (view) {
      view.onHandoffDone = () => {
        transitioning.current = false;
        view.setLocked(false);
        setPhaseNow('idle');
        setPlaying(false);
        setFading(false);
        writeLabSettings(to);
      };
      view.beginFlight(to);
    }
    if (phaseRef.current !== 'dissolve') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (videoRef.current) videoRef.current.style.opacity = '0';
      beginMove();
      return;
    }
    const started = performance.now();
    const step = () => {
      if (phaseRef.current !== 'dissolve') return;
      const clip = videoRef.current;
      const t = Math.min(1, (performance.now() - started) / DISSOLVE_MS);
      const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      if (clip) clip.style.opacity = String(1 - eased);
      if (t < 1) fadeRaf.current = requestAnimationFrame(step);
      else beginMove();
    };
    fadeRaf.current = requestAnimationFrame(step);
  };

  const beginMove = () => {
    if (moveArmed.current || phaseRef.current === 'video' || phaseRef.current === 'idle') return;
    moveArmed.current = true;
    cancelAnimationFrame(fadeRaf.current);
    const clip = videoRef.current;
    if (clip) clip.style.opacity = '0';
    setPhaseNow('move');
  };

  const patch = (partial: Partial<LabSettings>) => setSettings((current) => ({ ...current, ...partial }));

  const setBuildings = (value: number) => {
    if (!Number.isFinite(value)) return;
    patch({ buildings: Math.round(Math.min(total, Math.max(1, value))) });
  };

  return (
    <div className="city-lab">
      <div className="city-lab__stage" ref={hostRef}>
        <video
          ref={videoRef}
          className="city-lab__video"
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          data-hidden={playing ? undefined : ''}
          data-fading={fading ? '' : undefined}
          onTimeUpdate={(event) => {
            const clip = event.currentTarget;
            if (!Number.isFinite(clip.duration)) return;
            const aerial = Math.min(VIDEO_AERIAL_AT, Math.max(0, clip.duration - 2.2));
            if (clip.currentTime < aerial - 0.05) return;
            if (clip.duration - clip.currentTime <= DISSOLVE_MS / 1000) beginDissolve();
          }}
          onEnded={() => {
            if (phaseRef.current === 'video') beginDissolve();
          }}
        />
      </div>
      <p className="city-lab__hint">拖曳轉鏡頭 · 滾輪拉遠近 · Shift 拖曳平移</p>
      {playing ? (
        <p className="city-lab__status">
          {phase === 'move' ? '城市從霧裡出來' : phase === 'dissolve' ? '接到片尾的霧' : 'Video End'}
        </p>
      ) : null}
      <button type="button" className="city-lab__toggle" onClick={() => setOpen((value) => !value)}>
        {open ? '收起' : '編輯器'}
      </button>
      {open ? (
        <aside className="city-lab__panel">
          <h1>Bluebook City</h1>
          <p className="city-lab__intro">用這個頁面試城市有幾大、鏡頭點擺，同埋外圍白霧。設定會寫入網址。</p>

          <section>
            <h2>城市大小</h2>
            <div className="city-lab__count">
              <input
                type="number"
                min={1}
                max={total}
                step={1}
                value={settings.buildings}
                aria-label="建築數量"
                onChange={(event) => setBuildings(Number(event.target.value))}
              />
              <span>座</span>
            </div>
            <input
              className="city-lab__count-range"
              type="range"
              min={1}
              max={total}
              step={1}
              value={settings.buildings}
              aria-label="建築數量"
              onChange={(event) => setBuildings(Number(event.target.value))}
            />
            <div className="city-lab__steps">
              <button type="button" onClick={() => setBuildings(settings.buildings - 10)}>
                −10
              </button>
              <button type="button" onClick={() => setBuildings(settings.buildings - 1)}>
                −1
              </button>
              <button type="button" onClick={() => setBuildings(settings.buildings + 1)}>
                +1
              </button>
              <button type="button" onClick={() => setBuildings(settings.buildings + 10)}>
                +10
              </button>
            </div>
            <p className="city-lab__meta">
              {measure
                ? `而家 ${measure.width} × ${measure.depth} 米。記錄尺寸係由市中心向外 70%（${SAVED_LOOK.buildings} 座，約 ${Math.round(SAVED_CITY.radius)} 米）。全城半徑 ${Math.round(SAVED_CITY.maxRadius)} 米，最多 ${total} 座。`
                : '城市載入中'}
            </p>
          </section>

          <section>
            <h2>白霧</h2>
            <Field
              label="範圍"
              min={LAB_LIMITS.fogRange[0]}
              max={LAB_LIMITS.fogRange[1]}
              step={1}
              value={settings.fogRange}
              suffix="米"
              onChange={(fogRange) => patch({ fogRange })}
            />
            <Field
              label="密度"
              min={0}
              max={100}
              step={1}
              value={settings.fogDensity * 100}
              suffix="%"
              onChange={(value) => patch({ fogDensity: value / 100 })}
            />
            <label className="city-lab__field city-lab__color">
              <span>顏色</span>
              <input
                type="color"
                aria-label="霧的顏色"
                value={settings.fogColor}
                onChange={(event) => patch({ fogColor: event.target.value })}
              />
              <input
                type="text"
                spellCheck={false}
                defaultValue={settings.fogColor}
                key={settings.fogColor}
                onBlur={(event) => {
                  const next = normalizeFogColor(event.target.value);
                  if (next) patch({ fogColor: next });
                  else event.target.value = settings.fogColor;
                }}
              />
            </label>
            <p className="city-lab__meta">範圍係市中心到霧開始變色的距離。密度係外圍有幾實。</p>
          </section>

          <section>
            <h2>鏡頭</h2>
            <Field
              label="水平角"
              min={LAB_LIMITS.yaw[0]}
              max={LAB_LIMITS.yaw[1]}
              step={0.5}
              value={settings.yaw}
              suffix="°"
              onChange={(yaw) => patch({ yaw })}
            />
            <Field
              label="俯角"
              min={LAB_LIMITS.pitch[0]}
              max={LAB_LIMITS.pitch[1]}
              step={0.5}
              value={settings.pitch}
              suffix="°"
              onChange={(pitch) => patch({ pitch })}
            />
            <Field
              label="距離"
              min={LAB_LIMITS.distance[0]}
              max={LAB_LIMITS.distance[1]}
              step={1}
              value={settings.distance}
              suffix="米"
              onChange={(distance) => patch({ distance })}
            />
            <Field
              label="視野"
              min={LAB_LIMITS.fov[0]}
              max={LAB_LIMITS.fov[1]}
              step={0.5}
              value={settings.fov}
              suffix="°"
              onChange={(fov) => patch({ fov })}
            />
            <Field
              label="目標 X"
              min={LAB_LIMITS.target[0]}
              max={LAB_LIMITS.target[1]}
              step={1}
              value={settings.targetX}
              suffix="米"
              onChange={(targetX) => patch({ targetX })}
            />
            <Field
              label="目標 Z"
              min={LAB_LIMITS.target[0]}
              max={LAB_LIMITS.target[1]}
              step={1}
              value={settings.targetZ}
              suffix="米"
              onChange={(targetZ) => patch({ targetZ })}
            />
          </section>

          <div className="city-lab__actions">
            <button type="button" onClick={() => void playVideo()} disabled={!measure || playing}>
              {playing ? '播放中' : '播放 Video End'}
            </button>
            <button type="button" onClick={() => measure && setSettings((current) => frameCity(current, measure))}>
              對準城市
            </button>
            <button
              type="button"
              onClick={() => {
                const next = defaultLabSettings(total);
                setSettings(next);
              }}
            >
              還原
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? '已複製' : '複製連結'}
            </button>
          </div>
        </aside>
      ) : null}
      {lost ? <p className="city-lab__lost">畫面中斷了，請重新載入。</p> : null}
    </div>
  );
}
