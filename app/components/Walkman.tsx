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
  trackId: string;
  wasReset: boolean;
}

export default function Walkman() {
  const [state, setState] = useState<State>("idle");
  const [track, setTrack] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [seenIds, setSeenIds] = useState<string[]>([]);

  // ── URL HELPER ──
  // Ensures the frontend always points to CloudFront
  // const getMediaUrl = (path: string) => {
  //   const cfBase = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || "";
  //   const cleanPath = path.startsWith("/") ? path : `/${path}`;
  //   return `${cfBase}${cleanPath}`;
  // };

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }, []);

  const stopCurrentAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
  }, []);

  const fetchTrack = useCallback(async () => {
    unlockAudio();
    stopCurrentAudio();
    setState("loading");
    setError(null);
    setProgress(0);

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
      setError("NO TAPE DETECTED");
      setState("idle");
    }
  }, [unlockAudio, stopCurrentAudio, seenIds]);

  useEffect(() => {
    if (state !== "playing" || !track) return;

    const startTime = track.startTime ?? 0;
    const endTime = track.endTime ?? 30;
    const duration = endTime - startTime;

    const audio = new Audio(track.previewUrl);
    audioRef.current = audio;

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
    audio.addEventListener("error", () => {
      setError("READ ERROR");
      setState("done");
    });

    return () => {
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
      {/* Dynamic Blurred Background */}
      {track?.albumArt && (
        <div
          className={styles.albumArtBg}
          style={{ backgroundImage: `url(${track.albumArt})` }}
        />
      )}

      <div className={styles.walkman}>
        {/* Physical Volume Knob Decoration */}
        <div className={styles.volumeWheel} />

        <div className={styles.topEdge}>
          <div className={styles.headphoneJack} />
          <span className={styles.brandLabel}>HOV-MAN</span>
          <div className={styles.holdSwitch}>HOLD</div>
        </div>

        {/* Cassette Mechanical Area */}
        <div className={styles.cassetteWindow}>
          <div className={styles.cassetteInner}>
            <div
              className={`${styles.reel} ${isPlaying ? styles.spinning : ""}`}
            >
              <div className={styles.reelHub}>
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <div
                    key={deg}
                    className={styles.reelSpoke}
                    style={{ transform: `rotate(${deg}deg)` }}
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
              className={`${styles.reel} ${isPlaying ? styles.spinning : ""}`}
            >
              <div className={styles.reelHub}>
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <div
                    key={deg}
                    className={styles.reelSpoke}
                    style={{ transform: `rotate(${deg}deg)` }}
                  />
                ))}
              </div>
              <div className={styles.reelOuter} />
            </div>
          </div>
        </div>

        {/* Digital Lens/Screen Area */}
        <div className={styles.screen}>
          <div className={styles.screenInner}>
            {/* 1. STARTING SCREEN (Idle State) */}
            {isIdle && (
              <div className={styles.screenIdle}>
                <div className={styles.screenBrand}>JAY-Z</div>
                <div className={styles.screenSub}>VERSE GENERATOR</div>
                <div className={styles.screenPrompt}>PRESS PLAY</div>
              </div>
            )}

            {/* 2. LOADING SCREEN */}
            {isLoading && (
              <div className={styles.screenLoading}>
                <div className={styles.loadingDots}>
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.screenSub}>READING TAPE...</div>
              </div>
            )}

            {/* 3. ACTIVE PLAYER VIEW (Playing or Done) */}
            {(isPlaying || isDone) && track && (
              <>
                <div className={styles.trackHeader}>
                  <img
                    src={track.albumArt}
                    className={styles.albumArtSmall}
                    alt="Art"
                  />
                  <div className={styles.trackInfoText}>
                    <span className={styles.artistName}>JAY-Z</span>
                    <span className={styles.screenTrackName}>
                      {track.trackName}
                    </span>
                  </div>
                </div>

                <div className={styles.verse}>
                  {track.verse.split("\n").map((line, i) => (
                    <div key={i} className={styles.verseLine}>
                      {line}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 4. ERROR VIEW */}
            {error && <div className={styles.screenError}>{error}</div>}

            {/* Always show Progress Bar frame, but maybe keep it empty if idle */}
            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tactile Control Panel */}
        <div className={styles.controls}>
          <button className={styles.btnCircle} disabled>
            <span className={styles.btnIcon}>◀◀</span>
          </button>

          <button
            className={`${styles.btnCircle} ${styles.btnPlay} ${isPlaying ? styles.btnActive : ""}`}
            onClick={fetchTrack}
            disabled={isLoading}
          >
            {isLoading ? "..." : isPlaying || isDone ? "SHUFFLE" : "PLAY"}
          </button>

          <button className={styles.btnCircle} disabled>
            <span className={styles.btnIcon}>▶▶</span>
          </button>
        </div>

        <div className={styles.bottomEdge}>
          <div className={styles.speakerGrill}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={styles.grillSlot} />
            ))}
          </div>
          <div className={styles.batteryDoor} />
        </div>
      </div>
    </div>
  );
}
