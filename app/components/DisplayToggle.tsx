"use client";

import styles from "./Toggle.module.css";

interface DisplayToggleProps {
  mode: "winamp" | "walkman";
  onToggle: () => void;
}

const DisplayToggle = ({ mode, onToggle }: DisplayToggleProps) => {
  return (
    <div className={styles.container}>
      <button onClick={onToggle} className={styles.button}>
        {mode === "winamp" ? "📼 Switch to Walkman" : "⚡ Switch to Winamp"}
      </button>
    </div>
  );
};

export default DisplayToggle;
