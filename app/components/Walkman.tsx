"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import styles from "./Walkman.module.css";

type State = "idle" | "loading" | "playing" | "done";

interface TrackData {
  trackName: string;
  albumName: string;
  albumArt: string;
  previewUrl: string;
  startTime: number;
  endTime: number;
  verse: string;
}

export default function Walkman() {
  const [state, setState] = useState<State>("idle");
  const [track, setTrack] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }, []);

  const fetchTrack = useCallback(async () => {
    unlockAudio();
    setState("loading");
    setError(null);
    setProgress(0);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);

    try {
      const res = await fetch("/api/track");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: TrackData = await res.json();
      setTrack(data);
      setState("playing");
    } catch {
      setError("Could not load track.");
      setState("idle");
    }
  }, [unlockAudio]);

  useEffect(() => {
    if (state !== "playing" || !track) return;

    const startTime = track.startTime ?? 0;
    const endTime = track.endTime ?? 30;
    const duration = endTime - startTime;

    if (duration <= 0) {
      setError("Invalid start/end time in track data.");
      setState("done");
      return;
    }

    const audio = new Audio(track.previewUrl);
    audioRef.current = audio;

    // Keep references to handlers so we can remove them during cleanup
    const onReady = async () => {
      try {
        if (audioCtxRef.current?.state === "suspended") {
          await audioCtxRef.current.resume();
        }
        audio.currentTime = startTime;
        await audio.play();
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("Playback error:", err);
        setState("done");
      }
    };

    const onError = () => {
      cancelAnimationFrame(rafRef.current);
      setError("Audio file not found. Check /public/audio/ filename.");
      setState("done");
    };

    const tick = () => {
      const elapsed = audio.currentTime - startTime;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);

      if (audio.currentTime >= endTime) {
        audio.pause();
        cancelAnimationFrame(rafRef.current);
        setProgress(1);
        setState("done");
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    audio.addEventListener("loadedmetadata", onReady);
    audio.addEventListener("error", onError);

    return () => {
      // Remove listeners BEFORE clearing src so the error event
      // doesn't fire during cleanup and show a false error message
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("error", onError);
      cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.src = "";
    };
  }, [state, track]);

  const isPlaying = state === "playing";
  const isDone = state === "done";
  const isLoading = state === "loading";
  const isIdle = state === "idle";

  return (
    <div className={styles.scene}>
      <div className={styles.walkman}>
        <div className={styles.topEdge}>
          <div className={styles.headphoneJack} />
          <span className={styles.brandLabel}>WALKMAN</span>
          <div className={styles.holdSwitch}>HOLD</div>
        </div>

        <div className={styles.cassetteWindow}>
          <div className={styles.cassetteInner}>
            <div
              className={`${styles.reel} ${styles.reelLeft} ${isPlaying ? styles.spinning : ""}`}
            >
              <div className={styles.reelHub}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={styles.reelSpoke}
                    style={{ transform: `rotate(${i * 60}deg)` }}
                  />
                ))}
              </div>
              <div className={styles.reelOuter} />
            </div>

            <div className={styles.tapeGuide}>
              <div className={styles.tapeHead} />
              <div
                className={`${styles.tapeLine} ${isPlaying ? styles.tapeMoving : ""}`}
              />
            </div>

            <div
              className={`${styles.reel} ${styles.reelRight} ${isPlaying ? styles.spinning : ""}`}
            >
              <div className={styles.reelHub}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={styles.reelSpoke}
                    style={{ transform: `rotate(${i * 60}deg)` }}
                  />
                ))}
              </div>
              <div className={styles.reelOuter} />
            </div>
          </div>

          <div className={styles.cassetteLabel}>
            {track ? (
              <>
                {/* <span className={styles.cassetteLabelTrack}>
                  {track.trackName}
                </span> */}
                <span className={styles.cassetteLabelAlbum}>
                  {track.albumName}
                </span>
              </>
            ) : (
              <span className={styles.cassetteLabelTrack}>JAY-Z</span>
            )}
          </div>
        </div>

        <div className={styles.screen}>
          <div className={styles.screenInner}>
            {isIdle && (
              <div className={styles.screenIdle}>
                <div className={styles.screenBrand}>JAY-Z</div>
                <div className={styles.screenSub}>
                  BLUEPRINT · BLACK ALBUM · REASONABLE DOUBT
                </div>
                <div className={styles.screenPrompt}>PRESS PLAY</div>
              </div>
            )}

            {isLoading && (
              <div className={styles.screenLoading}>
                <div className={styles.loadingDots}>
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.screenSub}>LOADING TRACK</div>
              </div>
            )}

            {(isPlaying || isDone) && track && (
              <div className={styles.screenPlaying}>
                <div className={styles.screenTrackName}>{track.trackName}</div>
                <div className={styles.screenDivider} />
                <div className={styles.verse}>
                  {track.verse.split("\n").map((line, i) => (
                    <div key={i} className={styles.verseLine}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <div className={styles.screenError}>{error}</div>}

            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          <button
            className={`${styles.controlBtn} ${styles.btnSmall}`}
            disabled
          >
            <span className={styles.btnIcon}>◀◀</span>
          </button>

          <button
            className={`${styles.controlBtn} ${styles.btnMain} ${isPlaying ? styles.btnActive : ""}`}
            onClick={fetchTrack}
            disabled={isLoading || isPlaying}
          >
            {isIdle && <span>▶ PLAY</span>}
            {isLoading && <span>···</span>}
            {isPlaying && <span>▶ PLAYING</span>}
            {isDone && <span>⇄ SHUFFLE</span>}
          </button>

          <button
            className={`${styles.controlBtn} ${styles.btnSmall}`}
            disabled
          >
            <span className={styles.btnIcon}>▶▶</span>
          </button>
        </div>

        <div className={styles.bottomEdge}>
          <div className={styles.speakerGrill}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={styles.grillSlot} />
            ))}
          </div>
          <div className={styles.batteryDoor} />
        </div>
      </div>

      {track?.albumArt && (
        <div
          className={styles.albumArtBg}
          style={{ backgroundImage: `url(${track.albumArt})` }}
        />
      )}
    </div>
  );
}
