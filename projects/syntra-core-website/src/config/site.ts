import type {
  AboutPillar,
  FaqItem,
  NavItem,
  ServiceItem,
  ServicesConnection,
  ServicesConsultCta,
  ServicesStartOption,
  SiteConfig,
  SolutionNode,
  StackItem,
  UseCaseItem,
  WorkflowStep,
  WorkflowCta,
} from "@/types";
import type { ProjectType } from "@/lib/validations/lead";

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
    { label: "Casos", href: "/#casos" },
    { label: "Proceso", href: "/#proceso" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contacto", href: "/#contacto" },
  ],
  // Canales sociales: vacío a propósito. No renderiza nada hasta tener perfiles reales.
  socialLinks: [],
  cta: {
    primary: "Contanos tu proyecto",
    secondary: "Ver ejemplos",
  },
  hero: {
    badge: "Estudio de desarrollo + automatización con IA",
    titleLead: "Sistemas digitales",
    titleHighlight: "hacen crecer",
    titleTail: "tu negocio",
    subtitle:
      "Diseñamos webs, automatizaciones y asistentes con IA para que tu negocio responda mejor, trabaje más ordenado y aproveche más oportunidades.",
    capabilities: [
      {
        icon: "LayoutTemplate",
        title: "Webs claras",
        copy: "Rápidas, simples y listas para vender",
      },
      {
        icon: "Workflow",
        title: "Automatización",
        copy: "Menos tareas manuales, más orden",
      },
      {
        icon: "Sparkles",
        title: "IA aplicada",
        copy: "Respuestas útiles para consultas reales",
      },
    ],
  },
  sections: {
    services: {
      eyebrow: "Servicios modulares",
      title: "Elegí por dónde empezar",
      subtitle:
        "Podés lanzar una web premium, automatizar tareas, sumar un chatbot con IA o conectar todo en un sistema completo cuando tu negocio lo necesite.",
    },
    useCases: {
      eyebrow: "Dónde aplica",
      title: "Pensado para problemas reales de tu negocio",
      subtitle:
        "Escenarios reales de uso: cómo una consulta, un turno o un pedido puede convertirse en una respuesta ordenada y accionable. Cada solución se adapta a tu negocio.",
    },
    about: {
      eyebrow: "Quiénes somos",
      title: "Un estudio digital, no una agencia más",
      subtitle:
        "SYNTRA CORE es un estudio de desarrollo AI-native: combinamos diseño, ingeniería y automatización para construir sistemas que tu negocio usa todos los días, no solo una web que se ve bien.",
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
      title: "Hablemos de tu proyecto",
      subtitle:
        "Contanos qué necesitás mejorar y te respondemos con una propuesta clara, viable y sin compromiso.",
    },
  },
};

/** Footer — frase de cierre de marca (content-driven, TASK-015B). */
export const footerBrand =
  "Construimos sistemas digitales que hacen crecer tu negocio.";

/** Copy del estado de éxito del formulario (momento de marca, content-driven). */
export const contactSuccess = {
  title: "Consulta recibida",
  body: "Gracias. Vamos a revisar tu mensaje y te responderemos para definir el próximo paso.",
  microcopy: "Te escribimos con una orientación clara para avanzar sin compromiso.",
  secondary: "Mensaje enviado",
};

/**
 * Opciones del campo "tipo de proyecto" del Contacto (WEB-013B). El `value` es
 * la key estable que viaja a DB/panel/n8n; el `label` es el copy en español.
 */
export const projectTypeOptions: { value: ProjectType; label: string }[] = [
  { value: "web", label: "Web para mi negocio" },
  { value: "automation", label: "Automatización de procesos" },
  { value: "ai", label: "IA / integración inteligente" },
  { value: "unsure", label: "Todavía no lo tengo claro" },
];

/** Label legible de un projectType (para el panel). null/desconocido → "—". */
export function projectTypeLabel(value: string | null): string {
  return projectTypeOptions.find((o) => o.value === value)?.label ?? "—";
}

export const mainNav: NavItem[] = siteConfig.nav;

