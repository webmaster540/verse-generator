"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import WinampPlayer from "./components/WinampPlayer";
import Walkman from "./components/Walkman";
import styles from "./Selection.module.css";

function PlayerController() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get("view");

  const setView = (mode: string) => router.push(`/?view=${mode}`);

  // 1. SELECTION VIEW
  if (!view) {
    return (
      <>
        <div className={styles.grid}>
          <button
            className={`${styles.card} ${styles.cardWalkman}`}
            onClick={() => setView("walkman")}
          >
            <span className={styles.cardLabel}>View</span>
            <h2 className={styles.cardTitle}>WALKMAN</h2>
          </button>

          <button
            className={`${styles.card} ${styles.cardWinamp}`}
            onClick={() => setView("winamp")}
          >
            <span className={styles.cardLabel}>View</span>
            <h2 className={styles.cardTitle}>WINAMP</h2>
          </button>
        </div>
      </>
    );
  }

  // 2. PLAYER VIEW
  return (
    <div className="w-full h-full flex items-center justify-center relative z-20">
      {view === "walkman" ? (
        <Walkman />
      ) : (
        <WinampPlayer onSwitchToWalkman={() => setView("walkman")} />
      )}

      <button className={styles.exitBtn} onClick={() => router.push("/")}>
        ← Disconnect Interface
      </button>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="text-white/20 uppercase text-[10px] tracking-widest">
          Loading...
        </div>
      }
    >
      <PlayerController />
    </Suspense>
  );
}
