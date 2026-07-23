import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  PackagePlus,
  Users,
  CalendarClock,
  Settings,
  ChartColumn,
  Wallet,
  Users2,
  TrendingUp,
} from "lucide-react";

/**
 * Datos de navegación compartidos entre la sidebar (client, para el rail
 * animado) y la barra mobile (server). Sin "use client": esto es solo data.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavGroup = {
  label: string;
  /** Hue de identidad del grupo (auditoría 2026-07-23): tick + label activo.
      AA sobre #111621. Sin violeta/cyan; el verde queda sagrado (plata). */
  hue: string;
  items: NavItem[];
};

/**
 * Navegación del dueño, agrupada por el modelo mental del kiosquero:
 * lo que toca todos los días · el flujo físico de mercadería · la plata ·
 * el setup que casi no toca. (El empleado ve un set recortado por permisos.)
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    hue: "#6d9bff", // el pulso diario — azul de marca
    items: [
      { href: "/admin", label: "Resumen", icon: LayoutDashboard },
      { href: "/pos", label: "Vender", icon: ScanBarcode },
      { href: "/admin/caja", label: "Caja", icon: Wallet },
    ],
  },
  {
    label: "Mercadería",
    hue: "#e3b378", // arena/cobre — cajas, lo físico (desaturado, no compite con warning)
    items: [
      { href: "/admin/productos", label: "Productos", icon: Package },
      /* "Recibir mercadería" y no "Ingreso": ingreso solo, al lado de Caja y
         Fiado, se lee como plata que entra. */
      { href: "/admin/ingreso", label: "Recibir mercadería", icon: PackagePlus },
      { href: "/admin/precios", label: "Precios", icon: TrendingUp },
      { href: "/admin/vencimientos", label: "Vencimientos", icon: CalendarClock },
    ],
  },
  {
    /* "Control" y no "Plata" (pedido del owner 2026-07-22): agrupa lo que se
       mira para controlar el negocio — a quién cobrar y cómo viene. */
    label: "Control",
    hue: "#ec8d6f", // terracota — "mirar/cobrar", cálido sin pisar el danger (rosa rechazado 2026-07-23)
    items: [
      { href: "/admin/fiado", label: "Fiado", icon: Users },
      { href: "/admin/reportes", label: "Reportes", icon: ChartColumn },
    ],
  },
  {
    label: "Negocio",
    hue: "#7c92b8", // acero azulado — setup, énfasis bajo pero COLOR (el gris claro leía blanco)
    items: [
      { href: "/admin/equipo", label: "Equipo", icon: Users2 },
      { href: "/admin/configuracion", label: "Ajustes", icon: Settings },
    ],
  },
];

export const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
