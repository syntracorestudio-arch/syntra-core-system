"use client";

import { useEffect } from "react";

/**
 * HashScroll — scroll a anclas con offset de navbar fija, determinista.
 *
 * Next App Router hace el scroll de hash por JS y NO respeta `scroll-margin-top`,
 * por lo que las secciones quedaban tapadas/cortadas bajo la navbar fija.
 * Este handler intercepta los clics a anclas de la misma página (en fase de
 * captura, antes del <Link> de Next), cancela el scroll por defecto y scrollea
 * descontando la altura de la navbar.
 */
const NAV_OFFSET = 80; // navbar h-16 (64px) + 16px de aire

export function HashScroll() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Respetar clics modificados / botón no primario / ya cancelados.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      const hashIndex = href.indexOf("#");
      if (hashIndex === -1) return;

      const id = href.slice(hashIndex + 1);
      const path = href.slice(0, hashIndex);
      if (!id) return;

      // Solo anclas de la página actual ("#id" o "/#id" estando en "/").
      if (path !== "" && path !== "/") return;
      if (path === "/" && window.location.pathname !== "/") return;

      const el = document.getElementById(id);
      if (!el) return;

      e.preventDefault();
      const top = window.scrollY + el.getBoundingClientRect().top - NAV_OFFSET;
      window.scrollTo({ top, behavior: "smooth" });
      history.replaceState(null, "", href);

      /* Mover también el FOCO al destino. Al cancelar el salto nativo se perdía
         el único efecto que le importa a un usuario de teclado: el foco quedaba
         en el ancla, así que el siguiente Tab lo devolvía al header. Con el
         skip-link eso lo volvía inútil, y con cualquier CTA interno obligaba a
         re-tabular toda la navegación. `preventScroll` evita que el foco pelee
         con el scroll suave que acabamos de lanzar. El tabindex temporal se
         retira al salir para no dejar paradas de tabulación fantasma. */
      const teniaTabindex = el.hasAttribute("tabindex");
      if (!teniaTabindex) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
      if (!teniaTabindex) {
        el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
      }
    }

    // Captura: corre antes del onClick del <Link> de Next.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
