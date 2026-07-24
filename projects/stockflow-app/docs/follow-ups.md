# StockFlow — Follow-ups / deuda técnica

Tickets abiertos que NO entran en el PR actual pero quedan registrados para no perderse.

---

## SEC-1 — Gate owner en `reportes_summary` (009) y `reportes_medios` (017)

**Estado:** abierto (2026-07-24). **Prioridad:** media-alta (pre-launch).

Las dos funciones son `SECURITY DEFINER` y solo hacen `perform public.rpc_member(p_store_id)`
— es decir, chequean **membresía pero no rol**. Como se saltean la RLS por ser definer, un
**staff** autenticado podría llamarlas directo (ambas tienen `grant execute to authenticated`)
y leer financieros que son **solo-dueño**: ganancia, márgenes, costos, desglose por medio de
pago, fiado. Hoy las páginas que las consumen son `requireOwner`, así que por la UI no hay
fuga; el hueco es la **llamada directa a la RPC** por un staff con sesión.

`reportes_expenses` (018) ya nace con el gate owner correcto:
```sql
v_member := public.rpc_member(p_store_id);
if v_member.role <> 'owner' then raise exception 'not_allowed'; end if;
```

**Fix:** aplicar el mismo gate a `reportes_summary` y `reportes_medios`. **Regla dura:
NO editar 009 ni 017** (migraciones viejas, ya aplicadas, no se re-corren). Va en una
**migración nueva** con `create or replace function` que **re-pega el cuerpo vigente** de
cada función + el gate al inicio. Verificar con impersonación JWT: staff → `not_allowed`,
owner → mismo jsonb de antes. Sin cambio en el cliente (ya son owner).

**Origen:** review del owner en el PR de Egresos (feat/stockflow-gastos), donde se detectó y
corrigió el mismo patrón en `reportes_expenses`.
