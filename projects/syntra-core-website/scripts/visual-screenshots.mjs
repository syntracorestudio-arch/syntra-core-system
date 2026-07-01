// scripts/visual-screenshots.mjs
//
// Captura screenshots de la Home para el Visual Review del gate visual de SYNTRA
// (agents/governance/visual-quality-gate.md).
//
// Dos modos:
//   full     (default) — fullPage de la Home completa en los 6 breakpoints.
//   section            — element screenshot POR SECCIÓN a tamaño real (nítido, sin el
//                        downscale del fullPage). Ideal para revisar detalle (núcleo,
//                        chips, tipografía) y para que Claude LEA cada sección con visión.
//
// Asume que `npm run dev` YA está corriendo en http://localhost:3000 (no levanta server).
// Antes de capturar hace un pase de scroll hasta el final (y vuelve) para disparar los
// reveals `whileInView`/`FadeIn` (once:true → quedan visibles). No modifica la web.
//
// Uso:
//   npm run visual:shots                                  # full, 6 breakpoints
//   node scripts/visual-screenshots.mjs --mode=section    # todas las secciones
//   node scripts/visual-screenshots.mjs --mode=section --sections=contacto --viewports=390,1440
//   VISUAL_MODE=section VISUAL_SECTIONS=contacto npm run visual:shots
//
// Salida: .visual-review/<timestamp>/...   (ignorada por git — NO commitear)

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.VISUAL_BASE_URL ?? "http://localhost:3000";
const ROUTE = "/";

/** Lee `--key=value`, `--key value`, o una env var de fallback. */
function argVal(name, envName, fallback) {
  const pref = `--${name}=`;
  const eq = process.argv.find((a) => a.startsWith(pref));
  if (eq) return eq.slice(pref.length);
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  if (envName && process.env[envName]) return process.env[envName];
  return fallback;
}

const MODE = argVal("mode", "VISUAL_MODE", "full"); // "full" | "section"

// Secciones de la Home (anclas reales). Orden = orden de scroll.
const ALL_SECTIONS = ["inicio", "servicios", "casos", "proceso", "nosotros", "faq", "contacto"];
const SECTIONS = argVal("sections", "VISUAL_SECTIONS", ALL_SECTIONS.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Breakpoints obligatorios del gate visual.
const ALL_VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080, deviceScaleFactor: 1 },
];
const VP_FILTER = argVal("viewports", "VISUAL_VIEWPORTS", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const VIEWPORTS = VP_FILTER.length
  ? ALL_VIEWPORTS.filter((vp) => VP_FILTER.includes(String(vp.width)))
  : ALL_VIEWPORTS;

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
    await page.goto(BASE_URL + ROUTE, { waitUntil: "domcontentloaded", timeout: 8000 });
  } catch {
    return false;
  } finally {
    await context.close();
  }
  return true;
}

/**
 * Dispara los reveals `whileInView`/`FadeIn` con un pase de scroll hasta el final y
 * vuelve arriba. Sin esto lo de debajo del fold sale en opacity:0. Solo scrollea.
 */
async function revealByScrolling(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    let lastY = -1;
    for (let i = 0; i < 200; i++) {
      window.scrollBy(0, step);
      await sleep(120);
      const y = window.scrollY;
      const atBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atBottom || y === lastY) break;
      lastY = y;
    }
    await sleep(300);
    window.scrollTo(0, 0);
    await sleep(300);
  });
}

/** Carga la página en un viewport, asienta fuentes/hidratación y dispara reveals. */
async function openPage(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor ?? 2,
  });
  const page = await context.newPage();
  await page.goto(BASE_URL + ROUTE, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(800);
  await revealByScrolling(page);
  await page.waitForTimeout(300);
  return { context, page };
}

/** Modo full: fullPage de la Home completa por viewport. */
async function captureFull(browser) {
  for (const vp of VIEWPORTS) {
    const { context, page } = await openPage(browser, vp);
    const file = join(outDir, `${vp.width}x${vp.height}.png`);
    await page.screenshot({ path: file, fullPage: true });
    await context.close();
    console.log(`✓ ${vp.width}x${vp.height} → ${file}`);
  }
}

/** Modo section: element screenshot por sección, a tamaño real (nítido). */
async function captureSections(browser) {
  for (const vp of VIEWPORTS) {
    const { context, page } = await openPage(browser, vp);
    for (const id of SECTIONS) {
      const loc = page.locator(`#${id}`).first();
      if ((await page.locator(`#${id}`).count()) === 0) {
        console.warn(`  · #${id} no existe en la Home — salteo`);
        continue;
      }
      await loc.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const file = join(outDir, `${id}__${vp.width}x${vp.height}.png`);
      try {
        await loc.screenshot({ path: file });
        console.log(`✓ #${id} ${vp.width}x${vp.height} → ${file}`);
      } catch (e) {
        console.warn(`  · #${id} ${vp.width}x${vp.height} falló: ${e?.message ?? e}`);
      }
    }
    await context.close();
  }
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

    console.log(
      `Modo: ${MODE}` +
        (MODE === "section" ? ` · secciones: ${SECTIONS.join(", ")}` : "") +
        ` · viewports: ${VIEWPORTS.map((v) => v.width).join(", ")}\n`,
    );

    if (MODE === "section") {
      await captureSections(browser);
    } else {
      await captureFull(browser);
    }

    console.log(`\nScreenshots en:\n${outDir}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("✗ Error generando screenshots:", err?.message ?? err);
  process.exitCode = 1;
});
