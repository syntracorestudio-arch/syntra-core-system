import type {
  AboutPillar,
  AboutPillarVisuals,
  FaqItem,
  NavItem,
  ServiceItem,
  ServicesConsultCta,
  SiteConfig,
  StackItem,
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
    { label: "Ejemplos", href: "/#casos" },
    { label: "Proceso", href: "/#proceso" },
    { label: "FAQ", href: "/#faq" },
    { label: "Contacto", href: "/#contacto" },
  ],
  // Canales sociales: íconos visibles desde ya (decisión owner 2026-07-07);
  // href vacío = se muestra apagado con "(próximamente)" hasta linkear el perfil real.
  socialLinks: [
    { label: "Instagram", href: "", icon: "instagram" },
    { label: "LinkedIn", href: "", icon: "linkedin" },
    { label: "WhatsApp", href: "", icon: "whatsapp" },
    { label: "X", href: "", icon: "x" },
  ],
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
      title: "Cuatro módulos, un solo sistema",
      subtitle:
        "Cada módulo funciona solo y genera valor desde el primer día. Cuando tu negocio lo pide, se conectan entre sí y trabajan como un solo sistema.",
    },
    useCases: {
      eyebrow: "Qué construimos",
      title: "Lo que construimos, funcionando",
      subtitle:
        "Una landing, un asistente con IA, una automatización y un panel: cuatro piezas que podés ver en acción acá mismo, y que adaptamos a cualquier tipo de negocio.",
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
        "Cuatro pasos, y en cada uno sabés qué estamos haciendo y qué recibís.",
    },
    faq: {
      eyebrow: "Preguntas frecuentes",
      title: "Lo que solés preguntarte antes de empezar",
      subtitle:
        "Respuestas directas a las dudas que más escuchamos.",
    },
    finalCta: {
      eyebrow: "Empecemos",
      title: "Hablemos de tu proyecto",
      subtitle:
        "Contanos qué necesitás mejorar y te respondemos con una propuesta clara y viable.",
      messageHelper:
        "No hace falta que tengas todo definido — con el contexto que tengas, te orientamos.",
      /** Bloque "Qué recibís" (PED 2026-07-14): reemplaza a las capacidades,
       *  que duplicaban los chips de tipo de proyecto del propio form. El rail
       *  responde la única pregunta abierta a esta altura: qué recibo si escribo. */
      deliverablesHeading: "Qué recibís",
      deliverables: [
        {
          icon: "Scale",
          label:
            "Una lectura honesta de tu caso — si algo no te conviene, también te lo decimos.",
        },
        {
          icon: "Route",
          label: "Una recomendación concreta: por dónde empezar y qué implica.",
        },
        {
          icon: "ShieldCheck",
          label:
            "El primer paso definido, sin letra chica. La decisión queda de tu lado.",
        },
      ],
      /** Encuadre del mailto: cierra el rail con propósito, no como dato suelto. */
      mailtoLead: "¿Preferís escribir directo?",
    },
  },
};

/**
 * Footer — cierre de marca (rediseño "Última palabra", 2026-07-06).
 * La frase cierra con IDENTIDAD (eco de la tesis de Nosotros), no repite la
 * promesa del hero. Ubicación y crédito dogfooding confirmados por el owner.
 */
export const footerBrand =
  "Un estudio, no una agencia. Sistemas que tu negocio usa todos los días.";

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
  { value: "panel", label: "Panel de gestión" },
  { value: "unsure", label: "Todavía no lo tengo claro" },
];

/**
 * Labels legibles de los projectTypes (para el panel). MULTI (0005): mapea cada
 * value a su label y los une con " · ". null/vacío/sin matches → "—".
 */
export function projectTypeLabel(values: string[] | null): string {
  if (!values?.length) return "—";
  const labels = values
    .map((value) => projectTypeOptions.find((o) => o.value === value)?.label)
    .filter((label): label is string => Boolean(label));
  return labels.length ? labels.join(" · ") : "—";
}

export const mainNav: NavItem[] = siteConfig.nav;

/**
 * Módulos de Servicios v2 "Circuito modular". ORDEN = pipeline de Ejemplos
 * (web → ia → automation → panel): la misma secuencia con la que el visitante
 * ya vio las demos vivas, para que el selector y el diagrama lean parejo.
 * `essentials` = "Puede incluir…" (lista comercial breve, no técnica).
 */
