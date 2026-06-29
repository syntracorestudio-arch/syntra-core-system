"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";
import { createPass, updatePass } from "@/app/admin/packs/actions";

export type PackInitial = {
  id: string;
  name: string;
  credits: number;
  validityDays: number;
  price: number;
};

const inputCls =
  "rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring";

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "flex-1")}>
      {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear pack"}
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

export function PackForm({ initial = null }: { initial?: PackInitial | null }) {
  const editing = initial !== null;
  return (
    <form action={editing ? updatePass : createPass} className="grid gap-4">
      {editing ? <input type="hidden" name="passId" value={initial!.id} /> : null}

      <Field label="Nombre del pack">
        <input name="name" required maxLength={80} defaultValue={initial?.name ?? ""} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Clases (créditos)">
          <input
            name="credits"
            type="number"
            min={1}
            max={500}
            required
            defaultValue={initial?.credits ?? 8}
            className={inputCls}
          />
        </Field>
        <Field label="Vigencia (días)">
          <input
            name="validity_days"
            type="number"
            min={1}
            max={365}
            required
            defaultValue={initial?.validityDays ?? 30}
            className={inputCls}
          />
        </Field>
      </div>
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

      <div className="mt-1 flex gap-2">
        <SubmitButton editing={editing} />
        {editing ? (
          <Link href="/admin/packs" className={buttonClass("secondary", "md")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
