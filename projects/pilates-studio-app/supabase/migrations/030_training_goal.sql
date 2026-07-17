-- =============================================================================
-- StudioFlow — 030_training_goal.sql  (Mi entrenamiento: objetivo mensual)
-- members.monthly_goal: meta de clases por mes que el ALUMNO se pone a sí mismo.
-- La escribe el propio alumno (update de su member) — política dedicada, porque
-- members no tiene update propio (el resto de la fila la gobierna el estudio).
-- Aditiva y no destructiva.
-- =============================================================================

alter table public.members
  add column if not exists monthly_goal integer
  check (monthly_goal is null or (monthly_goal between 1 and 60));

-- RPC en lugar de UPDATE directo: si abriéramos update sobre members, el alumno
-- podría tocar role/status. La función solo escribe monthly_goal de SU member.
create or replace function public.set_monthly_goal(p_goal integer)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_goal is not null and (p_goal < 1 or p_goal > 60) then
    raise exception 'invalid_goal';
  end if;
  update public.members
     set monthly_goal = p_goal
   where profile_id = auth.uid()
     and role = 'client'
     and status = 'active';
  if not found then raise exception 'not_a_member'; end if;
end $$;

grant execute on function public.set_monthly_goal(integer) to authenticated;

-- Fin 030_training_goal.sql
