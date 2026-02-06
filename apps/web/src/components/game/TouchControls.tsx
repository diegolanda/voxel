"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

interface TouchControlsProps {
  onBreak?: () => void;
  onPlace?: () => void;
  onJump?: () => void;
}

const containerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 20,
  pointerEvents: "none",
};

const btnBase: CSSProperties = {
  position: "absolute",
  pointerEvents: "auto",
  width: 56,
  height: 56,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.4)",
  background: "rgba(0,0,0,0.3)",
  color: "#fff",
  fontSize: 11,
  fontWeight: "bold",
  fontFamily: "monospace",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "none",
  userSelect: "none",
  padding: 0,
};

export function TouchControls({ onBreak, onPlace, onJump }: TouchControlsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  if (!isMobile) return null;

  return (
    <div style={containerStyle}>
      <button
        style={{ ...btnBase, bottom: 80, right: 16 }}
        onTouchStart={(e) => { e.preventDefault(); onBreak?.(); }}
      >
        Break
      </button>
      <button
        style={{ ...btnBase, bottom: 80, right: 80 }}
        onTouchStart={(e) => { e.preventDefault(); onPlace?.(); }}
      >
        Place
      </button>
      <button
        style={{ ...btnBase, bottom: 16, right: 48 }}
        onTouchStart={(e) => { e.preventDefault(); onJump?.(); }}
      >
        Jump
      </button>
    </div>
  );
}
