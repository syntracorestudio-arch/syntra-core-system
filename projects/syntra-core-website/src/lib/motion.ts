import type { Variants } from "framer-motion";

/**
 * SYNTRA CORE — Sistema de Motion centralizado.
 *
 * Un único lugar define el "sello de movimiento" de la marca.
 * Los componentes solo consumen estas variantes. Premium, sutil, ease-out.
 * Ref: motion-rules.md (micro 100-200ms · secciones 400-700ms · hero 600-1200ms).
 */

/** Curva ease-out suave premium (estilo Linear/Vercel) */
export const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const;

/** Duraciones oficiales (segundos) */
export const DURATION = {
  micro: 0.2,
  standard: 0.4,
  section: 0.6,
  hero: 0.9,
} as const;

/** Desplazamiento de entrada por defecto (px) — sutil, sin movimientos largos */
const RISE = 16;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.section, ease: EASE_PREMIUM },
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.section, ease: EASE_PREMIUM },
  },
};

/** Reveal con blur suave (motion-rules.md: "reveal con blur") */
export const blurReveal: Variants = {
  hidden: { opacity: 0, y: RISE, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DURATION.section, ease: EASE_PREMIUM },
  },
};

/**
 * Contenedor para aparición progresiva (stagger) de hijos.
 * Scroll choreography: el contenido (cards) entra DESPUÉS del heading
 * (delayChildren) y escalonado entre sí (staggerChildren). Sin loop.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.18,
    },
  },
};

/** Hijo de un staggerContainer */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.standard, ease: EASE_PREMIUM },
  },
};

/** Configuración estándar de viewport para animaciones por scroll */
export const VIEWPORT_ONCE = { once: true, amount: 0.3 } as const;
