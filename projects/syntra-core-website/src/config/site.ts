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
    { label: "Casos", href: "/#casos" },
    { label: "Proceso", href: "/#proceso" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contacto", href: "/#contacto" },
  ],
  // Canales sociales: vacío a propósito. No renderiza nada hasta tener perfiles reales.
  socialLinks: [],
  cta: {
    primary: "Contanos tu proyecto",
    secondary: "Ver qué hacemos",
  },
  hero: {
    badge: "Estudio de desarrollo + automatización con IA",
    titleLead: "Sistemas digitales que",
    titleHighlight: "hacen crecer",
    titleTail: "tu negocio",
    subtitle:
      "Diseñamos y construimos webs premium, automatizaciones e integraciones con IA, para que tu empresa atienda más rápido, venda mejor y dedique menos tiempo a tareas manuales.",
    proof: [
      "Webs que cargan al instante",
      "Menos trabajo manual",
      "Atención automática a tus clientes",
    ],
  },
  sections: {
    services: {
      eyebrow: "Qué entregamos",
      title: "Tres cosas que tu negocio se lleva funcionando",
      subtitle:
        "Web, automatización e IA que trabajan juntas: atraen consultas, las ordenan solas y responden por vos cuando no estás.",
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
      title: "¿Listo para dar el siguiente paso?",
      subtitle:
        "Contanos qué necesitás y te mostraremos la mejor forma de llevarlo a cabo, sin compromiso.",
    },
  },
};

/** Footer — frase de cierre de marca (content-driven, TASK-015B). */
export const footerBrand =
  "Construimos sistemas digitales que hacen crecer tu negocio.";

/** Copy del estado de éxito del formulario (momento de marca, content-driven). */
export const contactSuccess = {
  title: "Mensaje recibido",
  body: "Gracias. Ya tenemos tu solicitud y vamos a revisar la mejor forma de ayudarte.",
  microcopy: "Te contactaremos para entender mejor tu proyecto y definir el próximo paso.",
  secondary: "Solicitud registrada correctamente.",
};

export const mainNav: NavItem[] = siteConfig.nav;

export const services: ServiceItem[] = [
  {
    id: "web",
    icon: "LayoutTemplate",
    tag: "web",
    title: "Una web que convierte visitas en consultas",
    description:
      "Una web clara, rápida y profesional: tus clientes entienden qué ofrecés y te dejan su consulta sin vueltas.",
    features: [
      "Landing pages y sitios corporativos",
      "Aplicaciones web a medida",
      "Paneles para ver tu negocio de un vistazo",
      "Velocidad de carga y mejor posición en Google",
    ],
  },
  {
    id: "automation",
    icon: "Workflow",
    tag: "automatización",
    title: "Menos tareas a mano, más tiempo para vender",
    description:
      "Automatizamos tareas repetitivas para que cada consulta quede ordenada y tu equipo responda más rápido.",
    features: [
      "Conexión automática entre tus herramientas",
      "Integraciones entre tus apps",
      "Automatización comercial y operativa",
      "Notificaciones y reportes automáticos",
    ],
  },
  {
    id: "ia",
    icon: "Sparkles",
    tag: "ia",
    title: "Una atención que responde cuando vos no podés",
    description:
      "Un asistente que conoce tu negocio: responde las preguntas frecuentes y encamina cada consulta a tu equipo.",
    features: [
      "Chatbots y asistentes inteligentes",
      "Derivación de consultas a tu equipo",
      "Organización automática de tu información",
      "Respuestas con el tono de tu marca",
    ],
  },
];

export const useCases: UseCaseItem[] = [
  {
    id: "inmobiliarias",
    icon: "Building2",
    title: "Inmobiliarias",
    description:
      "Una web rápida con catálogo y buscador, conectada a un sistema que capta interesados y automatiza respuestas y seguimiento.",
    pain: "Las consultas de propiedades te llegan por WhatsApp, mail y la web, y las respondés a mano, una por una.",
    tagline:
      "Cada consulta recibe respuesta y seguimiento al instante, mientras vos mostrás propiedades.",
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
      "Un sitio institucional sobrio con formularios de consulta calificada y automatización de turnos y seguimiento.",
    pain: "Las consultas entran desordenadas por mail, teléfono y formularios, y se pierde tiempo administrativo ordenándolas.",
    tagline:
      "Las consultas llegan filtradas y ordenadas; tu equipo dedica el tiempo a los casos, no a clasificarlas.",
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
      "Una web clara con solicitud de turnos online y recordatorios automáticos que reducen la coordinación manual.",
    pain: "Coordinar cada turno es una cadena de idas y vueltas por teléfono y WhatsApp, y aun así hay ausencias.",
    tagline:
      "Tus pacientes sacan turno solos y reciben el recordatorio; vos te dedicás a atender.",
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
      "Un sitio o sistema a medida que capta y gestiona clientes y automatiza los procesos internos que hoy se hacen a mano.",
    pain: "Tareas repetitivas —cargar clientes, pasar planillas, armar presupuestos— consumen horas todos los días y frenan la operación.",
    tagline:
      "Lo repetitivo se hace solo; tu equipo se enfoca en lo que solo un humano puede hacer.",
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
    icon: "Search",
    title: "Entendemos tu negocio",
    description:
      "Analizamos tus objetivos, tus procesos y dónde estás perdiendo tiempo o ventas. Antes de proponer, escuchamos.",
    result: "Diagnóstico claro",
  },
  {
    step: 2,
    icon: "PenTool",
    title: "Diseñamos el sistema",
    description:
      "Definimos cómo va a funcionar todo: diseño, estructura y las tareas que se van a automatizar. Nada de plantillas, todo pensado para tu caso.",
    result: "Plan a medida",
  },
  {
    step: 3,
    icon: "Workflow",
    title: "Construimos y automatizamos",
    description:
      "Desarrollamos con tecnología moderna y conectamos tus herramientas para que el trabajo repetitivo se haga solo.",
    result: "Sistema funcionando",
  },
  {
    step: 4,
    icon: "Rocket",
    title: "Lanzamos y acompañamos",
    description:
      "Publicamos, medimos resultados reales y hacemos crecer el sistema a medida que crece tu negocio.",
    result: "En marcha y con soporte",
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
