"use client";

// import { useState } from "react";
// import DisplayToggle from "./components/DisplayToggle";
// import Winamp from "./components/Winamp";
import Walkman from "./components/Walkman";

export default function Home() {
  // const [displayMode, setDisplayMode] = useState<"winamp" | "walkman">(
  //   "winamp",
  // );

  // const toggleMode = () => {
  //   setDisplayMode((prev) => (prev === "winamp" ? "walkman" : "winamp"));
  // };

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden">
      <Walkman />

      {/* The Toggle Button */}
      {/* <DisplayToggle mode={displayMode} onToggle={toggleMode} />
      Conditional Rendering
      <div className="w-full h-full flex items-center justify-center">
        {displayMode === "winamp" ? <Winamp /> : <Walkman />}
      </div> */}
    </main>
  );
}
