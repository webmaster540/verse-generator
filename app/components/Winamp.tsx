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

export default function Winamp() {
  const [state, setState] = useState<State>("idle");
  const [track, setTrack] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState("00:00");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [seenIds, setSeenIds] = useState<string[]>([]);

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
  }, []);

  const fetchTrack = useCallback(async () => {
    unlockAudio();
    setState("loading");
    setError(null);
    setProgress(0);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    cancelAnimationFrame(rafRef.current);

    try {
      const params = seenIds.length > 0 ? `?seen=${seenIds.join(",")}` : "";
      const res = await fetch(`/api/track${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setSeenIds((prev) =>
        data.wasReset ? [data.trackId] : [...prev, data.trackId],
      );
      setTrack(data);
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

    const tick = () => {
      const current = audio.currentTime;
      const elapsed = current - startTime;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);

      const mins = Math.floor(elapsed / 60)
        .toString()
        .padStart(2, "0");
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

    audio.onloadedmetadata = () => {
      audio.currentTime = startTime;
      audio.play().then(() => {
        rafRef.current = requestAnimationFrame(tick);
      });
    };

    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.src = "";
    };
  }, [state, track]);

  return (
    <div className={styles.screen}>
      {track?.albumArt && (
        <div
          className={styles.bgBlur}
          style={{ backgroundImage: `url(${track.albumArt})` }}
        />
      )}

      <div className={styles.winampStack}>
        {/* --- MAIN PLAYER --- */}
        <div className={styles.window}>
          <div className={styles.titleBar}>
            <div className={styles.winIcon} />
            <span className={styles.titleText}>WINAMP</span>
            <div className={styles.winActions}>
              <span>_</span>
              <span>X</span>
            </div>
          </div>
          <div className={styles.mainBody}>
            <div className={styles.lcdContainer}>
              <div className={styles.lcdTop}>
                <div className={styles.timer}>{currentTimeStr}</div>
                <div className={styles.visContainer}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className={`${styles.visBar} ${state === "playing" ? styles.animating : ""}`}
                      style={{
                        height: `${20 + Math.random() * 80}%`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.kbpsInfo}>
                {state === "playing" ? "128 kbps 44 khz" : "0 kbps 0 khz"}
              </div>
              <div className={styles.marqueeContainer}>
                <div className={styles.marquee}>
                  {track
                    ? `${track.trackName} - ${track.albumName}`
                    : "WINAMP 5.0 - IT REALLY WHIPS THE LLAMA'S ASS!"}
                </div>
              </div>
            </div>

            <div className={styles.seekArea}>
              <div className={styles.seekTrack}>
                <div
                  className={styles.seekThumb}
                  style={{ left: `${progress * 100}%` }}
                />
              </div>
            </div>

            <div className={styles.controls}>
              <button className={styles.btn}>PREV</button>
              <button className={styles.btnPlay} onClick={fetchTrack}>
                {state === "loading" ? "..." : "PLAY"}
              </button>
              <button className={styles.btn} onClick={() => setState("idle")}>
                STOP
              </button>
              <button className={styles.btn}>NEXT</button>
              <div className={styles.eject} onClick={fetchTrack}>
                ⏏
              </div>
            </div>
          </div>
        </div>

        {/* --- LYRICS / VERSE WINDOW --- */}
        <div className={styles.window}>
          <div className={styles.titleBar}>
            <span className={styles.titleText}>WINAMP LYRICS / VERSE</span>
          </div>
          <div className={styles.lyricsBody}>
            {track ? (
              <div className={styles.verseContent}>
                {track.verse.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <div className={styles.lyricsPlaceholder}>NO TRACK LOADED</div>
            )}
          </div>
        </div>

        {/* --- PLAYLIST EDITOR --- */}
        <div className={styles.window}>
          <div className={styles.titleBar}>
            <span className={styles.titleText}>PLAYLIST EDITOR</span>
          </div>
          <div className={styles.playlistBody}>
            <div className={styles.playlistEntry}>
              <span className={styles.entryTitle}>
                1. {track ? track.trackName : "---"}
              </span>
              <span className={styles.entryTime}>
                {track ? "0:30" : "0:00"}
              </span>
            </div>
            {error && <div className={styles.error}>{error}</div>}
          </div>
          <div className={styles.playlistFooter}>
            <button className={styles.footerBtn}>+ ADD</button>
            <button className={styles.footerBtn}>- REM</button>
            <button className={styles.footerBtn}>SEL</button>
            <button className={styles.footerBtn}>MISC</button>
          </div>
        </div>
      </div>
    </div>
  );
}
