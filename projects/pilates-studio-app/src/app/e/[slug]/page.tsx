import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, LogIn, MapPin, AtSign, Clock3, Ticket, CalendarHeart } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { accentForeground } from "@/lib/accent";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Agenda = { starts_at: string; class_name: string; instructor_name: string | null; duration_min: number | null; cupo: string };
type Pack = { name: string; credits: number; validity_days: number; price: number };
type Landing = {
  name: string;
  slug: string;
  timezone: string | null;
  status: string;
  accent: string | null;
  subtitle: string | null;
  whatsapp: string | null;
  address: string | null;
  instagram: string | null;
  agenda: Agenda[];
  packs: Pack[];
};

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
const CUPO: Record<string, { tone: BadgeTone; text: string }> = {
  open: { tone: "success", text: "Disponible" },
  few: { tone: "warning", text: "Últimos lugares" },
  full: { tone: "destructive", text: "Lleno" },
};

async function getLanding(slug: string): Promise<Landing | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc("public_studio_landing", { p_slug: slug });
  return (data as Landing | null) ?? null;
}

function waLink(num: string, name: string) {
  const digits = num.replace(/[^\d]/g, "");
  const text = encodeURIComponent(`Hola, vi la agenda de ${name} en la web y quiero sumarme.`);
  return `https://wa.me/${digits}?text=${text}`;
}
function igLink(h: string) {
  if (/^https?:\/\//.test(h)) return h;
  return `https://instagram.com/${h.replace(/^@/, "")}`;
}
function mapsLink(addr: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}
function money(n: number) {
  return `$${Number(n).toLocaleString("es-AR")}`;
}
function tzParts(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return {
    dayKey: `${p.weekday} ${p.day} ${p.month}`,
    time: `${p.hour}:${p.minute}`,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getLanding(slug);
  if (!d) return { title: "Estudio no encontrado" };
  return {
    title: `${d.name} — Reservá tu clase`,
    description: d.subtitle ?? `Reservá tus clases en ${d.name}.`,
  };
}

export default async function StudioLanding({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getLanding(slug);

  if (!d) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <CalendarHeart className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">No encontramos este estudio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Puede que el enlace esté mal escrito. Pedile a tu estudio el link correcto.
        </p>
      </main>
    );
  }

  const tz = d.timezone || DEFAULT_TZ;
  const initial = d.name.trim().charAt(0).toUpperCase() || "•";
  const accentStyle: CSSProperties | undefined = d.accent
    ? ({ "--primary": d.accent, "--ring": d.accent, "--primary-foreground": accentForeground(d.accent) } as CSSProperties)
    : undefined;
  const primaryCta = d.whatsapp
    ? { href: waLink(d.whatsapp, d.name), label: "Quiero sumarme", external: true }
    : d.instagram
      ? { href: igLink(d.instagram), label: "Escribinos", external: true }
      : null;
  const suspended = d.status === "suspended";

  // agrupar agenda por día (ya viene ordenada por starts_at)
  const byDay = new Map<string, { time: string; name: string; instructor: string | null; cupo: string; duration: number | null }[]>();
  for (const o of d.agenda) {
    const { dayKey, time } = tzParts(o.starts_at, tz);
    const arr = byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey)!;
    arr.push({ time, name: o.class_name, instructor: o.instructor_name, cupo: o.cupo, duration: o.duration_min });
  }

  return (
    <div style={accentStyle} className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-3xl px-5 pb-28 lg:px-8 lg:pb-16">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-primary/12 via-background to-background px-1 pt-10 pb-9 text-center sm:pt-14">
          <span
            className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-xl font-bold text-primary sm:size-16 sm:text-2xl"
            aria-hidden
          >
            {initial}
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{d.name}</h1>
          <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-primary" aria-hidden />
          {d.subtitle ? (
            <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground">{d.subtitle}</p>
          ) : null}
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            {primaryCta ? (
              <a
                href={primaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-base hover:opacity-90 active:scale-[0.98] sm:w-auto"
              >
                <MessageCircle className="size-4" aria-hidden />
                {primaryCta.label}
              </a>
            ) : null}
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              <LogIn className="size-4" aria-hidden />
              Ya soy alumno
            </Link>
          </div>
        </section>

        {/* AGENDA */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-foreground">Clases de la semana</h2>
          {suspended ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-sunken/60 px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">Este estudio no está tomando reservas por ahora.</p>
            </div>
          ) : byDay.size > 0 ? (
            <div className="mt-4 grid gap-6">
              {[...byDay.entries()].map(([day, items]) => (
                <div key={day}>
                  <h3 className="text-sm font-semibold capitalize text-muted-foreground">{day}</h3>
                  <div className="mt-2 grid gap-2">
                    {items.map((c) => {
                      const cupo = CUPO[c.cupo] ?? CUPO.open;
                      const full = c.cupo === "full";
                      return (
                        <div
                          key={`${day}-${c.time}-${c.name}`}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex min-w-14 flex-col">
                              <span className="text-xl font-bold leading-none tracking-tight text-foreground">
                                {c.time}
                              </span>
                              {c.duration ? (
                                <span className="mt-1 text-xs text-muted-foreground">{c.duration} min</span>
                              ) : null}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{c.name}</p>
                              {c.instructor ? (
                                <p className="text-sm text-muted-foreground">con {c.instructor}</p>
                              ) : null}
                              <div className="mt-1.5">
                                <Badge tone={cupo.tone} dot>
                                  {cupo.text}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {!full ? (
                            <Link
                              href="/login"
                              className="shrink-0 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                            >
                              Reservar
                            </Link>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-sunken/60 px-6 py-10 text-center">
              <Clock3 className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">
                Agenda en preparación.{primaryCta ? " Escribinos y te contamos los horarios." : ""}
              </p>
            </div>
          )}
        </section>

        {/* PACKS */}
        {d.packs.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-foreground">Packs</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {d.packs.map((p) => (
                <div key={p.name} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Ticket className="size-5" aria-hidden />
                  </span>
                  <p className="mt-3 font-semibold text-foreground">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.credits} {p.credits === 1 ? "clase" : "clases"} · {p.validity_days} días
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">{money(p.price)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* CONTACTO / UBICACIÓN */}
        {d.address || d.whatsapp || d.instagram ? (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-foreground">Dónde estamos</h2>
            <div className="mt-4 grid gap-2">
              {d.address ? (
                <a
                  href={mapsLink(d.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-base hover:-translate-y-px hover:shadow-md"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm text-foreground">{d.address}</span>
                </a>
              ) : null}
              {d.whatsapp ? (
                <a
                  href={waLink(d.whatsapp, d.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-base hover:-translate-y-px hover:shadow-md"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm text-foreground">{d.whatsapp}</span>
                </a>
              ) : null}
              {d.instagram ? (
                <a
                  href={igLink(d.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-base hover:-translate-y-px hover:shadow-md"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <AtSign className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm text-foreground">{d.instagram}</span>
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* FOOTER */}
        <footer className="mt-12 border-t border-border pt-6 text-center">
          <p className="text-sm font-semibold text-foreground">{d.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">Provisto por StudioFlow</p>
        </footer>
      </main>

      {/* CTA sticky en mobile */}
      {primaryCta ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 p-3 backdrop-blur lg:hidden">
          <a
            href={primaryCta.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-base active:scale-[0.98]"
          >
            <MessageCircle className="size-4" aria-hidden />
            {primaryCta.label}
          </a>
        </div>
      ) : null}
    </div>
  );
}
