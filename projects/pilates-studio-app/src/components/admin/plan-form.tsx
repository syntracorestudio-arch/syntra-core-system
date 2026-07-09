"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";
import { createPlan, updatePlan } from "@/app/admin/planes/actions";

export type PlanConcept = "membership" | "abono" | "drop_in";

export type PlanInitial = {
  id: string;
  name: string;
  concept: PlanConcept;
  price: number;
  durationDays: number | null;
};

const inputCls =
  "rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring";

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "flex-1")}>
      {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear plan"}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function PlanForm({ initial = null }: { initial?: PlanInitial | null }) {
  const editing = initial !== null;
  return (
    <form action={editing ? updatePlan : createPlan} className="grid gap-4">
      {editing ? <input type="hidden" name="planId" value={initial!.id} /> : null}

      <Field label="Nombre">
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Ej: Abono mensual"
          defaultValue={initial?.name ?? ""}
          className={inputCls}
        />
      </Field>

      <Field label="Tipo">
        <select name="concept" defaultValue={initial?.concept ?? "membership"} className={inputCls}>
          <option value="membership">Membresía (ilimitado por período)</option>
          <option value="abono">Abono (por período)</option>
          <option value="drop_in">Clase suelta (1 clase)</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio">
          <div className="flex items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
            <span className="pl-3 text-muted-foreground">$</span>
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={initial?.price ?? 0}
              className="w-full rounded-md bg-transparent px-2 py-2 text-foreground outline-none"
            />
          </div>
        </Field>
        <Field label="Vigencia (días)">
          <input
            name="duration_days"
            type="number"
            min={1}
            max={365}
            defaultValue={initial?.durationDays ?? 30}
            className={inputCls}
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Para <strong>clase suelta</strong> la vigencia se ignora (habilita 1 clase por 30 días).
      </p>

      <div className="mt-1 flex gap-2">
        <SubmitButton editing={editing} />
        {editing ? (
          <Link href="/admin/planes" className={buttonClass("secondary", "md")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