export const services: ServiceItem[] = [
  {
    id: "web",
    icon: "LayoutTemplate",
    tag: "web",
    title: "Webs premium",
    description:
      "Una presencia profesional que genera confianza y convierte visitas en consultas.",
    blurb: "Una web que genera confianza y convierte visitas en consultas.",
    features: [
      "Más consultas desde tu sitio",
      "Mejor presencia y posición en Google",
      "Se ve perfecto en celular y escritorio",
      "Listo para sumar automatización después",
    ],
    essentials: [
      "Landing o sitio institucional",
      "Formularios listos para recibir consultas",
      "Base lista para automatizar después",
    ],
  },
  {
    id: "ia",
    icon: "Sparkles",
    tag: "ia",
    title: "Asistentes con IA",
    description:
      "Respuestas más rápidas y consultas mejor ordenadas, con el tono de tu marca, incluso fuera de horario.",
    blurb: "Un asistente que responde al instante, con el tono de tu marca.",
    features: [
      "Respuestas rápidas, incluso fuera de horario",
      "Filtra y deriva lo importante a tu equipo",
      "Información de cada consulta ordenada",
      "Atención con el tono de tu marca",
    ],
    essentials: [
      "Respuestas 24/7 con la información de tu negocio",
      "Filtro y derivación a tu equipo",
      "Atención con el tono de tu marca",
    ],
  },
  {
    id: "automation",
    icon: "Workflow",
    tag: "automatización",
    title: "Automatizaciones",
    description:
      "Menos tareas manuales y mejor seguimiento para responder más rápido y perder menos oportunidades.",
    blurb: "Las tareas repetitivas se hacen solas: registro, avisos y seguimiento.",
    features: [
      "Menos carga manual para tu equipo",
      "Seguimiento más ordenado de cada consulta",
      "Avisos y reportes automáticos",
      "Conecta las herramientas que ya usás",
    ],
    essentials: [
      "Registro automático de cada consulta",
      "Avisos a tu equipo por mail",
      "Conexión entre las herramientas que ya usás",
    ],
  },
  {
    id: "panel",
    icon: "Database",
    tag: "panel",
    title: "Paneles de gestión",
    description:
      "Todas las consultas y pedidos de tu negocio en un solo lugar, con su estado y su historia.",
    blurb: "Todo tu negocio en una pantalla: cada consulta con su estado.",
    features: [
      "Todo el negocio en una sola pantalla",
      "Cada consulta con su estado y su responsable",
      "Decisiones con datos reales, no de memoria",
      "Nada queda sin seguimiento",
    ],
    essentials: [
      "Vista simple para tu equipo",
      "Estados claros por consulta",
      "Reportes para decidir mejor",
    ],
  },
];

/** CTA consultivo del cierre de Servicios. */
export const servicesConsultCta: ServicesConsultCta = {
  question: "¿No sabés por dónde empezar?",
  microcopy:
    "Te ayudamos a detectar qué solución puede generar más impacto primero, sin venderte algo que todavía no necesitás.",
  /* 24 caracteres. El anterior tenía 40 y no entraba en una línea a 320px ni
     ajustando el botón al contenido — quedaba en dos renglones ocupando casi
     toda la pantalla del teléfono. */
  button: "Quiero una recomendación",
  href: "#contacto",
};


/**
 * Nota de honestidad de la sección Servicios (escenas ilustrativas, no clientes).
 * Disponible para 009F-B; no se renderiza en 009F-A.
 */
export const servicesNote =
  "Escenas ilustrativas. Mostramos cómo funciona cada sistema con ejemplos de rubro. No son clientes reales ni resultados garantizados.";

/** Nota de honestidad de la sección Aplicaciones (escenarios, no casos reales). */
export const applicationsNote =
  "Demos con datos ilustrativos — los nombres y negocios son de ejemplo. Los sistemas son reales: así funcionan los que construimos, adaptados a cada negocio. De hecho, las consultas de esta web se registran con un sistema como este.";

/**
 * Casos v2 — "Lo que construimos, funcionando" (2026-07-07): 4 demos VIVAS del
 * servicio en orden pipeline (la misma consulta ficticia de Julián P. atraviesa
 * landing → automatización → panel; el asistente muestra el canal WhatsApp).
 * Reemplaza el eje por-rubro (audiencia generalizada).
 */
