# StudioFlow — RPC de reserva atómica (draft, Fase 1B)

> **DRAFT documental. Pseudo-SQL/PL/pgSQL ilustrativo, NO ejecutable.** No es una migración.
> Fuente: [business-rules.md](../business-rules.md) §1–10, [database.md](../database.md) §7,
> [schema-draft.md](schema-draft.md).

## Por qué RPC `SECURITY DEFINER`

Reservar toca **cupo + crédito + reserva** y debe ser **atómico y sin sobrecupo ni doble
gasto** bajo concurrencia. No puede hacerse con inserts del cliente: se concentra en una
función `SECURITY DEFINER` que valida todas las reglas y escribe en **una transacción**.
El cliente solo llama `reserve_class(occurrence_id)` con su sesión (auth.uid()).

Garantías: **(a)** `booked_count` nunca supera `capacity`; **(b)** un crédito no se gasta dos
veces; **(c)** sin reservas duplicadas; **(d)** el actor pertenece al estudio de la ocurrencia.

---

## `reserve_class(p_occurrence_id uuid) → reservation`

### Validaciones (en orden)
1. **Resolver actor:** `member` activo de `auth.uid()` en el `studio_id` de la ocurrencia.
   Si no es member activo → error `not_a_member`.
2. **Estudio coherente:** `occurrence.studio_id` = `member.studio_id` (anti cross-tenant).
3. **Ocurrencia válida:** `status='scheduled'` y `starts_at > now()` → si no, `class_closed`.
4. **No duplicado:** no existe reserva `booked` de ese member en esa ocurrencia → `already_booked`.
5. **Cupo (atómico):** intentar `UPDATE … booked_count+1 WHERE booked_count < capacity`.
   Si no afecta filas → **sin cupo** → ofrecer waitlist (`no_capacity`).
6. **Cobertura de pago (política del estudio):**
   - Si **membresía vigente** → cubre, **no** consume crédito.
   - Si no, según `reservation_policy`:
     - `require_credit_or_membership` (default): exige **crédito disponible** → si no, revertir
       cupo y `no_credit`.
     - `allow_with_warning`: permite y marca aviso (deuda).
     - `allow_grace_n`: permite si reservas "fiadas" activas < `grace_n`.
     - `block_if_debt`: si está en deuda → `blocked_debt`.
7. **Descuento de crédito** (si corresponde): asiento `booking (-1)` en `credit_ledger`
   sobre el `member_pass` **no vencido** con saldo, tomado con `FOR UPDATE`.
8. **Crear reserva** y enlazar el asiento.