export const services: ServiceItem[] = [
  {
    id: "web",
    icon: "LayoutTemplate",
    tag: "web",
    title: "Webs premium",
    description:
      "Una presencia profesional que genera confianza y convierte visitas en consultas.",
    features: [
      "Más consultas desde tu sitio",
      "Mejor presencia y posición en Google",
      "Se ve perfecto en celular y escritorio",
      "Listo para sumar automatización después",
    ],
    moduleIntro:
      "Creamos una presencia digital clara, profesional y preparada para convertir visitas en consultas reales.",
    includes: [
      "Página institucional o landing page",
      "Un mensaje claro sobre lo que ofrecés",
      "Diseño adaptable a celular y escritorio",
      "Formularios listos para recibir consultas",
      "Textos pensados para generar oportunidades",
      "Un sitio rápido, ordenado y fácil de navegar",
      "Base preparada para sumar automatizaciones",
    ],
  },
  {
    id: "automation",
    icon: "Workflow",
    tag: "automatización",
    title: "Automatizaciones",
    description:
      "Menos tareas manuales y mejor seguimiento para responder más rápido y perder menos oportunidades.",
    features: [
      "Menos carga manual para tu equipo",
      "Seguimiento más ordenado de cada consulta",
      "Avisos y reportes automáticos",
      "Conecta las herramientas que ya usás",
    ],
    moduleIntro:
      "Ordenamos las tareas repetitivas para que tu negocio responda más rápido, pierda menos oportunidades y dependa menos de procesos manuales.",
    includes: [
      "Registro automático de consultas",
      "Avisos internos para tu equipo",
      "Seguimientos más ordenados",
      "Menos carga manual de información",
      "Reportes simples para ver qué está pasando",
      "Conexión entre las herramientas que usás",
      "Validaciones para reducir errores o duplicados",
    ],
  },
  {
    id: "ia",
    icon: "Sparkles",
    tag: "ia",
    title: "Chatbots con IA",
    description:
      "Respuestas más rápidas y consultas mejor ordenadas, con el tono de tu marca, incluso fuera de horario.",
    features: [
      "Respuestas rápidas, incluso fuera de horario",
      "Filtra y deriva lo importante a tu equipo",
      "Información de cada consulta ordenada",
      "Atención con el tono de tu marca",
    ],
    moduleIntro:
      "Creamos asistentes que ayudan a responder, filtrar y ordenar consultas con el tono de tu negocio.",
    includes: [
      "Respuestas rápidas a preguntas frecuentes",
      "Atención inicial fuera de horario",
      "Filtro de consultas antes de derivarlas",
      "Captura de los datos importantes",
      "Organización de las conversaciones",
      "Respuestas alineadas a tu marca",
      "Derivación a una persona cuando haga falta",
    ],
  },
];

/** Bloque 2 — encabezado de "Qué podés construir con cada módulo". */
export const servicesModulesMeta = {
  title: "Qué podés construir con cada módulo",
  subtitle:
    "Cada servicio puede funcionar como un primer paso independiente o conectarse más adelante con el resto del sistema.",
};

/** Bloque 3 — "Una solución puede crecer con la otra" (narrativa + flujo). */
export const servicesConnection: ServicesConnection = {
  title: "Una solución puede crecer con la otra",
  body: "Podés empezar con una web, una automatización o un asistente con IA. Lo importante es que cada pieza quede preparada para conectarse después, para que tu negocio no tenga soluciones aisladas, sino un sistema más ordenado y fácil de escalar.",
  flow: [
    { label: "Web recibe la consulta", role: "web" },
    { label: "Automatización la ordena", role: "automation" },
    { label: "IA responde o filtra", role: "ia" },
    { label: "Tu equipo recibe una oportunidad más clara", role: "team" },
  ],
};

/** Bloque 4 — "Por dónde te conviene empezar" (ayuda a decidir el primer paso). */
export const servicesStart: { title: string; options: ServicesStartOption[] } = {
  title: "Por dónde te conviene empezar",
  options: [
    {
      id: "presence",
      title: "Necesito verme más profesional",
      body: "Empezá por una web premium que explique mejor tu negocio y convierta visitas en consultas.",
      serviceId: "web",
    },
    {
      id: "tasks",
      title: "Pierdo tiempo en tareas repetitivas",
      body: "Empezá por una automatización que ordene consultas, avisos, seguimientos o reportes.",
      serviceId: "automation",
    },
    {
      id: "questions",
      title: "Recibo muchas preguntas parecidas",
      body: "Empezá por un asistente con IA para responder, filtrar y derivar consultas de forma más clara.",
      serviceId: "ia",
    },
  ],
};