export const serviceDemos = [
  {
    id: "landing",
    icon: "LayoutTemplate",
    pill: "Landing que convierte",
    lead: "Una visita entra, entiende qué ofrecés en segundos y te deja su consulta.",
    tagline: "Cada visita que entiende tu propuesta es una oportunidad que no se pierde.",
    description:
      "Diseñamos páginas rápidas y claras: un mensaje directo, un formulario simple y una consulta que llega lista para responder.",
    flow: [
      "Una visita llega a la página",
      "Entiende la propuesta en segundos",
      "Deja su consulta en el formulario",
      "La consulta llega lista para responder",
    ],
    done: "Consulta enviada · Lista para responder",
  },
  {
    id: "asistente",
    icon: "Sparkles",
    pill: "Asistente con IA",
    lead: "Un cliente escribe fuera de horario y, aun así, sale con su pedido reservado.",
    tagline: "Cada consulta recibe respuesta al instante, con el tono de tu marca.",
    description:
      "Construimos asistentes que responden con la información de tu negocio, resuelven consultas de stock y precios, y cierran la venta sin que nadie esté mirando el teléfono.",
    flow: [
      "Un cliente escribe por WhatsApp",
      "El asistente responde con stock y precios",
      "Reserva el pedido y envía el link de pago",
      "La venta queda encaminada y registrada",
    ],
    done: "Pedido reservado · Link de pago enviado",
  },
  {
    id: "automatizacion",
    icon: "Workflow",
    pill: "Automatización",
    lead: "Llega una consulta y, sin que nadie la cargue, ya está registrada y tu equipo avisado.",
    tagline: "Nada depende de que alguien se acuerde: el sistema lo hace solo.",
    description:
      "Conectamos tu web y tus herramientas para que cada consulta se registre sola, dispare el aviso al equipo y quede lista para el seguimiento.",
    flow: [
      "Entra una consulta desde la web",
      "Se registra sola, con todos sus datos",
      "Tu equipo recibe el aviso por mail",
      "Queda lista para el seguimiento",
    ],
    done: "Registrada y avisada · Sin carga manual",
  },
  {
    id: "panel",
    icon: "Database",
    pill: "Panel de gestión",
    lead: "Todas las consultas del negocio en un solo lugar: qué entró, qué se respondió y qué está pendiente.",
    tagline: "Decidís mirando datos reales, no reconstruyendo conversaciones.",
    description:
      "Diseñamos paneles simples donde tu equipo ve cada consulta con su estado — sin planillas dispersas ni mensajes perdidos.",
    flow: [
      "Cada consulta entra al panel con su estado",
      "Se ve quién es y qué necesita",
      "El equipo la toma y responde",
      "Nada queda sin seguimiento",
    ],
    done: "Sin consultas perdidas · Todo con estado",
  },
] as const;

/** Microcopy interna de las escenas demo (ilustrativa, content-driven). */
export const serviceDemoScenes = {
  landing: {
    url: "tiendamoda.com.ar",
    brand: "Tienda Moda",
    headline: "La nueva colección ya está acá",
    sub: "Envíos a todo el país y cambios sin costo.",
    cta: "Ver colección",
    cards: ["Envíos a todo el país", "Cambios sin costo", "3 y 6 cuotas"],
    form: {
      nombre: "Julián P.",
      email: "julian@correo.com",
      mensaje: "¿Tienen la campera azul en talle M?",
    },
  },
  /** Conversación realista del asistente (WhatsApp real; hilo Talleres del Sur). */
  asistente: {
    business: "Tienda Moda",
    status: "en línea",
    chat: [
      { from: "client", text: "Hola! Vi la campera azul en la página. ¿La tienen en talle M?", time: "21:47" },
      { from: "assistant", text: "¡Hola! Sí 🙌 Nos queda en M y en L. Es esta — sale $68.000, con 3 y 6 cuotas sin interés.", time: "21:47", image: "/demo-assets/producto-campera.jpg" },
      { from: "client", text: "Buenísimo. ¿Hacen envíos a Córdoba?", time: "21:48" },
      { from: "assistant", text: "Sí, llega en 3 a 5 días hábiles y el envío es gratis desde $50.000. ¿Te la reservo en M?", time: "21:48" },
      { from: "client", text: "Dale, reservala 👌", time: "21:48" },
      { from: "assistant", text: "Listo ✅ Te envié el link de pago. Apenas se acredite te paso el número de seguimiento.", time: "21:49" },
    ],
  },
  /** Flujo REAL: formulario web → fila en la planilla → mail al equipo. */
  automatizacion: {
    entrada: {
      title: "Llega la consulta desde tu web",
      meta: "hace 8 s",
      fields: [
        ["Nombre", "Julián P."],
        ["Pedido", "Campera azul · talle M"],
        ["Email", "julian@correo.com"],
      ],
    },
    registro: {
      title: "Se registra sola en tu planilla",
      headers: ["Fecha", "Cliente", "Pedido", "Estado"],
      row: ["08/07", "Julián P.", "Campera azul · M", "Nuevo"],
    },
    aviso: {
      title: "Tu equipo recibe el aviso por mail",
      sender: "Tienda Moda · Pedidos",
      subject: "Nuevo pedido: Julián P. — Campera azul (M)",
      body: "Talle M reservado desde la web. Preparar envío a Córdoba.",
      time: "ahora",
    },
  },
  panel: {
    header: "Consultas · esta semana",
    counters: [
      { label: "Nuevas", value: 2 },
      { label: "En curso", value: 3 },
      { label: "Respondidas", value: 12 },
    ],
    rows: [
      { name: "Julián P.", detail: "Campera azul · M", status: "Nueva" },
      { name: "Carla M.", detail: "Vestido lino · S", status: "En curso" },
      { name: "Andrés T.", detail: "Cambio de talle", status: "Respondida" },
    ],
  },
} as const;

