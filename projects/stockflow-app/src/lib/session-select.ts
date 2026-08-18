/**
 * El `select` de la sesión, en un módulo SIN imports.
 *
 * Vive solo para que lo puedan compartir dos consumidores que no pueden
 * importarse entre sí: `session.ts` (que arrastra `next/navigation` y no corre
 * fuera de Next) y `scripts/smoke-sesion.mjs` (Node pelado).
 *
 * Compartir la cadena —en vez de copiarla en el test— es lo que vuelve real al
 * smoke: con una copia, el test seguiría verde mientras la consulta de la app
 * se rompe. Que es exactamente lo que pasó el 2026-08-18: la migración 055
 * agregó `members.created_by → profiles`, el embed `profiles!inner` quedó
 * ambiguo (PGRST201), `getSession` empezó a dar null y la app quedó SIN ACCESO
 * —todos rebotaban al login— con tsc, lint, build, 100 tests TS y 25 suites SQL
 * en verde.
 *
 * REGLA: todo embed nombra su FK explícitamente (`!members_profile_id_fkey`).
 * Así, cuando alguien agregue otra columna que apunte a la misma tabla, esta
 * consulta ni se entera.
 */
export const SELECT_SESION = `id, role, display_name, can_sell_on_credit, can_apply_discount,
       can_void_sale, can_receive_stock, can_see_costs, usuario,
       can_close_register, can_see_reports,
       profile:profiles!members_profile_id_fkey!inner ( must_change_password ),
       store:stores!inner ( id, name, slug, timezone, branding, status, vertical, ai_assistant_enabled )`;