### Pseudo-lógica (PL/pgSQL ilustrativo — NO ejecutar)
```sql
create function reserve_class(p_occurrence_id uuid)
returns class_reservations
language plpgsql security definer set search_path = public as $$
declare
  v_occ      class_occurrences;
  v_member   members;
  v_settings studio_settings;
  v_has_membership boolean;
  v_pass     member_passes;
  v_ledger_id uuid;
  v_consumed boolean := false;
  v_res      class_reservations;
begin
  -- 1-2. ocurrencia + member activo del MISMO estudio
  select * into v_occ from class_occurrences where id = p_occurrence_id;
  if not found then raise exception 'occurrence_not_found'; end if;

  select m.* into v_member from members m
   where m.profile_id = auth.uid() and m.studio_id = v_occ.studio_id and m.status = 'active';
  if not found then raise exception 'not_a_member'; end if;

  -- 3. ocurrencia abierta y futura
  if v_occ.status <> 'scheduled' or v_occ.starts_at <= now() then
    raise exception 'class_closed';
  end if;

  -- 4. no duplicado
  if exists (select 1 from class_reservations
             where occurrence_id = v_occ.id and member_id = v_member.id and status = 'booked') then
    raise exception 'already_booked';
  end if;

  select * into v_settings from studio_settings where studio_id = v_occ.studio_id;

  -- 5. CUPO atómico (check + update en una sentencia; sin sobrecupo)
  update class_occurrences
     set booked_count = booked_count + 1
   where id = v_occ.id and booked_count < capacity;
  if not found then
    raise exception 'no_capacity';   -- el cliente ofrece join_waitlist()
  end if;

  -- 6. cobertura: ¿membresía vigente?
  v_has_membership := exists (
    select 1 from memberships
     where member_id = v_member.id and status = 'active'
       and now()::date between valid_from and valid_to);

  if not v_has_membership then
    -- buscar pack con saldo, no vencido, y BLOQUEARLO (anti doble gasto)
    select mp.* into v_pass
      from member_passes mp
     where mp.member_id = v_member.id and mp.expires_at > now()
       and (select coalesce(sum(delta),0) from credit_ledger
            where member_pass_id = mp.id) > 0
     order by mp.expires_at asc
     for update                       -- lock de fila: serializa el gasto
     limit 1;

    if found then
      insert into credit_ledger(studio_id, member_id, member_pass_id, delta, reason)
      values (v_occ.studio_id, v_member.id, v_pass.id, -1, 'booking')
      returning id into v_ledger_id;
      v_consumed := true;
    else
      -- sin crédito ni membresía: aplicar política
      if v_settings.reservation_policy = 'require_credit_or_membership' then
        update class_occurrences set booked_count = booked_count - 1 where id = v_occ.id; -- revertir cupo
        raise exception 'no_credit';
      elsif v_settings.reservation_policy = 'block_if_debt' then
        update class_occurrences set booked_count = booked_count - 1 where id = v_occ.id;
        raise exception 'blocked_debt';
      -- allow_with_warning / allow_grace_n: continuar (queda como deuda)
      end if;
    end if;
  end if;

  -- 8. crear reserva
  insert into class_reservations(studio_id, occurrence_id, member_id, status, consumed_credit, credit_ledger_id)
  values (v_occ.studio_id, v_occ.id, v_member.id, 'booked', v_consumed, v_ledger_id)
  returning * into v_res;

  return v_res;
end $$;
```

### Notas de concurrencia
- El **`UPDATE … WHERE booked_count < capacity`** es el guardia de cupo: dos llamadas
  simultáneas no pueden pasar de `capacity` (cada update bloquea la fila de la ocurrencia).
- El **`FOR UPDATE`** sobre `member_passes` serializa el gasto del **mismo** pack → sin doble
  descuento si el alumno dispara dos reservas a la vez.
- Todo corre en la transacción implícita de la función → o se aplica completo o se revierte.

---

## `join_waitlist(p_occurrence_id uuid) → waitlist`
Cuando `reserve_class` devuelve `no_capacity`:
1. Validar member activo del estudio (igual que arriba) y que no tenga ya reserva `booked`
   ni waitlist `waiting` en esa ocurrencia.
2. `position = coalesce(max(position),0)+1` para esa ocurrencia (calcular con la fila
   bloqueada o un índice/secuencia por ocurrencia para evitar choques).
3. Insertar `waiting`. **No** consume crédito (el crédito se gasta al promover, en Fase 1.1).

---

## `cancel_reservation(p_reservation_id uuid) → reservation`

### Reglas (business-rules §3, §7)
- Solo el **dueño** de la reserva (o admin del estudio) puede cancelar.
- **Dentro de ventana** (`now() <= starts_at - cancellation_window_hours`):
  - liberar cupo (`booked_count - 1`),
  - **refund** del crédito si la reserva lo consumió → asiento `refund (+1)`,
  - status `cancelled`.
- **Tarde / fuera de ventana**:
  - liberar cupo, status `cancelled`,
  - **sin refund** salvo `studio_settings.refund_on_late_cancel = true`.
- **No-show** (marcado vía `attendance`): mismo criterio que cancelación tardía (sin refund
  por default).