/** Frase-firma editorial de la sección Nosotros (statement de identidad). */
export const aboutStatement = "La forma SYNTRA de construir.";

export const aboutPillars: AboutPillar[] = [
  {
    id: "postura",
    ghost: "POSTURA",
    title: "Estudio, no agencia",
    description:
      "Diseñamos el sistema completo: lo que ve tu cliente, los procesos que trabajan detrás y los datos que quedan en tu negocio.",
    stance: "Web, procesos y datos: un solo sistema, pensado como un todo.",
  },
  {
    id: "criterio",
    ghost: "CRITERIO",
    title: "Te decimos también lo que no conviene",
    description:
      "Antes de cotizar evaluamos qué necesita tu negocio y qué no, aunque eso implique un proyecto más chico.",
    stance: "Preferimos recomendar menos y que sea lo correcto.",
  },
  {
    id: "cercania",
    ghost: "CERCANÍA",
    title: "Hablás con quien construye",
    description:
      "Sin intermediarios ni gestores de cuenta: la persona que te responde es la misma que desarrolla tu sistema.",
    stance: "Explicarlo en términos claros es parte del trabajo.",
  },
  {
    id: "compromiso",
    ghost: "COMPROMISO",
    title: "El lanzamiento es la mitad del camino",
    description:
      "Después de lanzar seguimos trabajando: medición, ajustes y mejoras con el sistema en funcionamiento.",
    stance: "Un sistema en producción se mantiene y se mejora.",
  },
];

/**
 * Microcopy de los artefactos visuales de las cards de Nosotros (lock v3
 * "Brasa"). Ilustrativos y honestos: la recomendación de `criterio` es un
 * ejemplo de cómo asesoramos (decir qué NO comprar), no un caso real.
 */
export const aboutPillarVisuals: AboutPillarVisuals = {
  postura: {
    modules: [
      { icon: "Globe", label: "web" },
      { icon: "Workflow", label: "sistema" },
      { icon: "Database", label: "datos" },
    ],
  },
  criterio: {
    options: [
      { label: "Web con turnos online", tag: "te sirve hoy", picked: true },
      { label: "App a medida", tag: "todavía no" },
      { label: "E-commerce completo", tag: "de más para tu etapa" },
    ],
  },
  cercania: {
    question: "¿Puedo dejar de cargar los pedidos a mano?",
    typingLabel: "quien construye, escribiendo…",
    // La conversación CIERRA (antes el typing quedaba infinito = chat roto).
    answer: "Sí, esa carga se puede automatizar. Te preparo una propuesta concreta.",
    answeredLabel: "quien construye, respondió",
    avatar: "SC",
  },
  compromiso: {
    midLabel: "lanzamiento",
    endLabel: "seguimos con vos",
  },
};

/**
 * FAQ (rediseño "Puente térmico", 2026-07-06): 7 objeciones ordenadas de la
 * más bloqueante a la menor (auditoría product-experience-designer). Se
 * eliminó "¿Puedo automatizar…?" (Servicios ya lo responde) y la pregunta de
 * pago quedó fuera por decisión del owner. Cada respuesta: 2-4 frases.
 */
