/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface WoWFactionCrestProps {
  faction?: "HORDE" | "ALLIANCE" | "NEUTRAL" | string;
  size?: number | string;
  className?: string;
  opacity?: number;
  glow?: boolean;
}

/**
 * Authentic vector SVG crests for World of Warcraft factions (Horde, Alliance, Neutral)
 * Zero network dependencies: immune to 404s, CORS, or broken CDN images.
 */
export const WoWFactionCrest: React.FC<WoWFactionCrestProps> = ({
  faction = "ALLIANCE",
  size = 120,
  className = "",
  opacity = 1,
  glow = true,
}) => {
  const normFaction = (faction || "ALLIANCE").toUpperCase();
  const isHorde = normFaction.includes("HORDE") || normFaction.includes("HORDA");
  const isAlliance = normFaction.includes("ALLIANCE") || normFaction.includes("ALIANÇA") || normFaction.includes("ALIANCA");

  if (isHorde) {
    return (
      <div
        className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
        style={{ width: size, height: size, opacity }}
      >
        {glow && (
          <div className="absolute inset-2 rounded-full bg-red-600/35 blur-2xl animate-pulse pointer-events-none" />
        )}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_6px_20px_rgba(220,38,38,0.85)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="hordeRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>
            <linearGradient id="hordeDarkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7F1D1D" />
              <stop offset="100%" stopColor="#450A0A" />
            </linearGradient>
          </defs>

          {/* Outer Runic War Ring */}
          <circle cx="50" cy="50" r="46" stroke="#EF4444" strokeWidth="2" strokeDasharray="6 3" opacity="0.8" />
          <circle cx="50" cy="50" r="43" stroke="#B91C1C" strokeWidth="1" opacity="0.5" />

          {/* Horde War Crest: Tribal spikes and central iconic totem */}
          <g>
            {/* Upper central crest spikes */}
            <path
              d="M50 6 L55 22 L64 12 L59 30 L71 20 L64 38 L76 33 L67 48 L78 45 L66 58 L50 49 L34 58 L22 45 L33 48 L24 33 L36 38 L29 20 L41 30 L36 12 L45 22 Z"
              fill="url(#hordeRedGrad)"
              stroke="#FCA5A5"
              strokeWidth="0.75"
            />

            {/* Horned lower ring curves */}
            <path
              d="M50 54 C64 54 74 65 72 79 C70 90 60 95 50 95 C40 95 30 90 28 79 C26 65 36 54 50 54 Z"
              fill="url(#hordeDarkGrad)"
              stroke="#DC2626"
              strokeWidth="1.5"
            />
            {/* Inner cutout ring */}
            <path
              d="M50 62 C58 62 64 68 63 77 C62 83 57 87 50 87 C43 87 38 83 37 77 C36 68 42 62 50 62 Z"
              fill="#18181B"
            />
            {/* Tribal center heart spikes */}
            <path d="M50 38 L56 58 L50 65 L44 58 Z" fill="#F87171" />
            <circle cx="50" cy="75" r="4" fill="#F87171" stroke="#FEF2F2" strokeWidth="1" />
          </g>

          {/* Rune marks */}
          <path d="M20 62 L13 73 L20 76 Z" fill="#EF4444" />
          <path d="M80 62 L87 73 L80 76 Z" fill="#EF4444" />
        </svg>
      </div>
    );
  }

  if (isAlliance) {
    return (
      <div
        className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
        style={{ width: size, height: size, opacity }}
      >
        {glow && (
          <div className="absolute inset-2 rounded-full bg-blue-600/35 blur-2xl animate-pulse pointer-events-none" />
        )}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_6px_20px_rgba(37,99,235,0.85)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="allianceBlueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="50%" stopColor="#1D4ED8" />
              <stop offset="100%" stopColor="#172554" />
            </linearGradient>
            <linearGradient id="allianceGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>

          {/* Outer Golden Laurel Ring */}
          <circle cx="50" cy="50" r="46" stroke="#FBBF24" strokeWidth="2" strokeDasharray="4 3" opacity="0.8" />
          <circle cx="50" cy="50" r="43" stroke="#60A5FA" strokeWidth="1" opacity="0.6" />

          {/* Alliance Crest: Heraldic Shield with Crowned Golden Lion */}
          <g>
            {/* Heraldic Shield */}
            <path
              d="M50 10 L80 18 L76 62 C74 76 63 88 50 94 C37 88 26 76 24 62 L20 18 Z"
              fill="url(#allianceBlueGrad)"
              stroke="#F59E0B"
              strokeWidth="2.5"
            />

            {/* Golden Lion Crown */}
            <path d="M37 28 L42 19 L50 24 L58 19 L63 28 L50 26 Z" fill="url(#allianceGoldGrad)" stroke="#78350F" strokeWidth="0.5" />
            <circle cx="50" cy="19" r="2" fill="#FEF08A" />
            <circle cx="42" cy="19" r="1.5" fill="#FEF08A" />
            <circle cx="58" cy="19" r="1.5" fill="#FEF08A" />

            {/* Stylized Lion Face / Mane */}
            <path
              d="M50 30 C59 30 65 37 65 48 C65 59 59 67 50 69 C41 67 35 59 35 48 C35 37 41 30 50 30 Z"
              fill="url(#allianceGoldGrad)"
            />
            {/* Lion Mane Strands */}
            <path d="M35 44 L28 48 L34 53 L29 59 L36 61 Z" fill="#B45309" />
            <path d="M65 44 L72 48 L66 53 L71 59 L64 61 Z" fill="#B45309" />

            {/* Lion Muzzle and Royal Eyes */}
            <path d="M43 43 L47 46 L43 47 Z" fill="#1E3A8A" />
            <path d="M57 43 L53 46 L57 47 Z" fill="#1E3A8A" />
            <path d="M50 48 L54 54 L46 54 Z" fill="#78350F" />
            <path d="M46 55 C48 58 52 58 54 55 Z" stroke="#78350F" strokeWidth="1.5" />

            {/* Lower Shield Gold Emblem */}
            <path d="M50 72 L55 79 L50 84 L45 79 Z" fill="url(#allianceGoldGrad)" stroke="#78350F" strokeWidth="0.5" />
          </g>
        </svg>
      </div>
    );
  }

  // Neutral / Pandaren / Argent Crest
  return (
    <div
      className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, opacity }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
        <circle cx="50" cy="50" r="44" stroke="#D4AF37" strokeWidth="2" strokeDasharray="4 2" />
        <circle cx="50" cy="50" r="28" fill="#D4AF37" opacity="0.3" />
        <path d="M50 20 L58 40 L80 42 L64 56 L69 78 L50 66 L31 78 L36 56 L20 42 L42 40 Z" fill="#F59E0B" />
      </svg>
    </div>
  );
};
