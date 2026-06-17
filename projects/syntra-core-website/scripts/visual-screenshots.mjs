// scripts/visual-screenshots.mjs
//
// Captura screenshots de la Home en los breakpoints del gate visual de SYNTRA
// (agents/governance/visual-quality-gate.md), para el Visual Review.
//
// Asume que `npm run dev` YA está corriendo en http://localhost:3000.
// El script NO levanta el server (mantiene una sola responsabilidad: capturar).
//
// Antes del fullPage hace un pase de scroll hasta el final (y vuelve arriba) para
// disparar los reveals `whileInView`/`FadeIn`; sin eso, lo de debajo del fold sale
// en opacity:0 y el Visual Gate revisa capturas engañosas (VISUAL-WORKFLOW-003).
//
// Uso:   npm run visual:shots
// Salida: .visual-review/<timestamp>/<WxH>.png   (ignorada por git — NO commitear)

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.VISUAL_BASE_URL ?? "http://localhost:3000";
const ROUTE = "/";

// Breakpoints obligatorios del gate visual.
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

// Raíz del proyecto derivada de la ubicación del script (robusto en Windows y
// ante ejecución directa; no depende del cwd).
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Timestamp Windows-safe: sin ':' ni '.' (ilegales en nombres de carpeta).
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .replace("T", "_")
  .slice(0, 19);

const outDir = join(projectRoot, ".visual-review", stamp);

async function checkDevServer(browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(BASE_URL + ROUTE, {
      waitUntil: "domcontentloaded",
      timeout: 8000,
    });
  } catch {
    return false;
  } finally {
    await context.close();
  }
  return true;
}

/**
 * Dispara los reveals `whileInView`/`FadeIn` (framer-motion) con un pase de scroll
 * progresivo hasta el final, y vuelve arriba, ANTES del `fullPage`. Sin esto, todo
 * lo que está debajo del fold queda en `opacity: 0` en la captura. Como los reveals
 * usan `once: true`, permanecen visibles tras volver al tope. Solo lee/scrollea la
 * página servida — no modifica la web.
 */
async function revealByScrolling(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    let lastY = -1;
    // Bajar en pasos hasta tocar fondo (o hasta que scrollY deje de avanzar).
    for (let i = 0; i < 200; i++) {
      window.scrollBy(0, step);
      await sleep(120); // dejar disparar whileInView + correr el reveal one-shot
      const y = window.scrollY;
      const atBottom =
        y + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atBottom || y === lastY) break;
      lastY = y;
    }
    await sleep(300); // asentar el último reveal
    window.scrollTo(0, 0); // volver arriba para el fullPage
    await sleep(300); // asentar tras volver al tope
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    if (!(await checkDevServer(browser))) {
      console.error(
        `\n✗ No se pudo conectar a ${BASE_URL}.\n` +
          `  ¿Está corriendo "npm run dev"? (http://localhost:3000)\n`,
      );
      process.exitCode = 1;
      return;
    }

    for (const vp of VIEWPORTS) {
      // Un context por viewport: sin estado/scroll arrastrado entre capturas.
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2, // retina: capturas nítidas para la review
      });
      const page = await context.newPage();
      // `load` (no `networkidle`: el websocket HMR de Next dev nunca queda idle).
      await page.goto(BASE_URL + ROUTE, { waitUntil: "load", timeout: 30000 });
      // Asentar fuentes + hidratación inicial.
      await page.waitForTimeout(800);
      // Pase de scroll: dispara los reveals whileInView/FadeIn debajo del fold y
      // vuelve arriba (los reveals son `once` → quedan visibles para el fullPage).
      await revealByScrolling(page);
      // Margen final para que el último reveal quede asentado.
      await page.waitForTimeout(300);

      const file = join(outDir, `${vp.width}x${vp.height}.png`);
      await page.screenshot({ path: file, fullPage: true });
      await context.close();
      console.log(`✓ ${vp.width}x${vp.height} → ${file}`);
    }

    console.log(`\n${VIEWPORTS.length} screenshots en:\n${outDir}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("✗ Error generando screenshots:", err?.message ?? err);
  process.exitCode = 1;
});
