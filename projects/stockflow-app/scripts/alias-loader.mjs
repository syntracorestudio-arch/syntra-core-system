/**
 * Resuelve el alias `@/` de tsconfig (y la extensión implícita) para `node --test`.
 * CERO dependencias: usa el registro de loaders de Node (>=20.6), no un paquete.
 *
 * Existe por una razón concreta: `src/lib/mercadopago.ts` importa con `@/…` y sin
 * extensión, así que el runner no podía cargarlo — y el cliente HTTP de
 * MercadoPago, que es el código que mueve plata, era el único de `src/lib` sin
 * un solo test. No es infraestructura de lujo: es lo que lo vuelve testeable.
 *
 * Uso:  node --import ./scripts/alias-loader.mjs --test src/lib/*.test.ts
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { existsSync } from "node:fs";
      import { fileURLToPath } from "node:url";

      const RAIZ = ${JSON.stringify(pathToFileURL(process.cwd() + "/src/").href)};

      /* TypeScript importa sin extensión; Node exige una. Se prueban las dos
         formas que usa este repo, en el orden en que las resuelve tsc. */
      function conExtension(url) {
        if (/\.(ts|tsx|mjs|js|json)$/.test(url)) return url;
        for (const suf of [".ts", ".tsx", "/index.ts"]) {
          if (existsSync(fileURLToPath(url + suf))) return url + suf;
        }
        return url;
      }

      export async function resolve(specifier, context, next) {
        if (specifier.startsWith("@/")) {
          return next(conExtension(new URL(specifier.slice(2), RAIZ).href), context);
        }
        /* Relativos SIN extensión dentro de nuestro código (los de node_modules
           los resuelve Node solo y no hay que tocarlos). */
        if (specifier.startsWith(".") && context.parentURL?.includes("/src/")) {
          return next(conExtension(new URL(specifier, context.parentURL).href), context);
        }
        return next(specifier, context);
      }
    `),
  import.meta.url,
);
