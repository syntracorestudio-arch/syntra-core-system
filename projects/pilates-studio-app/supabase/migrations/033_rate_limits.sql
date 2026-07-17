-- =============================================================================
-- StudioFlow — 033_rate_limits.sql  (freno anti fuerza-bruta, auditoría 2026-07-17)
-- Contador de ventana fija en Postgres: cero servicios nuevos, funciona igual en
-- serverless (a diferencia de un contador en memoria, que muere con cada instancia).
-- Usos: /join (adivinar códigos de estudio) y login (refuerzo del rate limit de Auth).
-- =============================================================================

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 1
);

alter table public.rate_limits enable row level security;
-- Sin policies: solo la función SECURITY DEFINER la toca (ni anon ni authenticated).

-- true = permitido (y cuenta el intento); false = frenado.
create or replace function public.check_rate_limit(
  p_key            text,
  p_max            integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_now   timestamptz := now();
  v_row   public.rate_limits;
begin
  -- higiene oportunista: de vez en cuando barrer ventanas viejas (tabla chica siempre)
  if random() < 0.02 then
    delete from public.rate_limits where window_start < v_now - interval '1 day';
  end if;

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count        = case when rl.window_start < v_now - make_interval(secs => p_window_seconds)
                            then 1 else rl.count + 1 end,
        window_start = case when rl.window_start < v_now - make_interval(secs => p_window_seconds)
                            then v_now else rl.window_start end
  returning * into v_row;

  return v_row.count <= p_max;
end $$;

-- anon incluido: login y join corren sin sesión.
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;

-- Fin 033_rate_limits.sql
