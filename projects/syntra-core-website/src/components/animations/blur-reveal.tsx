"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { blurReveal, VIEWPORT_ONCE } from "@/lib/motion";

interface BlurRevealProps extends React.ComponentProps<typeof motion.div> {
  delay?: number;
}

/**
 * BlurReveal — aparición con blur suave (motion-rules.md).
 * Ideal para headings y bloques destacados (hero, títulos de sección).
 */
function BlurReveal({ delay = 0, children, ...props }: BlurRevealProps) {
  return (
    <motion.div
      variants={blurReveal}
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

export { BlurReveal };
