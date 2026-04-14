"use client";

import { useState } from "react";
import DisplayToggle from "./components/DisplayToggle";
import WinampPlayer from "./components/WinampPlayer";
import Walkman from "./components/Walkman";

export default function Home() {
  const [currentVerse, setCurrentVerse] = useState<string>("");
  const [displayMode, setDisplayMode] = useState<"winamp" | "walkman">(
    "winamp",
  );

  const toggleMode = () => {
    setDisplayMode((prev) => (prev === "walkman" ? "winamp" : "walkman"));
  };

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden">
      {/* The Toggle Button */}
      <DisplayToggle mode={displayMode} onToggle={toggleMode} />
      Conditional Rendering
      <div className="w-full h-full flex items-center justify-center">
        {displayMode === "walkman" ? (
          <Walkman />
        ) : (
          <WinampPlayer
            onVerseChange={(verse, track) => setCurrentVerse(verse)}
          />
        )}
      </div>
    </main>
  );
}
