import type { Metadata } from "next";
import "./globals.css";
import styles from "./Selection.module.css";

export const metadata: Metadata = {
  title: "Verse Generator",
  description: "Select your audio interface for the Jay-Z Verse Generator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased overflow-hidden">
        {/* Global UI Shell */}
        <div
          className={styles.container}
          style={{ height: "100vh", width: "100vw" }}
        >
          {/* The scanline effect is now global and sits above everything */}
          <div className={styles.scanlines} />

          {/* This is where page.tsx (Selection or Players) will render */}
          {children}
        </div>
      </body>
    </html>
  );
}
