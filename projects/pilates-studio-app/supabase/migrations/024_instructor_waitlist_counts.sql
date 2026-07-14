-- =============================================================================
-- StudioFlow — 024_instructor_waitlist_counts.sql  (Tanda 1 — vista instructor)
-- RPC instructor_waitlist_counts: cantidad de anotados EN ESPERA por ocurrencia,
-- solo para clases cuyo instructor asignado es quien consulta. Devuelve únicamente
-- el NÚMERO (nunca nombres ni member_ids — el instructor no ve la cola por RLS).
-- Aditiva, sin cambios de schema.
-- =============================================================================

create or replace function public.instructor_waitlist_counts(p_occurrence_ids uuid[])
returns table(occurrence_id uuid, waiting_count int)
language sql security definer set search_path = public as $$
  select w.occurrence_id, count(*)::int
    from public.waitlist w
    join public.class_occurrences o on o.id = w.occurrence_id
    join public.classes c on c.id = o.class_id
    join public.members m on m.id = c.instructor_id
   where w.occurrence_id = any(p_occurrence_ids)
     and w.status = 'waiting'
     and m.profile_id = auth.uid()
     and m.role = 'instructor'
     and m.status = 'active'
   group by w.occurrence_id
$$;

grant execute on function public.instructor_waitlist_counts(uuid[]) to authenticated;

-- Fin 024_instructor_waitlist_counts.sql
