import React from "react";

export const BRIGHT_ICON_PATHS: Record<string, string> = {
  "mail": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"m3 7 9 6 9-6\"/>",
  "cal": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"/><path d=\"M3 9h18M8 2v4M16 2v4\"/>",
  "chat": "<path d=\"M4 5h16v11H9l-5 4z\"/>",
  "cloud": "<path d=\"M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z\"/>",
  "grid": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/>",
  "check": "<path d=\"m5 12 5 5 9-10\"/>",
  "plug": "<path d=\"M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5\"/>",
  "hook": "<circle cx=\"6\" cy=\"17\" r=\"3\"/><circle cx=\"18\" cy=\"17\" r=\"3\"/><circle cx=\"12\" cy=\"6\" r=\"3\"/><path d=\"M12 9l-4 5M9 17h6M14.5 8.5 17 14\"/>",
  "key": "<circle cx=\"8\" cy=\"15\" r=\"4\"/><path d=\"m11 12 9-9M16 7l3 3\"/>",
  "doc": "<path d=\"M6 3h8l4 4v14H6z\"/><path d=\"M14 3v4h4M9 13h6M9 17h6\"/>",
  "send": "<path d=\"m22 2-11 11M22 2l-7 20-4-9-9-4z\"/>",
  "lock": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/>",
  "refresh": "<path d=\"M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4\"/>",
  "shield": "<path d=\"M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z\"/><path d=\"m9 12 2 2 4-4\"/>",
  "bolt": "<path d=\"M13 2 4 14h7l-1 8 9-12h-7z\"/>",
  "x": "<path d=\"M6 6l12 12M18 6 6 18\"/>",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6M12 7.5v.5\"/>",
  "alert": "<path d=\"M12 3 2 20h20z\"/><path d=\"M12 10v5M12 17.5v.5\"/>",
  "copy": "<rect x=\"9\" y=\"9\" width=\"11\" height=\"11\" rx=\"2\"/><path d=\"M5 15V6a2 2 0 0 1 2-2h9\"/>",
  "trash": "<path d=\"M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  "db": "<ellipse cx=\"12\" cy=\"6\" rx=\"8\" ry=\"3\"/><path d=\"M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3\"/>",
  "card": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M3 10h18\"/>",
  "users": "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2 20c0-4 3-6 7-6s7 2 7 6M17 5a3.5 3.5 0 0 1 0 7M22 20c0-3-1.5-5-4-5.7\"/>",
  "link": "<path d=\"M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1\"/>",
  "star": "<path d=\"m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z\"/>",
  "chart": "<path d=\"M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-8\"/>",
};

export interface BrightIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export const BrightIcon: React.FC<BrightIconProps> = ({ name, className = "i", style }) => {
  const innerHtml = BRIGHT_ICON_PATHS[name] || BRIGHT_ICON_PATHS["plug"] || "";
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: innerHtml }}
    />
  );
};
