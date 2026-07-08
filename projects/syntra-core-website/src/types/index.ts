/**
 * SYNTRA CORE — Contratos de tipos compartidos.
 * Fuente única de verdad para los datos que consumen las secciones.
 */

import type {
  LeadStatus,
  NotificationStatus,
  NotificationErrorCode,
} from "@/lib/validations/lead";

export interface NavItem {
  label: string;
  href: string;
}

/** Canal social/externo del footer. href vacío = ícono visible sin link (próximamente). */
export interface SocialLink {
  label: string;
  href: string;
  /** Clave del ícono de marca (SVG inline en footer-social.tsx). */
  icon?: string;
}

/** Fila completa de un lead (tal como vive en Supabase). */
export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  /** Tipo(s) de proyecto (calificación opcional MULTI — 0005). null si no se eligió. */
  project_types: string[] | null;
  message: string;
  source: string;
  status: LeadStatus;
  created_at: string;
  /** Eje de observabilidad de notificación (TASK-020), separado de `status`. */
  notification_status: NotificationStatus;
  notified_at: string | null;
  notification_attempts: number;
  last_notification_error_code: NotificationErrorCode | null;
}

export interface ServiceItem {
  /** Identificador estable (clave de React, anclas, analytics) */
  id: string;
  /** Nombre del ícono de lucide-react (resuelto en el componente) */
  icon: string;
  /** Micro-tag de categoría: web | automatización | ia */
  tag: string;
  title: string;
  description: string;
  /** Definición corta del módulo (1 línea, entra completa en el panel del showcase). */
  blurb: string;
  features: string[];
  /** "Puede incluir" — lista comercial breve (esenciales del módulo, no técnica). */
  essentials?: string[];
  /**
   * Visual protagonista (image-led). Opcional: si falta, la sección usa un
   * placeholder premium CSS/SVG. Listo para reemplazar por WebP final.
   */
  image?: {
    src: string;
    width: number;
    height: number;
    alt: string;
  };
}

/** CTA consultivo del cierre de Servicios. */
export interface ServicesConsultCta {
  question: string;
  microcopy: string;
  button: string;
  href: string;
}

export interface WorkflowStep {
  step: number;
  /** Nombre del ícono de lucide-react */
  icon: string;
  title: string;
  description: string;
  /** Entregable de la etapa — label del estado HECHO */
  result: string;
  /** Qué se necesita del cliente en esta etapa (dimensión colaborativa). Opcional. */
  needFromYou?: string;
  /** Micro-tranquilizadora anti-ansiedad de la etapa (distinta del result). Opcional. */
  reassure?: string;
}

/** CTA de cierre del Proceso: relacional ("demos el primer paso"), no consultivo. */
export interface WorkflowCta {
  lead: string;
  body: string;
  button: string;
  href: string;
}

/** Encabezado reutilizable de sección (eyebrow + título + subtítulo) */
export interface SectionMeta {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export interface StackItem {
  name: string;
  category: "Frontend" | "Backend" | "Infraestructura" | "Automatización" | "IA";
}


/** Pregunta frecuente (manejo de objeciones). */
export interface FaqItem {
  question: string;
  answer: string;
}

/** Principio de identidad de "Nosotros" (cards premium "Brasa", lock v3). */
export interface AboutPillar {
  id: string;
  /** Palabra-índice del principio (POSTURA/CRITERIO/…): label del icon-tile. */
  ghost?: string;
  title: string;
  description: string;
}

/**
 * Microcopy de los ARTEFACTOS VISUALES de las cards de Nosotros (mini-UIs
 * ilustrativas: módulos, recomendación, chat, ruta). Decorativos (aria-hidden)
 * pero content-driven: el texto vive acá, no en el componente.
 */
export interface AboutPillarVisuals {
  /** postura: módulos del sistema (ícono lucide + nombre). */
  postura: { modules: { icon: string; label: string }[] };
  /** criterio: opciones de recomendación; la elegida lleva picked. */
  criterio: { options: { label: string; tag: string; picked?: boolean }[] };
  /** cercania: conversación (pregunta del cliente + typing de SC). */
  cercania: { question: string; typingLabel: string; avatar: string };
  /** compromiso: etiquetas de la ruta (nodo medio y chip final). */
  compromiso: { midLabel: string; endLabel: string };
}

export interface HeroContent {
  badge: string;
  /** Título dividido en partes para resaltar el centro con gradiente de marca */
  titleLead: string;
  titleHighlight: string;
  titleTail: string;
  subtitle: string;
  /** Capability rail: 3 mini-bloques (ícono + título + microcopy) bajo los CTAs */
  capabilities: { icon: string; title: string; copy: string }[];
}

export interface SiteConfig {
  name: string;
  domain: string;
  url: string;
  email: string;
  tagline: string;
  description: string;
  nav: NavItem[];
  /**
   * Canales sociales (opcional). Vacío o ausente = no se renderiza nada.
   * No inventar perfiles: agregar solo cuando existan canales reales.
   */
  socialLinks?: SocialLink[];
  cta: {
    primary: string;
    secondary: string;
  };
  hero: HeroContent;
  sections: {
    services: SectionMeta;
    useCases: SectionMeta;
    about: SectionMeta;
    workflow: SectionMeta;
    faq: SectionMeta;
    finalCta: {
      /** Eyebrow sobre el título (uppercase, accent). */
      eyebrow: string;
      title: string;
      subtitle: string;
      /** Helper bajo el textarea: baja la barrera de entrada (content-driven). */
      messageHelper: string;
      /** Capacidades del rail: íconos line tenues + label (content-driven). */
      capabilities: ReadonlyArray<{ icon: string; label: string }>;
    };
  };
}
