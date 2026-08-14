"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { headers, cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { emailSintetico } from "@/lib/credenciales";

import { COOKIE_KIOSCO, COOKIE_KIOSCO_NOMBRE } from "./cookies";

const UN_ANIO = 60 * 60 * 24 * 365;

const schemaDuenio = z.object({
  email: z.string().email("Revisá el email."),
  password: z.string().min(1, "Escribí tu contraseña."),
});

const schemaEmpleado = z.object({
  kiosco: z.string().trim().min(1, "Poné el código del negocio."),
  usuario: z.string().trim().min(1, "Poné tu usuario."),
  password: z.string().min(1, "Escribí tu contraseña."),
});

/** `usuario` vuelve al form para no obligar a retipearlo tras un error. */
export type LoginState = { error?: string; usuario?: string };

/**
 * Login. Endpoint público → pasa por rate limit (baseline
 * `syntra-scale-security-baseline`), valida server-side y devuelve un error
 * GENÉRICO: nunca revela si el email existe.
 */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  /* El MODO llega del form. Confiárselo es seguro: las dos ramas terminan en el
     mismo `signInWithPassword` y ninguna otorga nada — lo único que cambia es
     de dónde sale el string del email. */
  const modo = formData.get("modo") === "empleado" ? "empleado" : "duenio";
  const usuarioTipeado = String(formData.get("usuario") ?? "");

  let email: string;
  let password: string;
  let slug = "";

  if (modo === "empleado") {
    const parsed = schemaEmpleado.safeParse({
      kiosco: formData.get("kiosco"),
      usuario: formData.get("usuario"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Revisá los datos.",
        usuario: usuarioTipeado,
      };
    }
    slug = parsed.data.kiosco.toLowerCase();
    /* El slug viaja DENTRO del email, así que no hace falta consultar la base
       para resolver el negocio: se compone y se intenta. Un kiosco inexistente
       da un email inexistente ⇒ el mismo error genérico que una clave mala. */
    email = emailSintetico(slug, parsed.data.usuario);
    password = parsed.data.password;
  } else {
    const parsed = schemaDuenio.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
    }
    email = parsed.data.email;
    password = parsed.data.password;
  }

  /* Freno anti fuerza-bruta en DOS ejes. Fail-open: si el limiter se cae, no
     dejamos a nadie afuera de su propio negocio.

     049 · el freno por cuenta es el que importa y no existía: un kiosco entero
     sale por UNA sola IP, así que el cupo compartido lo consumían tres
     empleados equivocándose, mientras que un atacante con muchas IPs no tenía
     ningún techo sobre una cuenta puntual. Por eso el de IP se afloja (30) y
     el freno real pasa a la cuenta (5 / 15 min).

     La clave se hashea: `rate_limits` es una tabla y no tiene por qué guardar
     el email de nadie en claro. */
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const cuenta = createHash("sha256").update(email.toLowerCase()).digest("hex");

  const [ipOk, cuentaOk] = await Promise.all([
    checkRateLimit(`login:ip:${ip}`, 30, 300),
    checkRateLimit(`login:acct:${cuenta}`, 5, 900),
  ]);
  if (!ipOk || !cuentaOk) {
    return {
      error: "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
      usuario: usuarioTipeado,
    };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Degradar con honestidad: "credenciales malas" solo cuando GoTrue lo dijo
    // (400). Cualquier otra cosa (Supabase local apagado, red caída, 5xx) es un
    // problema NUESTRO y decirle "contraseña incorrecta" al dueño lo manda a
    // pelearse con su clave — pasó el 2026-07-23 con Docker cerrado.
    if (error.status === 400) {
      /* UN SOLO mensaje para kiosco inexistente, usuario inexistente y clave
         equivocada: decir cuál de los tres falló le regala al que prueba la
         mitad del trabajo. */
      return {
        error: "No pudimos entrar. Revisá los datos y probá de nuevo.",
        usuario: usuarioTipeado,
      };
    }
    return {
      error: "No pudimos conectar con el sistema. Esperá un momento y probá de nuevo.",
      usuario: usuarioTipeado,
    };
  }

  /* El kiosco se recuerda SÓLO tras un login exitoso. Si se escribiera en el
     submit, un typo envenenaría el terminal y el empleado quedaría pegado a un
     kiosco que no existe. Va antes del `redirect()`, que lanza. */
  if (modo === "empleado" && slug) {
    const ck = await cookies();
    ck.set(COOKIE_KIOSCO, slug, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: UN_ANIO,
    });
    const { data: negocio } = await supabase
      .from("stores")
      .select("name")
      .eq("slug", slug)
      .maybeSingle();
    if (negocio?.name) {
      /* Cosmético: sólo para saludar al terminal por su nombre. El servidor
         NUNCA lo usa para autenticar ni para resolver el negocio. */
      ck.set(COOKIE_KIOSCO_NOMBRE, negocio.name, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: UN_ANIO,
      });
    }
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/* 051 · acá vivía `roleHome(profileId)`. Se borró, no se arregló.
 *
 * Era un `export` de un archivo "use server" ⇒ un endpoint invocable por
 * CUALQUIERA, sin sesión, que aceptaba un `profileId` arbitrario y lo resolvía
 * con `createAdminClient()` (service_role, saltea RLS). Devolvía "/admin" o
 * "/pos": un oráculo de rol sobre cualquier UUID de la plataforma.
 *
 * No tenía un solo llamador (verificado en todo `src/`). El ruteo por rol real
 * lo hace `src/app/page.tsx` con la sesión propia del usuario, que es donde
 * corresponde. Ver docs/permisos-audit.md B-9. */
