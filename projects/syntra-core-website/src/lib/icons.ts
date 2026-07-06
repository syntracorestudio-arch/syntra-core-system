import {
  Blocks,
  Database,
  Bot,
  Building2,
  Cpu,
  DraftingCompass,
  Gem,
  Globe,
  Layers,
  LayoutTemplate,
  LifeBuoy,
  MessagesSquare,
  PenTool,
  Rocket,
  Route,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Store,
  Telescope,
  TrendingUp,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa de íconos para contenido data-driven (config/site.ts).
 * Solo los íconos usados → tree-shakeable. Resolver con getIcon(name).
 */
const iconMap = {
  Blocks,
  Database,
  Bot,
  Building2,
  Cpu,
  DraftingCompass,
  Gem,
  Globe,
  Layers,
  LayoutTemplate,
  LifeBuoy,
  MessagesSquare,
  PenTool,
  Rocket,
  Route,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Store,
  Telescope,
  TrendingUp,
  Workflow,
  Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;

export function getIcon(name: string): LucideIcon {
  return iconMap[name as IconName] ?? Sparkles;
}
