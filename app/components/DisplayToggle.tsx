"use client";

import styles from "./Toggle.module.css";

interface DisplayToggleProps {
  mode: "winamp" | "walkman";
  onToggle: () => void;
}

const DisplayToggle = ({ mode, onToggle }: DisplayToggleProps) => {
  return (
    <div className={styles.container}>
      <button
        onClick={onToggle}
        className="px-4 py-2 bg-zinc-900 text-xs font-mono border border-zinc-700 text-white rounded hover:bg-zinc-800 transition-colors uppercase tracking-widest shadow-xl"
      >
        {mode === "winamp" ? "📼 Switch to Walkman" : "⚡ Switch to Winamp"}
      </button>
    </div>
  );
};

export default DisplayToggle;
