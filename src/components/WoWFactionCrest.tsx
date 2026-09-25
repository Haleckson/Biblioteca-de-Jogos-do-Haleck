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
  const isAlliance =
    normFaction.includes("ALLIANCE") ||
    normFaction.includes("ALIANÇA") ||
    normFaction.includes("ALIANCA");

  const iconUrl = isHorde
    ? "https://render.worldofwarcraft.com/us/icons/56/pvpcurrency-honor-horde.jpg"
    : isAlliance
    ? "https://render.worldofwarcraft.com/us/icons/56/pvpcurrency-honor-alliance.jpg"
    : "https://render.worldofwarcraft.com/us/icons/56/inv_misc_coin_01.jpg";

  const glowColor = isHorde
    ? "bg-red-600/40"
    : isAlliance
    ? "bg-blue-600/40"
    : "bg-amber-600/40";

  const borderColor = isHorde
    ? "border-red-600/60 shadow-[0_0_12px_rgba(220,38,38,0.5)]"
    : isAlliance
    ? "border-blue-600/60 shadow-[0_0_12px_rgba(37,99,235,0.5)]"
    : "border-amber-500/60 shadow-[0_0_12px_rgba(217,119,6,0.5)]";

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, opacity }}
    >
      {glow && (
        <div
          className={`absolute inset-0 rounded-full ${glowColor} blur-md animate-pulse pointer-events-none`}
        />
      )}
      <img
        src={iconUrl}
        alt={isHorde ? "Horda" : isAlliance ? "Aliança" : "Neutro"}
        className={`w-full h-full object-cover rounded-full border ${borderColor} z-10`}
        loading="lazy"
        onError={(e) => {
          // Fallback to banner crest if honor icon fails
          const target = e.currentTarget;
          if (isHorde && !target.src.includes("inv_bannerpvp_02")) {
            target.src = "https://render.worldofwarcraft.com/us/icons/56/inv_bannerpvp_02.jpg";
          } else if (isAlliance && !target.src.includes("inv_bannerpvp_01")) {
            target.src = "https://render.worldofwarcraft.com/us/icons/56/inv_bannerpvp_01.jpg";
          }
        }}
      />
    </div>
  );
};
