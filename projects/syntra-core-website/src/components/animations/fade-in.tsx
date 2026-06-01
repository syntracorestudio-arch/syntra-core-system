"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { fadeInUp, VIEWPORT_ONCE } from "@/lib/motion";

interface FadeInProps extends React.ComponentProps<typeof motion.div> {
  /** Retraso de entrada en segundos */
  delay?: number;
}

/**
 * FadeIn — wrapper client que anima su contenido (Server) al entrar en viewport.
 * Respeta prefers-reduced-motion globalmente (ver globals.css).
 */
function FadeIn({ delay = 0, children, ...props }: FadeInProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { FadeIn };