export const faqs: FaqItem[] = [
  {
    question: "¿Cuánto cuesta un proyecto?",
    answer:
      "Depende del alcance: no es lo mismo una landing que un sistema con automatizaciones, y por eso no publicamos precios genéricos. Escuchamos qué necesitás y te presentamos una propuesta con precio cerrado antes de empezar. Sin costos ocultos ni sorpresas a mitad de camino.",
  },
  {
    question: "¿Cuánto tiempo tarda?",
    answer:
      "Varía según el proyecto: una web puede estar lista en pocas semanas; un sistema con automatizaciones lleva más. En la propuesta te damos un plazo concreto, y durante el desarrollo vas viendo avances reales.",
  },
  {
    question: "¿Tengo que saber de tecnología?",
    answer:
      "No. Vos nos contás cómo trabaja tu negocio y de lo técnico nos ocupamos nosotros. Te explicamos cada decisión en lenguaje claro y no avanzamos hasta que tengas claro qué estamos construyendo y por qué.",
  },
  {
    question: "¿Sirve para mi tipo de negocio?",
    answer:
      "Trabajamos con negocios de todo tipo y tamaño. Si tu negocio atiende consultas, vende o tiene tareas repetitivas, es muy probable que haya procesos para mejorar. Y si creemos que no te conviene, te lo decimos.",
  },
  {
    question: "¿Qué necesito tener listo para empezar?",
    answer:
      "No necesitás tener nada preparado: ni logo, ni textos, ni una idea cerrada. Alcanza con que nos cuentes cómo trabajás hoy; en la primera reunión te ayudamos a ordenar prioridades y definir por dónde empezar.",
  },
  {
    question: "¿Y si no me gusta el resultado?",
    answer:
      "Antes de construir te mostramos cómo va a funcionar cada parte, y no comenzamos sin tu aprobación. Durante el desarrollo vas viendo avances en cada etapa, así que el resultado final nunca es una sorpresa: lo aprobaste paso a paso.",
  },
  {
    question: "¿Qué pasa después de lanzar?",
    answer:
      "Seguimos trabajando con vos después del lanzamiento: soporte, ajustes y mejoras, con un sistema preparado para crecer sin empezar de cero. Si más adelante querés sumar automatización o IA, se integra sobre lo que ya construimos.",
  },
];

/** Rail de la FAQ: microcopy de confianza + micro-CTA hacia Contacto. */
export const faqRail = {
  microcopy: "Lo que respondemos acá, lo sostenemos en la propuesta.",
  ctaQuestion: "¿Tenés otra pregunta?",
  ctaButton: "Escribinos",
  ctaHref: "/#contacto",
} as const;

export const workflow: WorkflowStep[] = [
  {
    step: 1,
    icon: "Telescope",
    title: "Entendemos tu negocio",
    description:
      "Analizamos tus objetivos, tus procesos y dónde estás perdiendo tiempo o ventas. Antes de proponer, escuchamos. El primer paso es sin compromiso.",
    result: "Diagnóstico claro",
    needFromYou: "Una charla y que nos cuentes cómo trabajás hoy.",
  },
  {
    step: 2,
    icon: "DraftingCompass",
    title: "Diseñamos el sistema",
    description:
      "Definimos cómo va a funcionar todo: diseño, estructura y las tareas que se van a automatizar. Nada de plantillas, todo pensado para tu caso.",
    result: "Propuesta para aprobar",
    needFromYou: "Revisás la propuesta y nos das el OK antes de construir nada.",
  },
  {
    step: 3,
    icon: "Cpu",
    title: "Construimos y automatizamos",
    description:
      "Desarrollamos con tecnología moderna y conectamos tus herramientas para que el trabajo repetitivo se haga solo.",
    result: "Sistema funcionando",
    needFromYou: "Casi nada de tu lado: nos das accesos puntuales y seguís con lo tuyo.",
  },
  {
    step: 4,
    icon: "TrendingUp",
    title: "Lanzamos y acompañamos",
    description:
      "Publicamos, medimos resultados reales y hacemos crecer el sistema a medida que crece tu negocio.",
    result: "En marcha y con soporte",
    needFromYou: "Usás el sistema; nosotros estamos atrás para lo que surja.",
  },
];

/** Cierre del Proceso — CTA relacional (arrancar por el paso 1, sin compromiso). */
export const workflowCta: WorkflowCta = {
  lead: "El primer paso es entender tu negocio.",
  body: "Sin compromiso: charlamos, escuchamos y te decimos con claridad si podemos ayudarte y cómo.",
  button: "Empecemos por entender tu negocio",
  href: "#contacto",
};

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