### Pseudo-lógica (ilustrativa)
```sql
create function cancel_reservation(p_reservation_id uuid)
returns class_reservations
language plpgsql security definer set search_path = public as $$
declare
  v_res class_reservations; v_occ class_occurrences; v_settings studio_settings;
  v_within boolean;
begin
  select * into v_res from class_reservations where id = p_reservation_id;
  if not found or v_res.status <> 'booked' then raise exception 'not_cancellable'; end if;

  -- autorización: dueño o admin/reception del estudio
  if not (
     v_res.member_id in (select id from members where profile_id = auth.uid())
     or auth_has_role(v_res.studio_id, array['admin','reception'])
  ) then raise exception 'forbidden'; end if;

  select * into v_occ from class_occurrences where id = v_res.occurrence_id for update;
  select * into v_settings from studio_settings where studio_id = v_res.studio_id;

  v_within := now() <= v_occ.starts_at - make_interval(hours => v_settings.cancellation_window_hours);

  -- liberar cupo
  update class_occurrences set booked_count = greatest(booked_count - 1, 0) where id = v_occ.id;

  -- refund de crédito según ventana/config
  if v_res.consumed_credit and (v_within or v_settings.refund_on_late_cancel) then
    insert into credit_ledger(studio_id, member_id, member_pass_id, delta, reason, reservation_id)
    select v_res.studio_id, v_res.member_id, cl.member_pass_id, +1, 'refund', v_res.id
      from credit_ledger cl where cl.id = v_res.credit_ledger_id;  -- mismo pack del gasto
  end if;

  update class_reservations set status='cancelled', cancelled_at=now() where id=v_res.id
  returning * into v_res;

  -- (Fase 1.1) si waitlist_enabled: promover al primero de la cola (otra RPC)
  return v_res;
end $$;
```

> **Refund al mismo pack:** el asiento `refund` referencia el `member_pass_id` del gasto
> original (`v_res.credit_ledger_id`) → el crédito vuelve al pack correcto. Si ese pack ya
> venció entre reserva y cancelación, decisión de producto (default: igual se acredita;
> revisar en Fase 1C).

---

## Códigos de error (contrato con el front)
| Código | Significado | UX sugerida |
| --- | --- | --- |
| `not_a_member` | No pertenece al estudio | bloquear / re-login |
| `class_closed` | Cancelada o ya empezó | refrescar agenda |
| `already_booked` | Ya tiene reserva | mostrar "ya reservada" |
| `no_capacity` | Sin cupo | ofrecer **lista de espera** |
| `no_credit` | Sin crédito ni membresía (policy) | CTA "comprar pack / pagar" |
| `blocked_debt` | Bloqueado por deuda | aviso + contactar estudio |
| `not_cancellable` | Reserva no cancelable | refrescar |
| `forbidden` | No autorizado | ocultar acción |

## Riesgos
1. **Revertir cupo en error de crédito:** el `UPDATE -1` de reversa debe ejecutarse antes del
   `raise` (como en el draft) o usar savepoints; cuidar que no quede cupo "fantasma".
2. **Promoción de waitlist (Fase 1.1):** al liberar cupo, promover dentro de la **misma**
   transacción/lock de la ocurrencia para no recrear sobrecupo.
3. **Pack vencido entre reserva y refund:** definir política (default: acreditar).
4. **make_interval / TZ:** la ventana se calcula en UTC sobre `starts_at` (UTC) → consistente
   con DST.
5. **Idempotencia de llamadas dobles** (doble tap): la unicidad parcial `booked` + el chequeo
   `already_booked` evitan reservas duplicadas.
6. **Tests (Fase 1C):** cupo concurrente (N>capacidad), doble gasto (2 reservas, 1 crédito),
   refund correcto dentro/fuera de ventana, no-show sin refund, aislamiento por estudio.

> Estos 3 drafts ([schema](schema-draft.md) · [rls](rls-draft.md) · esta RPC) son el insumo
> para escribir las migraciones reales en **Fase 1C** (`supabase/migrations/`), que requieren
> aprobación del owner y conexión a Supabase.
