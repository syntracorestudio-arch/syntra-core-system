import * as React from "react";

/**
 * StatementText — tipografía del statement con "SYNTRA" destacado
 * (Space Grotesk + gradiente cálido). Content-driven: recibe el string de
 * `site.ts` y solo destaca la palabra de marca si está presente.
 */
function StatementText({ text }: { text: string }) {
  const parts = text.split("SYNTRA");
  if (parts.length !== 2) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <span
        className="bg-gradient-to-r from-accent-warm via-[#f5e6d0] to-accent-warm bg-clip-text font-accent text-transparent"
        style={{ textShadow: "none" }}
      >
        SYNTRA
      </span>
      {parts[1]}
    </>
  );
}

export { StatementText };
