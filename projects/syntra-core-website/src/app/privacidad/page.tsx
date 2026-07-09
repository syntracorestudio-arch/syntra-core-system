import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { siteConfig } from "@/config/site";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Container } from "@/components/layout/container";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo SYNTRA CORE recopila, usa y protege los datos que nos enviás a través del sitio.",
};

export default function PrivacidadPage() {
  return (
    <>
      <Navbar />
      <main className="flex flex-1 flex-col pt-24">
        <Container className="flex max-w-3xl flex-col gap-8 py-12">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Volver al inicio
          </Link>

          <header className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Política de Privacidad
            </h1>
            <p className="text-sm text-muted-foreground">
              Última actualización: mayo de 2026
            </p>
          </header>

          <div className="flex flex-col gap-8 leading-relaxed text-muted-foreground">
            <Block title="Responsable">
              <p>
                {siteConfig.name} es responsable del tratamiento de los datos que
                nos proporcionás a través de este sitio. Para cualquier consulta
                sobre privacidad, escribinos a{" "}
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-[#60a5fa] hover:underline"
                >
                  {siteConfig.email}
                </a>
                .
              </p>
            </Block>

            <Block title="Qué datos recopilamos">
              <p>
                Únicamente los datos que enviás voluntariamente a través del
                formulario de contacto: nombre, email, empresa (opcional) y el
                mensaje que nos escribís. No recopilamos datos sensibles.
              </p>
            </Block>

            <Block title="Para qué los usamos">
              <p>
                Usamos esos datos exclusivamente para responder tu consulta,
                elaborar una propuesta y mantener el contacto comercial que vos
                iniciaste. No los usamos para publicidad de terceros.
              </p>
            </Block>

            <Block title="Dónde se almacenan">
              <p>
                Los datos se guardan de forma segura en nuestra base de datos
                (Supabase). Aplicamos medidas técnicas para protegerlos y el
                acceso está restringido a nuestro equipo.
              </p>
            </Block>

            <Block title="Con quién los compartimos">
              <p>
                No vendemos ni cedemos tus datos. Solo los procesan los
                proveedores tecnológicos que necesitamos para operar el sitio
                (por ejemplo, alojamiento y base de datos), bajo sus propias
                condiciones de seguridad.
              </p>
            </Block>

            <Block title="Cuánto tiempo los conservamos">
              <p>
                Conservamos tus datos mientras sean necesarios para gestionar tu
                consulta o relación comercial. Podés pedir su eliminación en
                cualquier momento.
              </p>
            </Block>

            <Block title="Tus derechos">
              <p>
                Podés solicitar acceder, rectificar o eliminar tus datos
                escribiéndonos a{" "}
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-[#60a5fa] hover:underline"
                >
                  {siteConfig.email}
                </a>
                . Responderemos a la brevedad.
              </p>
            </Block>

            <Block title="Cookies">
              <p>
                El sitio público no utiliza cookies de seguimiento ni
                publicitarias. Solo el panel interno usa una cookie técnica de
                sesión, que no afecta a los visitantes del sitio.
              </p>
            </Block>

            <Block title="Cambios en esta política">
              <p>
                Podemos actualizar esta política para reflejar mejoras o cambios
                legales. Publicaremos siempre la versión vigente en esta página.
              </p>
            </Block>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
