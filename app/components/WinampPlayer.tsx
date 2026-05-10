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
  onSwitchToWalkman?: () => void;
}

export default function WinampPlayer({
  onVerseChange,
  onSwitchToWalkman,
}: WinampPlayerProps) {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [lastId, setLastId] = useState<number>(0);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  const fetchTrack = useCallback(
    async (autoPlay = true) => {
      setLoading(true);
      setShouldAutoPlay(autoPlay);
      try {
        const params = new URLSearchParams();
        if (shuffle) {
          params.set("mode", "shuffle");
          if (seenIds.length > 0) params.set("seen", seenIds.join(","));
        } else {
          params.set("mode", "sequential");
          params.set("lastId", String(lastId));
        }

        const res = await fetch(`/api/track?${params.toString()}`);
        const data: Track = await res.json();

        setTrack(data);
        setLastId(Number(data.trackId));
        setSeenIds((prev) => [...prev, data.trackId]);
        setPlaylist((prev) => [data, ...prev]); // Newest at the top
        onVerseChange?.(data.verse, data);
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    },
    [seenIds, lastId, shuffle, onVerseChange],
  );

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
      if (shouldAutoPlay)
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
    };

    const handleTimeUpdate = () => {
      const elapsed = audio.currentTime - (track.startTime ?? 0);
      setCurrentTime(elapsed);
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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const jumpToTrack = (t: Track) => {
    setShouldAutoPlay(true);
    setTrack(t);
  };

  return (
    <div className={styles.screen}>
      <audio ref={audioRef} />

      {/* LEFT COLUMN */}
      <div className={styles.leftCol}>
        <div className={styles.windowFrame}>
          <div className={styles.titleBar}>
            <span className={styles.tbTitle}>MAIN PLAYER</span>
          </div>

          <div className={styles.vizRow}>
            {track?.albumArt && (
              <img src={track.albumArt} className={styles.albumArt} alt="" />
            )}
            <div className={styles.spectrumWrap}>
              {/* Simple bars that animate when playing */}
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className={`${styles.specBar} ${isPlaying ? styles.specActive : ""}`}
                  style={{
                    height: isPlaying ? `${Math.random() * 100}%` : "4px",
                  }}
                />
              ))}
            </div>
          </div>

          <div className={styles.infoRow}>
            <div className={styles.clock}>{formatTime(currentTime)}</div>
            <div className={styles.metaBlock}>
              <div className={styles.trackNameDisplay}>
                {track?.trackName || "READY"}
              </div>
            </div>
          </div>

          <div className={styles.transport}>
            <button className={styles.tBtn} onClick={togglePlay}>
              {isPlaying ? "PAUSE" : "PLAY"}
            </button>
            <button className={styles.tBtn} onClick={() => fetchTrack(true)}>
              NEXT VERSE
            </button>
          </div>
        </div>

        <div className={styles.windowFrame} style={{ flex: 1 }}>
          <div className={styles.titleBar}>
            <span className={styles.tbTitle}>HISTORY</span>
          </div>
          <div className={styles.darkList}>
            {playlist.map((t, i) => (
              <div
                key={`${t.trackId}-${i}`}
                className={`${styles.plRow} ${track?.trackId === t.trackId ? styles.plActive : ""}`}
                onClick={() => jumpToTrack(t)}
              >
                {playlist.length - i}. {t.trackName}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className={styles.rightCol}>
        <div className={styles.windowFrame} style={{ height: "100%" }}>
          <div className={styles.titleBar}>
            <span className={styles.tbTitle}>LYRICS EDITOR</span>
          </div>
          <div className={styles.darkList}>
            {/* CRITICAL: Ensure this mapping is correct */}
            {track?.verse ? (
              track.verse.split("\n").map((line, i) => (
                <p key={i} className={styles.lyricLine}>
                  {line}
                </p>
              ))
            ) : (
              <p className={styles.lyricsEmpty}>NO LYRICS LOADED</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