/** Bloque 5 — CTA consultivo del cierre de Servicios. */
export const servicesConsultCta: ServicesConsultCta = {
  question: "¿No sabés por dónde empezar?",
  microcopy:
    "Te ayudamos a detectar qué solución puede generar más impacto primero, sin venderte algo que todavía no necesitás.",
  button: "Quiero que me recomienden el mejor módulo",
  href: "#contacto",
};

export const useCases: UseCaseItem[] = [
  {
    id: "inmobiliarias",
    icon: "Building2",
    title: "Inmobiliarias",
    description:
      "El sistema ordena el lead, responde con la información clave y evita que una oportunidad quede sin seguimiento.",
    pain: "Cuando una consulta llega por WhatsApp, el asistente responde y ayuda a coordinar la visita.",
    tagline:
      "Mientras vos mostrás propiedades, cada interesado recibe respuesta y seguimiento.",
    deliverables: [
      "Catálogo de propiedades con buscador y filtros",
      "Captación de interesados desde la web",
      "Respuestas y seguimiento automatizados",
    ],
    flow: [
      "Entra una consulta por una propiedad",
      "Queda registrada como interesado",
      "Se activan la respuesta y el seguimiento",
      "Listo para coordinar la visita",
    ],
  },
  {
    id: "legal",
    icon: "Scale",
    title: "Estudios jurídicos",
    description:
      "El sistema registra el motivo, reúne la información inicial y evita que un mensaje importante quede perdido.",
    pain: "Cuando llega una consulta legal, el asistente ordena el caso y lo deriva para revisión.",
    tagline:
      "Mientras el estudio atiende casos, cada consulta entra ordenada y lista para revisar.",
    deliverables: [
      "Sitio institucional sobrio y confiable",
      "Formularios de consulta calificada",
      "Automatización de turnos y seguimiento",
    ],
    flow: [
      "Entra una consulta por el formulario",
      "Se ordena por tipo de caso",
      "Se propone turno y recordatorio",
      "Lista para que el equipo la tome",
    ],
  },
  {
    id: "salud",
    icon: "Stethoscope",
    title: "Clínicas y profesionales",
    description:
      "El sistema registra la consulta, comparte la información inicial y ofrece horarios disponibles para que cada contacto quede ordenado desde el primer mensaje.",
    pain: "Cuando un paciente consulta por WhatsApp, el asistente responde y ayuda a coordinar el turno.",
    tagline:
      "Mientras el equipo atiende pacientes, cada consulta recibe respuesta y seguimiento.",
    deliverables: [
      "Web clara con servicios y especialidades",
      "Solicitud de turnos online",
      "Recordatorios y mensajes automáticos",
    ],
    flow: [
      "Entra una solicitud de turno",
      "Queda registrada en la agenda",
      "Se envían confirmación y recordatorio",
      "Listo para la consulta, sin coordinar",
    ],
  },
  {
    id: "pymes",
    icon: "Store",
    title: "Empresas de servicios y PyMEs",
    description:
      "El sistema registra la consulta, responde con la información clave y evita que una venta se pierda por demora o desorden.",
    pain: "Cuando entra un pedido por WhatsApp, el asistente responde y ayuda a confirmarlo.",
    tagline:
      "Mientras tu negocio vende, cada consulta recibe respuesta y cada pedido queda encaminado.",
    deliverables: [
      "Sitio o sistema a medida de tu operación",
      "Captación y gestión de clientes",
      "Automatización de procesos internos",
    ],
    flow: [
      "Entra un contacto desde la web",
      "El cliente queda cargado al instante",
      "Su presupuesto se arma solo",
      "Reporte listo para revisar",
    ],
  },
];

/**
 * Nota de honestidad de la sección Servicios (escenas ilustrativas, no clientes).
 * Disponible para 009F-B; no se renderiza en 009F-A.
 */
export const servicesNote =
  "Escenas ilustrativas. Mostramos cómo funciona cada sistema con ejemplos de rubro. No son clientes reales ni resultados garantizados.";

/** Nota de honestidad de la sección Aplicaciones (escenarios, no casos reales). */
export const applicationsNote =
  "Escenarios de aplicación — ejemplos de cómo trabajamos, adaptados a cada negocio. No representan clientes específicos.";

/** Frase-firma editorial de la sección Nosotros (statement de identidad). */
export const aboutStatement = "La forma SYNTRA de construir.";

/**
 * Frases-bisagra entre secciones de la Home (WEB-012B) — narrativa continua.
 * Cada una nombra el resultado de la sección anterior como input de la siguiente.
 * Copy-first: las renderiza `SectionBridge`, sin conectores visuales.
 */
