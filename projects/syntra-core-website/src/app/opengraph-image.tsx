import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";

export const alt = "SYNTRA CORE — Software Factory AI-Native";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG image generada por código (on-brand con los tokens de marca).
 * Se genera en build. Sin assets externos ni fuentes custom (default font).
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(900px circle at 20% 0%, #0b3d9155, #0f172a 55%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 34,
            letterSpacing: 2,
            color: "#38bdf8",
            textTransform: "uppercase",
          }}
        >
          {siteConfig.name}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          {siteConfig.tagline}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            color: "#94a3b8",
            maxWidth: 880,
          }}
        >
          Desarrollo web premium · Automatización · Soluciones con IA
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#2563eb",
            }}
          />
          <div style={{ fontSize: 26, color: "#cbd5e1" }}>
            {siteConfig.domain}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
