"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { staggerContainer, staggerItem, VIEWPORT_ONCE } from "@/lib/motion";

/**
 * Stagger — contenedor que revela a sus hijos de forma progresiva.
 * Envolver cada hijo en <StaggerItem> (o usar la variante directamente).
 */
function Stagger({ children, ...props }: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      {...props}
    >
      {children}
    </motion.div>
  );
}

function StaggerItem({ children, ...props }: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div variants={staggerItem} {...props}>
      {children}
    </motion.div>
  );
}

export { Stagger, StaggerItem };
