-- =============================================================================
-- StudioFlow — 012_public_studio_landing.sql  (Fase 1.1-B / landing pública)
-- RPC público para la landing por slug: devuelve SOLO datos no sensibles del
-- estudio + agenda de la semana con cupo CUALITATIVO (sin números crudos ni
-- nombres de alumnos) + packs activos. SECURITY DEFINER (bypass RLS controlado),
-- grant a anon (la landing es pública, sin login).
-- =============================================================================

create or replace function public.public_studio_landing(p_slug text)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_studio public.studios;
  v_agenda jsonb;
  v_packs  jsonb;
begin
  select * into v_studio from public.studios where slug = p_slug;
  if not found then return null; end if;  -- slug inexistente → 404 cálido en la app

  -- agenda próxima (7 días), cupo derivado a estado (no expone booked_count crudo)
  select coalesce(jsonb_agg(to_jsonb(a) order by a.starts_at), '[]'::jsonb) into v_agenda
  from (
    select o.starts_at,
           c.name          as class_name,
           c.instructor_name,
           c.duration_min,
           case
             when o.capacity - o.booked_count <= 0 then 'full'
             when o.capacity - o.booked_count <= 2 then 'few'
             else 'open'
           end as cupo
    from public.class_occurrences o
    join public.classes c on c.id = o.class_id
    where o.studio_id = v_studio.id
      and o.status = 'scheduled'
      and o.starts_at > now()
      and o.starts_at < now() + interval '7 days'
    order by o.starts_at
    limit 80
  ) a;

  -- packs activos (catálogo público de precios)
  select coalesce(jsonb_agg(to_jsonb(p) order by p.price), '[]'::jsonb) into v_packs
  from (
    select name, credits, validity_days, price
    from public.passes
    where studio_id = v_studio.id and active
    order by price
  ) p;

  return jsonb_build_object(
    'name',      v_studio.name,
    'slug',      v_studio.slug,
    'timezone',  v_studio.timezone,
    'status',    v_studio.status,
    'accent',    v_studio.branding->>'accent',
    'subtitle',  v_studio.branding->>'subtitle',
    'whatsapp',  v_studio.branding->>'whatsapp',
    'address',   v_studio.branding->>'address',
    'instagram', v_studio.branding->>'instagram',
    'agenda',    v_agenda,
    'packs',     v_packs
  );
end $$;
grant execute on function public.public_studio_landing(text) to anon, authenticated;

-- Fin 012_public_studio_landing.sql