export const homeBridges = {
  servicesToUseCases: "Esto mismo, puesto a trabajar:",
  useCasesToWorkflow: "Y así lo construimos, paso a paso:",
  workflowToSolution: "Y todo esto vive en un solo lugar:",
} as const;

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
      "No entregamos solo una página linda: construimos sistemas con un diseño cuidado al detalle, del tipo que tu cliente asocia con una empresa seria.",
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
    icon: "Telescope",
    title: "Entendemos tu negocio",
    description:
      "Analizamos tus objetivos, tus procesos y dónde estás perdiendo tiempo o ventas. Antes de proponer, escuchamos. El primer paso es sin compromiso.",
    result: "Diagnóstico claro",
    needFromYou: "Una charla y que nos cuentes cómo trabajás hoy.",
    reassure: "Sin compromiso: si no te sirve, te lo decimos.",
  },
  {
    step: 2,
    icon: "DraftingCompass",
    title: "Diseñamos el sistema",
    description:
      "Definimos cómo va a funcionar todo: diseño, estructura y las tareas que se van a automatizar. Nada de plantillas, todo pensado para tu caso.",
    result: "Propuesta para aprobar",
    needFromYou: "Revisás la propuesta y nos das el OK antes de construir nada.",
    reassure: "No empezamos a desarrollar hasta que estés de acuerdo.",
  },
  {
    step: 3,
    icon: "Cpu",
    title: "Construimos y automatizamos",
    description:
      "Desarrollamos con tecnología moderna y conectamos tus herramientas para que el trabajo repetitivo se haga solo.",
    result: "Sistema funcionando",
    needFromYou: "Casi nada de tu lado: nos das accesos puntuales y seguís con lo tuyo.",
    reassure: "Te vamos mostrando avances; no es una caja negra.",
  },
  {
    step: 4,
    icon: "TrendingUp",
    title: "Lanzamos y acompañamos",
    description:
      "Publicamos, medimos resultados reales y hacemos crecer el sistema a medida que crece tu negocio.",
    result: "En marcha y con soporte",
    needFromYou: "Usás el sistema; nosotros estamos atrás para lo que surja.",
    reassure: "No te dejamos solo después de lanzar.",
  },
];

/** Micro-promesa de método (bajo el heading): enmarca los 4 pasos y da coherencia. */
export const workflowMethodPromise =
  "Trabajamos en 4 pasos claros. Te mostramos cada avance y no avanzamos sin tu OK.";

/** Cierre del Proceso — CTA relacional (arrancar por el paso 1, sin compromiso). */
export const workflowCta: WorkflowCta = {
  lead: "El primer paso es entender tu negocio.",
  body: "Sin compromiso: charlamos, escuchamos y te decimos con claridad si podemos ayudarte y cómo.",
  button: "Empecemos por entender tu negocio",
  href: "#contacto",
};

/**
 * Diagrama de arquitectura de solución (prueba honesta — TASK-003).
 * Ejemplo conceptual de cómo SYNTRA conecta las capas de un sistema.
 * NO es un caso real ni un cliente: es ilustrativo (ver `solutionArchitectureNote`).
 */
export const solutionNodes: SolutionNode[] = [
  { id: "cliente", icon: "Users", label: "Cliente", caption: "Llega" },
  { id: "web", icon: "LayoutTemplate", label: "Web", caption: "Capta" },
  { id: "crm", icon: "Database", label: "Tus clientes", caption: "Ordena" },
  { id: "automatizacion", icon: "Workflow", label: "Automatización", caption: "Automatiza" },
  { id: "ia", icon: "Sparkles", label: "IA", caption: "Responde" },
  { id: "reporte", icon: "BarChart3", label: "Reporte", caption: "Reporta" },
];

export const solutionArchitectureNote =
  "Es un ejemplo de cómo lo armamos — cada negocio es distinto.";

/** Label del header del canvas (tipo barra de sistema). */
export const solutionCanvasLabel = "Tu negocio, funcionando";

/** Strings de la barra inferior de sistema del canvas (status bar). */
export const solutionCanvasStatus = {
  sync: "Todo al día",
  pipeline: "Trabajando ahora",
  meta: "Todo conectado",
  coords: "",
};

/** Cue de resultado del nodo final (Reporte). Enciende al cierre del flujo. */
export const solutionOutputLabel = "Reporte listo";

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
