"use client";

import * as React from "react";
import { Tabs } from "radix-ui";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { services, servicesModulesMeta } from "@/config/site";
import { getIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM } from "@/lib/motion";
import { ROLE_COLOR, type RoleId } from "./roles";

/**
 * ServiceModulesTabs — Bloque 2 "Qué podés construir con cada módulo".
 *
 * Tabs accesibles (radix-ui: teclado ←/→, roles aria, foco gestionado) que profundizan
 * cada módulo sin duplicar las cards de arriba: intro comercial + qué puede incluir.
 * Content-driven (site.ts). Dark-first; el color de rol activo va inline (los tonos de
 * marca no pueden construirse como clases Tailwind dinámicas). reduced-motion safe.
 */
function ServiceModulesTabs() {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = React.useState(services[0]?.id ?? "web");

  return (
    <div className="mt-16 lg:mt-24">
      <div className="max-w-2xl">
        <h3 className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {servicesModulesMeta.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
          {servicesModulesMeta.subtitle}
        </p>
      </div>

      <Tabs.Root value={active} onValueChange={setActive} className="mt-8">
        {/* Selector de módulo */}
        <Tabs.List
          aria-label="Elegí un módulo"
          className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm sm:inline-flex"
        >
          {services.map((service) => {
            const role = ROLE_COLOR[service.id as RoleId] ?? ROLE_COLOR.ia;
            const Icon = getIcon(service.icon);
            const isActive = active === service.id;
            return (
              <Tabs.Trigger
                key={service.id}
                value={service.id}
                style={
                  isActive
                    ? { color: role.hex, boxShadow: `inset 0 0 0 1px ${role.hex}55` }
                    : undefined
                }
                className={cn(
                  "inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-foreground/[0.06]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {service.title}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        {/* Panel de cada módulo */}
        {services.map((service) => {
          const role = ROLE_COLOR[service.id as RoleId] ?? ROLE_COLOR.ia;
          return (
            <Tabs.Content
              key={service.id}
              value={service.id}
              className="mt-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.4, ease: EASE_PREMIUM }}
                className="rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur-sm sm:p-8"
              >
                <p className="max-w-2xl text-base leading-relaxed text-pretty text-foreground/90">
                  {service.moduleIntro}
                </p>
                <p
                  className="mt-6 font-accent text-xs tracking-widest uppercase"
                  style={{ color: role.hex }}
                >
                  Qué puede incluir
                </p>
                <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {service.includes.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm text-foreground/85"
                    >
                      <Check
                        className="mt-0.5 size-4 shrink-0"
                        style={{ color: role.hex }}
                        aria-hidden="true"
                      />
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </Tabs.Content>
          );
        })}
      </Tabs.Root>
    </div>
  );
}

export { ServiceModulesTabs };
