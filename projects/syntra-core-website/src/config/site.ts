import type {
  AboutPillar,
  FaqItem,
  NavItem,
  ServiceItem,
  SiteConfig,
  SolutionNode,
  StackItem,
  UseCaseItem,
  WorkflowStep,
} from "@/types";

/**
 * SYNTRA CORE — Configuración del sitio (content-driven).
 *
 * Toda la copy vive acá: las secciones mapean sobre estos datos.
 * Posicionamiento: premium tecnológico ACCESIBLE — mensaje claro y
 * concreto para negocios reales, sin jerga abstracta. Idioma: español.
 */

export const siteConfig: SiteConfig = {
  name: "SYNTRA CORE",
  domain: "syntracore.dev",
  url: "https://syntracore.dev",
  email: "hola@syntracore.dev",
  tagline: "Sistemas digitales que hacen crecer tu negocio",
  description:
    "Diseñamos y construimos webs premium, automatizaciones e integraciones con IA para que tu empresa trabaje más rápido y venda mejor.",
  nav: [
    { label: "Servicios", href: "/#servicios" },
    { label: "Aplicaciones", href: "/#casos" },
    { label: "Nosotros", href: "/#nosotros" },
    { label: "Proceso", href: "/#proceso" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contacto", href: "/#contacto" },
  ],
  cta: {
    primary: "Solicitar propuesta",
    secondary: "Ver servicios",
  },
  hero: {
    badge: "Software Factory AI-Native",
    titleLead: "Sistemas digitales que",
    titleHighlight: "hacen crecer",
    titleTail: "tu negocio",
    subtitle:
      "Diseñamos y construimos webs premium, automatizaciones e integraciones con IA. Tecnología moderna, aplicada a resultados reales para tu empresa.",
    proof: [
      "Webs ultra rápidas",
      "Procesos automatizados",
      "Soluciones con IA",
    ],
  },
  sections: {
    services: {
      eyebrow: "Qué hacemos",
      title: "Tres formas de hacer crecer tu empresa",
      subtitle:
        "No vendemos plantillas. Construimos el sistema digital que tu negocio necesita para vender más y operar mejor.",
    },
    useCases: {
      eyebrow: "Dónde aplica",
      title: "Pensado para problemas reales de tu negocio",
      subtitle:
        "Estos son escenarios de aplicación por rubro: la situación típica y el sistema que diseñaríamos para resolverla. Cada proyecto se adapta a tu caso.",
    },
    about: {
      eyebrow: "Quiénes somos",
      title: "Un estudio digital, no una agencia más",
      subtitle:
        "SYNTRA CORE es un estudio de desarrollo AI-native que combina diseño, desarrollo y automatización para crear soluciones digitales modernas.",
    },
    workflow: {
      eyebrow: "Cómo trabajamos",
      title: "De tu idea a un sistema funcionando",
      subtitle:
        "Un proceso claro, sin vueltas. Sabés en todo momento qué estamos haciendo y por qué.",
    },
    solutionArchitecture: {
      eyebrow: "Cómo se ve",
      title: "Así se ve un sistema SYNTRA por dentro",
      subtitle:
        "No entregamos páginas sueltas: conectamos web, datos, automatización e IA en un sistema que trabaja solo. Este es el tipo de arquitectura que diseñamos para cada negocio.",
    },
    faq: {
      eyebrow: "Preguntas frecuentes",
      title: "Lo que solés preguntarte antes de empezar",
      subtitle:
        "Y si te queda alguna duda, escribinos: respondemos claro y sin compromiso.",
    },
    finalCta: {
      title: "¿Listo para dar el siguiente paso?",
      subtitle:
        "Contanos qué necesitás y te mostraremos la mejor forma de llevarlo a cabo, sin compromiso.",
    },
  },
};

export const mainNav: NavItem[] = siteConfig.nav;

export const services: ServiceItem[] = [
  {
    id: "web",
    icon: "LayoutTemplate",
    title: "Desarrollo Web Premium",
    description:
      "Sitios y aplicaciones rápidas, modernas y listas para escalar. Diseño que transmite profesionalismo desde el primer segundo.",
    features: [
      "Landing pages y sitios corporativos",
      "Aplicaciones web a medida",
      "Dashboards y paneles de gestión",
      "Optimización de velocidad y SEO",
    ],
  },
  {
    id: "automation",
    icon: "Workflow",
    title: "Automatización de Procesos",
    description:
      "Conectamos tus herramientas y eliminamos el trabajo manual repetitivo. Menos tareas operativas, más tiempo para vender.",
    features: [
      "Flujos de trabajo con n8n",
      "Integraciones entre tus apps",
      "Automatización comercial y operativa",
      "Notificaciones y reportes automáticos",
    ],
  },
  {
    id: "ia",
    icon: "Sparkles",
    title: "Soluciones con IA",
    description:
      "Asistentes y agentes inteligentes que atienden, califican y responden por vos. Tecnología de punta, aplicada a resultados.",
    features: [
      "Chatbots y asistentes inteligentes",
      "Agentes que automatizan tareas",
      "Procesamiento automático de datos",
      "IA integrada a tus sistemas",
    ],
  },
];

export const useCases: UseCaseItem[] = [
  {
    id: "inmobiliarias",
    icon: "Building2",
    title: "Inmobiliarias",
    description:
      "Una web rápida con catálogo y buscador, conectada a un sistema que podría captar interesados y automatizar respuestas y seguimiento.",
    pain: "Las consultas de propiedades llegan por varios canales y se responden a mano, una por una.",
    deliverables: [
      "Catálogo de propiedades con buscador y filtros",
      "Captación de interesados desde la web",
      "Respuestas y seguimiento automatizados",
    ],
  },
  {
    id: "legal",
    icon: "Scale",
    title: "Estudios jurídicos",
    description:
      "Un sitio institucional sobrio con formularios de consulta calificada y automatización de turnos y seguimiento.",
    pain: "Las consultas entran desordenadas por mail, teléfono y formularios, y se pierde tiempo administrativo ordenándolas.",
    deliverables: [
      "Sitio institucional sobrio y confiable",
      "Formularios de consulta calificada",
      "Automatización de turnos y seguimiento",
    ],
  },
  {
    id: "salud",
    icon: "Stethoscope",
    title: "Clínicas y profesionales",
    description:
      "Una web clara con solicitud de turnos online y recordatorios automáticos que pueden reducir la coordinación manual.",
    pain: "Coordinar cada turno implica idas y vueltas constantes con los pacientes.",
    deliverables: [
      "Web clara con servicios y especialidades",
      "Solicitud de turnos online",
      "Recordatorios y mensajes automáticos",
    ],
  },
  {
    id: "pymes",
    icon: "Store",
    title: "Empresas de servicios y PyMEs",
    description:
      "Un sitio o sistema a medida que podría captar y gestionar clientes y automatizar los procesos internos que hoy se hacen a mano.",
    pain: "Tareas repetitivas consumen horas todos los días y frenan la operación.",
    deliverables: [
      "Sitio o sistema a medida de tu operación",
      "Captación y gestión de clientes",
      "Automatización de procesos internos",
    ],
  },
];

/** Nota de honestidad de la sección Aplicaciones (escenarios, no casos reales). */
export const applicationsNote =
  "Escenarios de aplicación — ejemplos de cómo trabajamos, adaptados a cada negocio. No representan clientes específicos.";

/** Frase-firma editorial de la sección Nosotros (statement de identidad). */
export const aboutStatement = "La forma SYNTRA de construir.";

export const aboutPillars: AboutPillar[] = [
  {
    id: "ia",
    icon: "Sparkles",
    title: "Proceso impulsado por IA",
    description:
      "Usamos inteligencia artificial y automatización en todo nuestro proceso para entregar más rápido y con mejor calidad.",
  },
  {
    id: "premium",
    icon: "Gem",
    title: "Diseño de nivel premium",
    description:
      "No hacemos solo páginas: construimos sistemas con un diseño cuidado que transmite profesionalismo desde el primer contacto.",
  },
  {
    id: "segura",
    icon: "ShieldCheck",
    title: "Tecnología moderna y segura",
    description:
      "Trabajamos con tecnología actual y prácticas seguras para que tu negocio funcione mejor, sin complejidad de tu lado.",
  },
  {
    id: "soporte",
    icon: "LifeBuoy",
    title: "Acompañamiento real",
    description:
      "Te acompañamos antes, durante y después del lanzamiento para que la solución siga generando valor.",
  },
];

export const faqs: FaqItem[] = [
  {
    question: "¿Cuánto cuesta un proyecto?",
    answer:
      "Cada proyecto es diferente. Analizamos tus necesidades y te presentamos una propuesta clara, transparente y sin costos ocultos.",
  },
  {
    question: "¿Cuánto tiempo tarda?",
    answer:
      "Varía según el proyecto. Una landing puede estar lista en pocas semanas; un sistema con automatizaciones lleva más. En la propuesta te damos un plazo claro antes de empezar.",
  },
  {
    question: "¿Sirve para mi tipo de negocio?",
    answer:
      "Trabajamos con PyMEs, inmobiliarias, estudios jurídicos, clínicas y profesionales de servicios. Si tu negocio atiende clientes y tiene tareas repetitivas, podemos ayudarte.",
  },
  {
    question: "¿Necesito saber de tecnología?",
    answer:
      "No. De la parte técnica nos encargamos nosotros. Vos contás qué necesitás y te explicamos todo en lenguaje claro, sin tecnicismos.",
  },
  {
    question: "¿Qué pasa después de lanzar?",
    answer:
      "Te acompañamos. Hacemos soporte, ajustes y mejoras, y el sistema puede crecer con tu negocio sin tener que empezar de cero.",
  },
  {
    question: "¿Puedo automatizar tareas de mi empresa?",
    answer:
      "Sí. Conectamos tus herramientas y automatizamos procesos como respuestas, seguimiento de clientes, turnos o reportes, con o sin inteligencia artificial.",
  },
];

export const workflow: WorkflowStep[] = [
  {
    step: 1,
    icon: "Search",
    title: "Entendemos tu negocio",
    description:
      "Analizamos tus objetivos, tus procesos y dónde estás perdiendo tiempo o ventas. Antes de proponer, escuchamos.",
  },
  {
    step: 2,
    icon: "PenTool",
    title: "Diseñamos el sistema",
    description:
      "Definimos arquitectura, diseño y automatizaciones a medida de tu caso. Nada genérico, todo pensado para vos.",
  },
  {
    step: 3,
    icon: "Workflow",
    title: "Construimos y automatizamos",
    description:
      "Desarrollamos con tecnología moderna y conectamos tus herramientas para que el trabajo repetitivo se haga solo.",
  },
  {
    step: 4,
    icon: "Rocket",
    title: "Lanzamos y acompañamos",
    description:
      "Publicamos, medimos resultados reales y hacemos crecer el sistema a medida que crece tu negocio.",
  },
];

/**
 * Diagrama de arquitectura de solución (prueba honesta — TASK-003).
 * Ejemplo conceptual de cómo SYNTRA conecta las capas de un sistema.
 * NO es un caso real ni un cliente: es ilustrativo (ver `solutionArchitectureNote`).
 */
export const solutionNodes: SolutionNode[] = [
  { id: "cliente", icon: "Users", label: "Cliente", caption: "Llega" },
  { id: "web", icon: "LayoutTemplate", label: "Web", caption: "Capta" },
  { id: "crm", icon: "Database", label: "CRM", caption: "Ordena" },
  { id: "automatizacion", icon: "Workflow", label: "Automatización", caption: "Automatiza" },
  { id: "ia", icon: "Sparkles", label: "IA", caption: "Decide" },
  { id: "reporte", icon: "BarChart3", label: "Reporte", caption: "Reporta" },
];

export const solutionArchitectureNote =
  "Ejemplo de arquitectura — adaptamos cada sistema a tu negocio.";

/** Label del header del canvas (tipo barra de sistema). */
export const solutionCanvasLabel = "syntra-os · flujo en ejecución";

/** Strings de la barra inferior de sistema del canvas (status bar). */
export const solutionCanvasStatus = {
  sync: "sincronizado",
  pipeline: "pipeline activo",
  meta: "6 módulos · 5 conexiones",
  coords: "x:1240 · y:320 · z:1.0",
};

/** Cue de resultado del nodo final (Reporte). Enciende al cierre del flujo. */
export const solutionOutputLabel = "reporte actualizado";

export const stack: StackItem[] = [
  { name: "Next.js", category: "Frontend" },
  { name: "React", category: "Frontend" },
  { name: "TypeScript", category: "Frontend" },
  { name: "TailwindCSS", category: "Frontend" },
  { name: "Supabase", category: "Backend" },
  { name: "PostgreSQL", category: "Backend" },
  { name: "Vercel", category: "Infraestructura" },
  { name: "Cloudflare", category: "Infraestructura" },
  { name: "n8n", category: "Automatización" },
  { name: "Claude", category: "IA" },
];
