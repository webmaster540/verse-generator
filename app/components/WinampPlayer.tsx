"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./WinampPlayer.module.css";

interface Track {
  trackId: string;
  trackName: string;
  albumName: string;
  albumArt: string;
  previewUrl: string;
  startTime: number;
  endTime: number;
  verse: string;
  wasReset?: boolean;
}

interface WinampPlayerProps {
  onVerseChange?: (verse: string, track: Track) => void;
}

const EQ_BANDS = [
  "PRE",
  "60",
  "170",
  "310",
  "600",
  "1K",
  "3K",
  "6K",
  "12K",
  "16K",
];

export default function WinampPlayer({ onVerseChange }: WinampPlayerProps) {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [balance, setBalance] = useState(0);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [eqOn, setEqOn] = useState(true);
  const [eqAuto, setEqAuto] = useState(false);
  const [eqCurve, setEqCurve] = useState<number[]>(Array(10).fill(0));
  const eqValuesRef = useRef<number[]>(Array(10).fill(0));
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const titleInnerRef = useRef<HTMLSpanElement>(null);

  const fetchTrack = useCallback(
    async (autoPlay = true) => {
      setLoading(true);
      setShouldAutoPlay(autoPlay);
      try {
        const params = seenIds.length > 0 ? `?seen=${seenIds.join(",")}` : "";
        const res = await fetch(`/api/track${params}`);
        const data: Track = await res.json();
        setTrack(data);
        setSeenIds((prev) => [...prev, data.trackId]);
        setPlaylist((prev) => [...prev, data]);
        onVerseChange?.(data.verse, data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [seenIds, onVerseChange],
  );

  // Initial load — don't auto-play (let user press play)
  useEffect(() => {
    fetchTrack(false);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    audio.src = track.previewUrl;
    audio.currentTime = track.startTime ?? 0;
    audio.volume = volume / 100;

    const handleLoaded = () => {
      setDuration(
        track.endTime ? track.endTime - (track.startTime ?? 0) : audio.duration,
      );
      if (shouldAutoPlay) {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    };

    let lastSecond = -1;
    const handleTimeUpdate = () => {
      const elapsed = audio.currentTime - (track.startTime ?? 0);
      const currentSecond = Math.floor(elapsed);

      // Only trigger re-render once per second
      if (currentSecond !== lastSecond) {
        lastSecond = currentSecond;
        setCurrentTime(elapsed);
      }

      // End-of-verse check still runs every tick
      if (track.endTime && audio.currentTime >= track.endTime) {
        if (repeat) {
          audio.currentTime = track.startTime ?? 0;
        } else {
          audio.pause();
          setIsPlaying(false);
        }
      }
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [track, repeat, shouldAutoPlay]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    audio.pause();
    audio.currentTime = track.startTime ?? 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    const val = Number(e.target.value);
    audio.currentTime = (track.startTime ?? 0) + val;
    setCurrentTime(val);
  };

  const jumpToTrack = (t: Track) => {
    setShouldAutoPlay(true);
    setTrack(t);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const trackLabel = track
    ? `${track.trackName} - ${track.albumName}`
    : "NO TRACK LOADED";

  // Split verse into lines for display
  const verseLines = track?.verse
    ? track.verse.split(/\n/).filter((l) => l.trim().length > 0)
    : [];

  return (
    <div className={styles.screen}>
      <audio ref={audioRef} />

      {/* ── LEFT COLUMN: player + eq ── */}
      <div className={styles.leftCol}>
        {/* MAIN PLAYER */}
        <div className={styles.player}>
          <div className={styles.titleBar}>
            <div className={styles.tbLeft}>
              <span className={styles.tbDot} />
              <span className={styles.tbTitle}>WINAMP</span>
            </div>
            <div className={styles.tbRight}>
              <button className={styles.tbBtn}>_</button>
              <button className={styles.tbBtn}>□</button>
              <button className={styles.tbBtn}>×</button>
            </div>
          </div>

          <div className={styles.vizRow}>
            <div className={styles.albumWrap}>
              {track?.albumArt ? (
                <img src={track.albumArt} alt="" className={styles.albumArt} />
              ) : (
                <div className={styles.albumBlank} />
              )}
            </div>
            <div className={styles.spectrumWrap}>
              {Array.from({ length: 32 }).map((_, i) => (
                <div
                  key={i}
                  className={`${styles.specBar} ${isPlaying ? styles.specActive : ""}`}
                  style={{ animationDelay: `${i * 0.035}s` }}
                />
              ))}
            </div>
          </div>

          <div className={styles.infoRow}>
            <div className={styles.clockBlock}>
              <span className={styles.clock}>{formatTime(currentTime)}</span>
            </div>
            <div className={styles.metaBlock}>
              <div className={styles.scrollTrack} ref={titleRef}>
                <span ref={titleInnerRef} className={styles.marqueeText}>
                  {loading ? "LOADING..." : `${trackLabel} · ${trackLabel}`}
                </span>
              </div>
              <div className={styles.statRow}>
                <span>128 KBPS</span>
                <span className={styles.sep}>·</span>
                <span>44 KHZ</span>
                <span className={styles.sep}>·</span>
                <span>STEREO</span>
              </div>
            </div>
          </div>

          <div className={styles.seekRow}>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className={styles.seekBar}
            />
          </div>

          <div className={styles.knobRow}>
            <div className={styles.knobGroup}>
              <span className={styles.knobLabel}>VOL</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className={styles.knob}
              />
            </div>
            <div className={styles.knobGroup}>
              <span className={styles.knobLabel}>BAL</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                className={styles.knob}
              />
            </div>
          </div>

          <div className={styles.transport}>
            <button
              className={styles.tBtn}
              onClick={() => {
                const p = playlist[playlist.length - 2];
                if (p) jumpToTrack(p);
              }}
            >
              ⏮
            </button>
            <button
              className={styles.tBtn}
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime -= 5;
              }}
            >
              ⏪
            </button>
            <button
              className={`${styles.tBtn} ${styles.playBtn} ${isPlaying ? styles.tActive : ""}`}
              onClick={togglePlay}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button className={styles.tBtn} onClick={handleStop}>
              ⏹
            </button>
            <button
              className={styles.tBtn}
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime += 5;
              }}
            >
              ⏩
            </button>
            <button className={styles.tBtn} onClick={() => fetchTrack(true)}>
              ⏭
            </button>
          </div>

          <div className={styles.modeRow}>
            <button
              className={`${styles.modeBtn} ${shuffle ? styles.modeOn : ""}`}
              onClick={() => setShuffle((s) => !s)}
            >
              SHUF
            </button>
            <button
              className={`${styles.modeBtn} ${repeat ? styles.modeOn : ""}`}
              onClick={() => setRepeat((r) => !r)}
            >
              REP
            </button>
            <span className={styles.modeSpacer} />
            <button className={styles.modeBtn}>EQ</button>
            <button className={styles.modeBtn}>PL</button>
          </div>
        </div>

        {/* EQUALIZER */}
        <div className={styles.equalizer}>
          <div className={styles.titleBar}>
            <div className={styles.tbLeft}>
              <span className={styles.tbDot} />
              <span className={styles.tbTitle}>WINAMP EQUALIZER</span>
            </div>
            <div className={styles.tbRight}>
              <button className={styles.tbBtn}>_</button>
              <button className={styles.tbBtn}>□</button>
              <button className={styles.tbBtn}>×</button>
            </div>
          </div>
          <div className={styles.eqBody}>
            {/* Controls + curve preview */}
            <div className={styles.eqControls}>
              <button
                className={`${styles.eqBtn} ${eqOn ? styles.modeOn : ""}`}
                onClick={() => setEqOn((v) => !v)}
              >
                ON
              </button>
              <button
                className={`${styles.eqBtn} ${eqAuto ? styles.modeOn : ""}`}
                onClick={() => setEqAuto((v) => !v)}
              >
                AUTO
              </button>
              {/* SVG curve preview — only re-renders when fader released */}
              <svg
                className={styles.eqCurve}
                viewBox="0 0 200 28"
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  stroke="#cc9900"
                  strokeWidth="1.5"
                  points={eqCurve
                    .map((v, i) => {
                      const x = (i / (EQ_BANDS.length - 1)) * 200;
                      const y = 14 - (v / 12) * 12;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
                <line
                  x1="0"
                  y1="14"
                  x2="200"
                  y2="14"
                  stroke="#1a3a5a"
                  strokeWidth="0.5"
                  strokeDasharray="3,3"
                />
              </svg>
              <button className={styles.eqBtn}>PRESETS</button>
            </div>

            {/* dB axis + fader columns */}
            <div className={styles.eqMain}>
              {/* dB labels */}
              <div className={styles.eqDbAxis}>
                <span className={styles.eqDbLabel}>+12db</span>
                <span className={styles.eqDbLabel}>+0 db</span>
                <span className={styles.eqDbLabel}>-12db</span>
              </div>

              {/* Band columns */}
              <div className={styles.eqBands}>
                {EQ_BANDS.map((band, i) => (
                  <div key={band} className={styles.eqBand}>
                    <div className={styles.eqTrack}>
                      <div className={styles.eqBarFill} />
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        defaultValue={0}
                        className={styles.eqFader}
                        onChange={(e) => {
                          eqValuesRef.current[i] = Number(e.target.value);
                        }}
                        onMouseUp={() => setEqCurve([...eqValuesRef.current])}
                        onTouchEnd={() => setEqCurve([...eqValuesRef.current])}
                      />
                    </div>
                    <span className={styles.eqLabel}>{band}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: lyrics on top, playlist below ── */}
      <div className={styles.rightCol}>
        {/* LYRICS */}
        <div className={styles.lyrics}>
          <div className={styles.titleBar}>
            <div className={styles.tbLeft}>
              <span className={styles.tbDot} />
              <span className={styles.tbTitle}>LYRICS</span>
            </div>
          </div>
          <div className={styles.lyricsBody}>
            {verseLines.length === 0 ? (
              <p className={styles.lyricsEmpty}>NO LYRICS LOADED</p>
            ) : (
              verseLines.map((line, i) => (
                <p key={i} className={styles.lyricLine}>
                  {line}
                </p>
              ))
            )}
          </div>
        </div>

        {/* PLAYLIST */}
        <div className={styles.playlist}>
          <div className={styles.titleBar}>
            <div className={styles.tbLeft}>
              <span className={styles.tbDot} />
              <span className={styles.tbTitle}>WINAMP PLAYLIST EDITOR</span>
            </div>
            <div className={styles.tbRight}>
              <button className={styles.tbBtn}>_</button>
              <button className={styles.tbBtn}>□</button>
              <button className={styles.tbBtn}>×</button>
            </div>
          </div>
          <div className={styles.plList}>
            {playlist.length === 0 && (
              <div className={styles.plEmpty}>NO TRACKS LOADED</div>
            )}
            {playlist.map((t, i) => (
              <div
                key={t.trackId + i}
                className={`${styles.plRow} ${track?.trackId === t.trackId ? styles.plActive : ""}`}
                onClick={() => jumpToTrack(t)}
              >
                <span className={styles.plIdx}>{i + 1}.</span>
                <span className={styles.plName}>
                  {t.trackName} — {t.albumName}
                </span>
                <span className={styles.plDur}>
                  {formatTime((t.endTime ?? 0) - (t.startTime ?? 0))}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.plFooter}>
            <div className={styles.plFootLeft}>
              <button
                className={styles.plBtn}
                onClick={() => fetchTrack(false)}
              >
                ADD
              </button>
              <button className={styles.plBtn}>REM</button>
              <button className={styles.plBtn}>SEL</button>
              <button
                className={styles.plBtn}
                onClick={() => {
                  setPlaylist([]);
                  setSeenIds([]);
                }}
              >
                MISC
              </button>
            </div>
            <div className={styles.plFootRight}>
              <span className={styles.plCount}>
                {formatTime(
                  playlist.reduce(
                    (a, t) => a + ((t.endTime ?? 0) - (t.startTime ?? 0)),
                    0,
                  ),
                )}
              </span>
              <button className={styles.plBtn}>LIST</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
