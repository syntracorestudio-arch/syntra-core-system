import {
  Bot,
  Building2,
  Gem,
  Layers,
  LayoutTemplate,
  LifeBuoy,
  PenTool,
  Rocket,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa de íconos para contenido data-driven (config/site.ts).
 * Solo los íconos usados → tree-shakeable. Resolver con getIcon(name).
 */
const iconMap = {
  Bot,
  Building2,
  Gem,
  Layers,
  LayoutTemplate,
  LifeBuoy,
  PenTool,
  Rocket,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  Workflow,
  Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;

export function getIcon(name: string): LucideIcon {
  return iconMap[name as IconName] ?? Sparkles;
}
