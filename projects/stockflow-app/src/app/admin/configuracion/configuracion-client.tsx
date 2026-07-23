"use client";

import { useState, useTransition } from "react";
import {
  LoaderCircle,
  Clock,
  Package,
  Percent,
  ShoppingCart,
  TrendingUp,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AvisoBanner } from "@/components/ui/aviso";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { updateSettings } from "./actions";

export type Settings = {
  expiryWarningDays: number;
  lowStockThresholdDefault: number;
  repriceRounding: number;
  minMarginPct: number;
  allowNegativeStock: boolean;
};

export function ConfiguracionClient({
  settings,
  storeName,
  children,
}: {
  settings: Settings;
  storeName: string;
  children?: React.ReactNode;
}) {
  const [dias, setDias] = useState(String(settings.expiryWarningDays));
  const [umbral, setUmbral] = useState(String(settings.lowStockThresholdDefault));
  const [redondeo, setRedondeo] = useState(String(settings.repriceRounding));
  const [margenMin, setMargenMin] = useState(String(settings.minMarginPct));
  const [negativo, setNegativo] = useState(settings.allowNegativeStock);
  const [aviso, setAviso] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const res = await updateSettings({
        expiry_warning_days: Number(dias),
        low_stock_threshold_default: Number(umbral),
        reprice_rounding: Number(redondeo),
        min_margin_pct: Number(margenMin),
        allow_negative_stock: negativo,
      });
      setAviso(
        res.ok
          ? { tone: "ok", text: "Ajustes guardados." }
          : { tone: "error", text: res.error },
      );
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <PageHeader
          title="Ajustes"
          subtitle={`Cómo trabaja StockFlow en ${storeName}.`}
          icon={SettingsIcon}
        />
      </div>

      <AvisoBanner aviso={aviso} onClose={() => setAviso(null)} />

      <div className="space-y-3">
        <Setting
          icon={Clock}
          title="Avisarme de vencimientos"
          help="Con cuántos días de anticipación querés que te avisemos. Un kiosco suele estar bien con 7; una dietética con productos frescos, con 2 o 3."
        >
          <div className="flex items-center gap-2">
            <input
              value={dias}
              onChange={(e) => setDias(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              aria-label="Días de anticipación"
              className="tabular h-11 w-20 rounded-lg border border-input bg-background px-3 text-center text-sm outline-none focus:border-primary"
            />
            <span className="text-sm text-muted-foreground">días antes</span>
          </div>
        </Setting>

        <Setting
          icon={Package}
          title="Avisarme de stock bajo"
          help="Cuántas unidades tienen que quedar para que te avisemos. Podés poner un número distinto en cada producto; este es el que se usa cuando no lo hacés."
        >
          <div className="flex items-center gap-2">
            <input
              value={umbral}
              onChange={(e) => setUmbral(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              aria-label="Umbral de stock bajo"
              className="tabular h-11 w-20 rounded-lg border border-input bg-background px-3 text-center text-sm outline-none focus:border-primary"
            />
            <span className="text-sm text-muted-foreground">unidades o menos</span>
          </div>
        </Setting>

        <Setting
          icon={Percent}
          title="Redondeo al remarcar"
          help="Cuando subís precios por porcentaje, redondeamos hacia arriba a este múltiplo. Un kiosco no vende a $1.847."
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">al múltiplo de</span>
            <input
              value={redondeo}
              onChange={(e) => setRedondeo(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              aria-label="Múltiplo de redondeo"
              className="tabular h-11 w-24 rounded-lg border border-input bg-background px-3 text-center text-sm outline-none focus:border-primary"
            />
          </div>
          {Number(redondeo) > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ejemplo: {money(1847)} pasa a{" "}
              <span className="tabular font-semibold text-foreground">
                {money(Math.ceil(1847 / Number(redondeo)) * Number(redondeo))}
              </span>
            </p>
          )}
        </Setting>

        <Setting
          icon={TrendingUp}
          title="Avisarme si un precio se queda corto"
          help="Debajo de este margen consideramos que un producto ya no te deja plata. Te avisamos una vez por semana y aparece en Precios."
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">menos de</span>
            <input
              value={margenMin}
              onChange={(e) => setMargenMin(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              aria-label="Margen mínimo"
              className="tabular h-11 w-20 rounded-lg border border-input bg-background px-3 text-center text-sm outline-none focus:border-primary"
            />
            <span className="text-sm text-muted-foreground">% de ganancia</span>
          </div>
          {Number(margenMin) > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Con {margenMin}%: algo que te sale {money(1000)} tiene que venderse a{" "}
              <span className="tabular font-semibold text-foreground">
                {money(Math.ceil(1000 / (1 - Number(margenMin) / 100)))}
              </span>{" "}
              o más.
            </p>
          )}
        </Setting>

        <Setting
          icon={ShoppingCart}
          title="Vender sin stock"
          help="Si está activado, la caja nunca se frena: si el sistema dice que no hay stock igual podés vender y te avisamos para que ajustes. Recomendado, porque el stock del sistema arranca incompleto."
        >
          <button
            type="button"
            role="switch"
            aria-checked={negativo}
            onClick={() => setNegativo((v) => !v)}
            className={cn(
              "flex h-7 w-12 cursor-pointer items-center rounded-full p-0.5 transition-colors",
              negativo ? "bg-primary" : "bg-secondary",
            )}
          >
            <span
              className={cn(
                "size-6 rounded-full bg-foreground transition-transform",
                negativo && "translate-x-5",
              )}
            />
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            {negativo
              ? "La caja nunca se frena. Te avisamos si algo queda en negativo."
              : "Si no hay stock, la venta se rechaza. Puede frenar el mostrador."}
          </p>
        </Setting>
      </div>

      <button
        type="button"
        onClick={guardar}
        disabled={pending}
        className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-6"
      >
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Guardar ajustes
      </button>

      {/* Los cobros van aparte: se conectan una vez y tienen su propio guardado,
          así que no cuelgan del botón "Guardar ajustes". */}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

function Setting({
  icon: Icon,
  title,
  help,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{help}</p>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
