"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { blurReveal, VIEWPORT_ONCE } from "@/lib/motion";

interface BlurRevealProps extends React.ComponentProps<typeof motion.div> {
  delay?: number;
}

/**
 * BlurReveal — aparición con blur suave (motion-rules.md).
 * Ideal para headings y bloques destacados (hero, títulos de sección).
 *
 * `reveal-blur`: en mobile el blur se anula por CSS (ver globals.css). Animar un
 * filtro re-rasteriza el elemento en cada frame y es la causa medida del jank al
 * entrar a Contacto en celular; el fade + rise se conservan.
 */
function BlurReveal({ delay = 0, className, children, ...props }: BlurRevealProps) {
  return (
    <motion.div
      variants={blurReveal}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      transition={{ delay }}
      className={cn("reveal-blur", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { BlurReveal };
