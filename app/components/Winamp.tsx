"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import styles from "./Winamp.module.css";

type State = "idle" | "loading" | "playing" | "done";

interface TrackData {
  trackName: string;
  albumName: string;
  albumArt: string;
  previewUrl: string;
  startTime: number;
  endTime: number;
  verse: string;
  trackId: string;
  wasReset: boolean;
}

const EQ_BANDS = [
  "60",
  "170",
  "310",
  "600",
  "1K",
  "3K",
  "6K",
  "12K",
  "14K",
  "16K",
];
const EQ_POSITIONS = [45, 35, 50, 40, 55, 38, 48, 42, 36, 52];
const VIS_COUNT = 28;

export default function Winamp() {
  const [state, setState] = useState<State>("idle");
  const [track, setTrack] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState("0:00");
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [history, setHistory] = useState<TrackData[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
  }, []);

  const fetchTrack = useCallback(async () => {
    unlockAudio();
    setState("loading");
    setError(null);
    setProgress(0);
    setCurrentTimeStr("0:00");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    cancelAnimationFrame(rafRef.current);
    try {
      const params = seenIds.length > 0 ? `?seen=${seenIds.join(",")}` : "";
      const res = await fetch(`/api/track${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: TrackData = await res.json();
      setSeenIds((prev) =>
        data.wasReset ? [data.trackId] : [...prev, data.trackId],
      );
      setTrack(data);
      setHistory((prev) => [data, ...prev].slice(0, 20));
      setState("playing");
    } catch {
      setError("LOAD ERROR");
      setState("idle");
    }
  }, [unlockAudio, seenIds]);

  useEffect(() => {
    if (state !== "playing" || !track) return;
    const startTime = track.startTime ?? 0;
    const endTime = track.endTime ?? 30;
    const duration = endTime - startTime;
    const audio = new Audio(track.previewUrl);
    audioRef.current = audio;

    const onReady = () => {
      audio.currentTime = startTime;
      audio
        .play()
        .then(() => {
          rafRef.current = requestAnimationFrame(tick);
        })
        .catch(() => setState("done"));
    };

    const tick = () => {
      const current = audio.currentTime;
      const elapsed = Math.max(0, current - startTime);
      setProgress(Math.min(elapsed / duration, 1));
      const mins = Math.floor(elapsed / 60).toString();
      const secs = Math.floor(elapsed % 60)
        .toString()
        .padStart(2, "0");
      setCurrentTimeStr(`${mins}:${secs}`);
      if (current >= endTime) {
        setState("done");
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const onError = () => {
      cancelAnimationFrame(rafRef.current);
      setState("done");
    };

    audio.addEventListener("loadedmetadata", onReady);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("error", onError);
      cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.src = "";
    };
  }, [state, track]);

  const isPlaying = state === "playing";
  const isLoading = state === "loading";
  const isDone = state === "done";
  const isIdle = state === "idle";

  const marqueeText = track
    ? `${track.trackName}  —  ${track.albumName}  —  Jay-Z`
    : "WINAMP 5.0  —  IT REALLY WHIPS THE LLAMA'S ASS!";

  // Duration display for playlist items
  const durStr = (t: TrackData) => {
    const d = t.endTime - t.startTime;
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className={styles.scene}>
      {track?.albumArt && (
        <div
          className={styles.bgBlur}
          style={{ backgroundImage: `url(${track.albumArt})` }}
        />
      )}

      <div className={styles.container}>
        {/* ── LEFT COLUMN ── */}
        <div className={styles.leftCol}>
          {/* PLAYER */}
          <div className={`${styles.window} ${styles.playerWindow}`}>
            <div className={styles.titleBar}>
              <div className={styles.titleBarLeft}>
                <span className={styles.titleText}>WINAMP</span>
              </div>
              <div className={styles.winActions}>
                <span className={styles.winActionBtn}>_</span>
                <span className={styles.winActionBtn}>▭</span>
                <span className={styles.winActionBtn}>✕</span>
              </div>
            </div>

            <div className={styles.mainBody}>
              {/* LCD */}
              <div className={styles.lcdContainer}>
                <div className={styles.lcdTop}>
                  <div className={styles.lcdPlayIcon}>
                    <svg
                      width="7"
                      height="8"
                      viewBox="0 0 7 8"
                      fill={isPlaying ? "#00cc00" : "#004400"}
                    >
                      <polygon points="0,0 7,4 0,8" />
                    </svg>
                  </div>
                  <div className={styles.timer}>{currentTimeStr}</div>
                  <div className={styles.lcdMeta}>
                    <div className={styles.trackInfo}>
                      {track ? `${track.trackName}` : "---"}
                    </div>
                    <div className={styles.kbpsRow}>
                      <div className={styles.kbpsBox}>
                        <span className={styles.kbpsNum}>
                          {isPlaying ? "128" : "0"}
                        </span>
                        <span className={styles.kbpsLabel}>kbps</span>
                      </div>
                      <div className={styles.kbpsBox}>
                        <span className={styles.kbpsNum}>
                          {isPlaying ? "44" : "0"}
                        </span>
                        <span className={styles.kbpsLabel}>khz</span>
                      </div>
                      <div className={styles.badges}>
                        <span className={styles.badge}>mono</span>
                        <span
                          className={`${styles.badge} ${isPlaying ? styles.badgeActive : ""}`}
                        >
                          stereo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visualizer */}
                <div className={styles.visContainer}>
                  {Array.from({ length: VIS_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      className={`${styles.visBar} ${isPlaying ? styles.animating : ""}`}
                      style={{ animationDelay: `${(i * 0.07).toFixed(2)}s` }}
                    />
                  ))}
                </div>

                {/* Marquee */}
                <div className={styles.marqueeWrap}>
                  <div className={styles.marquee}>{marqueeText}</div>
                </div>
              </div>

              {/* Seek */}
              <div className={styles.seekArea}>
                <div className={styles.seekTrack}>
                  <div
                    className={styles.seekFill}
                    style={{ width: `${progress * 100}%` }}
                  />
                  <div
                    className={styles.seekThumb}
                    style={{ left: `${progress * 100}%` }}
                  />
                </div>
              </div>

              {/* Vol / Bal */}
              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>vol</span>
                <div className={styles.sliderTrack} style={{ flex: 1.5 }}>
                  <div className={styles.sliderFill} style={{ width: "75%" }} />
                  <div className={styles.sliderThumb} style={{ left: "75%" }} />
                </div>
                <span className={styles.sliderLabel}>bal</span>
                <div className={styles.sliderTrack} style={{ flex: 1 }}>
                  <div className={styles.sliderFill} style={{ width: "50%" }} />
                  <div className={styles.sliderThumb} style={{ left: "50%" }} />
                </div>
              </div>

              {/* Transport */}
              <div className={styles.controls}>
                <button className={styles.btn} title="Prev">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="#aab0c8">
                    <polygon points="0,4.5 5,0 5,9" />
                    <rect x="5" y="0" width="2" height="9" />
                  </svg>
                </button>
                <button
                  className={styles.btn}
                  onClick={fetchTrack}
                  disabled={isLoading}
                  title="Play/Shuffle"
                >
                  {isLoading ? (
                    <span style={{ fontSize: 8, color: "#aab0c8" }}>···</span>
                  ) : (
                    <svg
                      width="9"
                      height="10"
                      viewBox="0 0 9 10"
                      fill="#aab0c8"
                    >
                      <polygon points="0,0 9,5 0,10" />
                    </svg>
                  )}
                </button>
                <button className={styles.btn} title="Pause">
                  <svg width="8" height="9" viewBox="0 0 8 9" fill="#aab0c8">
                    <rect x="0" y="0" width="3" height="9" />
                    <rect x="5" y="0" width="3" height="9" />
                  </svg>
                </button>
                <button
                  className={styles.btn}
                  onClick={() => {
                    setState("idle");
                    setProgress(0);
                    setCurrentTimeStr("0:00");
                  }}
                  title="Stop"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="#aab0c8">
                    <rect x="0" y="0" width="8" height="8" />
                  </svg>
                </button>
                <button className={styles.btn} title="Next">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="#aab0c8">
                    <polygon points="9,4.5 4,0 4,9" />
                    <rect x="1.5" y="0" width="2" height="9" />
                  </svg>
                </button>
                <button
                  className={`${styles.btn} ${styles.btnShuffle}`}
                  onClick={fetchTrack}
                  disabled={isLoading}
                >
                  ⇄ SHUFFLE
                </button>
              </div>
            </div>
          </div>

          {/* EQUALIZER */}
          <div
            className={`${styles.window} ${styles.eqWindow}`}
            style={{ marginTop: 1 }}
          >
            <div className={styles.titleBar}>
              <div className={styles.titleBarLeft}>
                <span className={styles.titleText}>WINAMP EQUALIZER</span>
              </div>
              <div className={styles.winActions}>
                <span className={styles.winActionBtn}>_</span>
                <span className={styles.winActionBtn}>✕</span>
              </div>
            </div>
            <div className={styles.eqBody}>
              <div className={styles.eqTop}>
                <div className={`${styles.eqToggle} ${styles.eqToggleOn}`}>
                  ON
                </div>
                <div className={`${styles.eqToggle} ${styles.eqToggleOff}`}>
                  AUTO
                </div>
                <div className={styles.eqPresets}>PRESETS</div>
              </div>
              <div className={styles.eqBands}>
                {/* Preamp */}
                <div className={styles.eqPreamp}>
                  <div className={styles.eqDb}>+12db</div>
                  <div className={styles.eqSliderWrap}>
                    <div className={styles.eqTrack}>
                      <div className={styles.eqThumb} style={{ top: "30%" }} />
                    </div>
                  </div>
                  <div className={styles.eqDb}>-12db</div>
                  <div className={styles.eqBandLabel}>PREAMP</div>
                </div>
                {EQ_BANDS.map((band, i) => (
                  <div key={band} className={styles.eqBand}>
                    <div className={styles.eqSliderWrap}>
                      <div className={styles.eqTrack}>
                        <div
                          className={styles.eqThumb}
                          style={{ top: `${EQ_POSITIONS[i]}%` }}
                        />
                      </div>
                    </div>
                    <div className={styles.eqBandLabel}>{band}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── PLAYLIST PANEL ── */}
        <div className={`${styles.window} ${styles.playlistWindow}`}>
          <div className={`${styles.titleBar} ${styles.playlistTitleBar}`}>
            <div className={styles.titleBarLeft}>
              <span className={styles.titleText}>WINAMP PLAYLIST</span>
            </div>
            <div className={styles.winActions}>
              <span className={styles.winActionBtn}>_</span>
              <span className={styles.winActionBtn}>▭</span>
              <span className={styles.winActionBtn}>✕</span>
            </div>
          </div>

          <div className={styles.playlistScroll}>
            {history.length === 0 ? (
              <div className={styles.playlistEmpty}>NO TRACKS PLAYED YET</div>
            ) : (
              history.map((t, i) => (
                <div
                  key={`${t.trackId}-${i}`}
                  className={`${styles.playlistItem} ${i === 0 ? styles.playlistItemActive : ""}`}
                >
                  <span className={styles.playlistNum}>{i + 1}.</span>
                  <span className={styles.playlistName}>
                    Jay-Z — {t.trackName}
                  </span>
                  <span className={styles.playlistDuration}>{durStr(t)}</span>
                </div>
              ))
            )}
            {error && <div className={styles.error}>{error}</div>}
          </div>

          <div className={styles.playlistFooter}>
            <button className={styles.footerBtn}>ADD</button>
            <button className={styles.footerBtn}>REM</button>
            <button className={styles.footerBtn}>SEL</button>
            <button className={styles.footerBtn}>MISC</button>
            <span className={styles.playlistTimer}>
              {track ? `${currentTimeStr} / ${durStr(track)}` : "0:00 / 0:00"}
            </span>
            <div className={styles.footerTransport}>
              <button
                className={styles.footerTransportBtn}
                onClick={fetchTrack}
                disabled={isLoading}
                title="Shuffle"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="#aab0c8">
                  <polygon points="0,0 8,4 0,8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
