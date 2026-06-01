import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/panel/login-form";

export const metadata: Metadata = {
  title: "Acceso al panel",
  robots: { index: false, follow: false },
};

export default function PanelLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <Card className="w-full max-w-sm gap-6 p-8">
        <div className="flex flex-col gap-1.5 text-center">
          <span className="font-heading text-lg font-bold tracking-tight">
            SYNTRA<span className="text-brand-cyan"> CORE</span>
          </span>
          <p className="text-sm text-muted-foreground">Panel interno de leads</p>
        </div>
        <LoginForm />
      </Card>
    </main>
  );
}
