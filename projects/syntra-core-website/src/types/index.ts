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

/** Canal social/externo del footer. Estructura preparada para uso futuro. */
export interface SocialLink {
  label: string;
  href: string;
}

/** Fila completa de un lead (tal como vive en Supabase). */
export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  /** Tipo de proyecto (calificación opcional — WEB-013B). null si no se eligió. */
  project_type: string | null;
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
  features: string[];
  /** Texto del módulo (bloque "Qué podés construir con cada módulo"). */
  moduleIntro: string;
  /** Qué puede incluir el módulo (lista comercial, no técnica). */
  includes: string[];
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

/** Bloque "Una solución puede crecer con la otra": narrativa + flujo de conexión. */
export interface ServicesConnection {
  title: string;
  body: string;
  /** Pasos del flujo; `role` define el color (team = neutro/resultado). */
  flow: { label: string; role: "web" | "automation" | "ia" | "team" }[];
}

/** Opción de "Por dónde te conviene empezar" (ayuda a decidir el primer paso). */
export interface ServicesStartOption {
  id: string;
  title: string;
  body: string;
  /** Servicio sugerido (define color de rol y, a futuro, el deep-link). */
  serviceId: "web" | "automation" | "ia";
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

/** Caso de uso por industria (escenario problema → solución). */
export interface UseCaseItem {
  id: string;
  icon: string;
  /** Rubro / industria */
  title: string;
  /** Narrativa breve: el problema típico y cómo lo resolvemos */
  description: string;
  /** Dolor concreto del rubro (situación "antes") */
  pain: string;
  /** Frase comercial / promesa del rubro (una línea) */
  tagline: string;
  /** Entregables concretos para ese rubro (qué incluiría) */
  deliverables: string[];
  /** Recorrido vivo de 4 pasos en lenguaje de cliente; el 4º es el resultado (estado HECHO). */
  flow: string[];
}

/** Pregunta frecuente (manejo de objeciones). */
export interface FaqItem {
  question: string;
  answer: string;
}

/** Pilar de "Quiénes somos" (card, mismo lenguaje que Servicios). */
export interface AboutPillar {
  id: string;
  icon: string;
  title: string;
  description: string;
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
      title: string;
      subtitle: string;
    };
  };
}
