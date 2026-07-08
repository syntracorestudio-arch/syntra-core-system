-- =============================================================================
-- StudioFlow — seed.sql  (Fase 1C-1)
-- Datos demo mínimos: "Estudio Reforma" (+ "Estudio B" para test de aislamiento).
-- Se corre tras las migraciones (supabase db reset). Usa service_role/superuser
-- (bypassa RLS). El trigger 004 crea public.profiles desde auth.users.
-- ESTADO: escrito, NO validado ejecutándose (Docker/Supabase local no disponible).
-- UUIDs fijos para determinismo en las validaciones.
-- =============================================================================

-- ---------- Estudios + settings ----------
insert into public.studios (id, name, slug, timezone, branding) values
  ('11111111-1111-1111-1111-111111111111','Estudio Reforma','estudio-reforma',
   'America/Argentina/Buenos_Aires','{"accent":"#C8775A"}'),
  ('22222222-2222-2222-2222-222222222222','Estudio B','estudio-b',
   'America/Argentina/Buenos_Aires','{"accent":"#5E8B6A"}');

insert into public.studio_settings (studio_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');  -- defaults: 24h, require_credit_or_membership, refund_on_late_cancel=false

-- ---------- auth.users (el trigger 004 crea los profiles) ----------
-- Inserción mínima razonable; puede requerir ajuste de columnas en la 1ª aplicación real.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'admin@reforma.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Admin Reforma"}'),
  ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'sofia@reforma.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Sofía Alumna"}'),
  ('a0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'lucia@reforma.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Lucía Membresía"}'),
  ('a0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'marco@reforma.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Marco PackVencido"}'),
  ('a0000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'caro@reforma.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Caro Instructora"}'),
  ('a0000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'recepcion@reforma.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Rocío Recepción"}'),
  ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'admin@estudiob.test', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Admin B"}');

-- GoTrue (Go, tipos estrictos) no puede escanear columnas de token en NULL al loguear.
-- Las dejamos en '' para los usuarios demo insertados directo en auth.users.
-- (Validado: sin esto, /auth/v1/token devuelve 500 "Database error querying schema".)
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, ''),
  email_change_confirm_status = coalesce(email_change_confirm_status, 0)
where email like '%@reforma.test' or email like '%@estudiob.test';

-- ---------- members (rol por estudio) ----------
insert into public.members (id, studio_id, profile_id, role) values
  ('d1111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','admin'),
  ('d1111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000002','client'),
  ('d1111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000003','client'),
  ('d1111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000004','client'),
  ('d1111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000005','instructor'),
  ('d1111111-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000006','reception'),
  ('d2222222-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','admin');

-- ---------- clase + recurrencia + ocurrencias ----------
-- Reformer con instructor CON LOGIN (Caro, member rol instructor) → alimenta /instructor.
insert into public.classes (id, studio_id, name, type, default_capacity, duration_min, instructor_id, instructor_name) values
  ('c1111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Reformer','reformer',8,60,
   'd1111111-0000-0000-0000-000000000005','Caro Instructora');

insert into public.class_schedules (id, studio_id, class_id, weekday, start_time, capacity, valid_from) values
  ('51111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c1111111-0000-0000-0000-000000000001',
   extract(dow from (now()+interval '2 day'))::int, '08:00', 8, now()::date);

-- Ocurrencia FUTURA con cupo chico (capacity=2) para probar lleno→waitlist y cancelación.
insert into public.class_occurrences (id, studio_id, class_id, schedule_id, starts_at, ends_at, capacity, booked_count, status) values
  ('01111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c1111111-0000-0000-0000-000000000001',
   '51111111-0000-0000-0000-000000000001', now()+interval '2 day', now()+interval '2 day'+interval '60 min', 2, 0, 'scheduled'),
-- Ocurrencia futura cupo normal (pronto: es la próxima real con anotados → alimenta el
-- roster/check-in de la vista de instructor como primera clase seleccionada).
  ('01111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','c1111111-0000-0000-0000-000000000001',
   '51111111-0000-0000-0000-000000000001', now()+interval '5 hours', now()+interval '5 hours'+interval '60 min', 8, 0, 'scheduled');

-- ---------- catálogo: pass ----------
insert into public.passes (id, studio_id, name, credits, validity_days, price) values
  ('a1111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Pack 8 clases',8,30,32000);

-- ---------- Sofía: pack ACTIVO (8 créditos) + asiento purchase ----------
insert into public.payments (id, studio_id, member_id, amount, concept, method, status, recorded_by) values
  ('70000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000002',
   32000,'pack','cash','confirmed','d1111111-0000-0000-0000-000000000001');
insert into public.member_passes (id, studio_id, member_id, pass_id, credits_total, expires_at, source_payment_id) values
  ('80000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000002',
   'a1111111-0000-0000-0000-000000000001',8, now()+interval '30 day','70000000-0000-0000-0000-000000000001');
insert into public.credit_ledger (studio_id, member_id, member_pass_id, delta, reason) values
  ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001',8,'purchase');

-- ---------- Lucía: MEMBRESÍA activa ----------
insert into public.memberships (studio_id, member_id, type, valid_from, valid_to, status) values
  ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000003','monthly', now()::date, (now()+interval '20 day')::date, 'active');

-- ---------- Marco: pack VENCIDO + reserva que consumió crédito (fixture refund-sin-pack) ----------
-- pack ya vencido (expires_at en el pasado), saldo 0 tras el booking.
insert into public.member_passes (id, studio_id, member_id, pass_id, credits_total, expires_at, status) values
  ('80000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000004',
   'a1111111-0000-0000-0000-000000000001',1, now()-interval '1 day','expired');
insert into public.credit_ledger (studio_id, member_id, member_pass_id, delta, reason) values
  ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000004','80000000-0000-0000-0000-000000000009',1,'purchase');
-- reserva FUTURA (dentro de ventana) que consumió ese crédito → al cancelar NO debe reembolsar (pack vencido)
insert into public.credit_ledger (id, studio_id, member_id, member_pass_id, delta, reason) values
  ('90000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000004',
   '80000000-0000-0000-0000-000000000009',-1,'booking');
insert into public.class_reservations (id, studio_id, occurrence_id, member_id, status, consumed_credit, credit_ledger_id) values
  ('60000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','01111111-0000-0000-0000-000000000002',
   'd1111111-0000-0000-0000-000000000004','booked', true, '90000000-0000-0000-0000-000000000009');
update public.class_occurrences set booked_count = booked_count + 1 where id = '01111111-0000-0000-0000-000000000002';

-- Lucía (membresía activa → sin consumir crédito) también anotada en la Reformer:
-- da un roster de 2 para la vista del instructor (Caro).
insert into public.class_reservations (id, studio_id, occurrence_id, member_id, status, consumed_credit) values
  ('60000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','01111111-0000-0000-0000-000000000002',
   'd1111111-0000-0000-0000-000000000003','booked', false);
update public.class_occurrences set booked_count = booked_count + 1 where id = '01111111-0000-0000-0000-000000000002';

-- ---------- Código de alta demo para Estudio Reforma (Fase 1D-1B) ----------
-- Texto plano: REFORMA-DEMO  ·  se guarda SOLO el hash (sha256 del código normalizado).
insert into public.studio_join_codes (studio_id, code_hash, label, is_active, max_uses) values
  ('11111111-1111-1111-1111-111111111111',
   encode(digest('REFORMA-DEMO','sha256'),'hex'), 'Código demo', true, null);

-- ---------- Semana de clases demo (Fase 1E) ----------
-- Una agenda realista para ver el calendario lleno y los estados de cupo
-- (Disponible / Últimos lugares / Lleno). Clase "Mat" + ocurrencias single
-- (schedule_id null) generadas para los próximos 7 días en varias franjas.
-- booked_count es demo (sin reservas reales); la RPC sigue mandando.
insert into public.classes (id, studio_id, name, type, default_capacity, duration_min, instructor_name) values
  ('c2222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Mat','mat',10,50,'Meli');

insert into public.class_occurrences (studio_id, class_id, starts_at, ends_at, capacity, booked_count, status)
select '11111111-1111-1111-1111-111111111111', s.class_id,
       t.ts, t.ts + make_interval(mins => s.dur), s.cap, least(s.fill, s.cap), 'scheduled'
from generate_series(0, 6) as g(d)
cross join (values
  ('c1111111-0000-0000-0000-000000000001'::uuid,  9, 60,  8, 2),  -- Reformer 09:00 → Disponible
  ('c2222222-0000-0000-0000-000000000001'::uuid, 11, 50, 10, 9),  -- Mat 11:00 → Últimos lugares
  ('c1111111-0000-0000-0000-000000000001'::uuid, 17, 60,  6, 6),  -- Reformer 17:00 → Lleno
  ('c2222222-0000-0000-0000-000000000001'::uuid, 20, 50, 12, 4)   -- Mat 20:00 → Disponible
) as s(class_id, hr, dur, cap, fill)
cross join lateral (
  select (date_trunc('day', timezone('America/Argentina/Buenos_Aires', now()))
          + make_interval(days => g.d, hours => s.hr)) at time zone 'America/Argentina/Buenos_Aires' as ts
) t
on conflict (class_id, starts_at) do nothing;

-- =============================================================================
-- Validaciones sugeridas (correr como cada usuario tras el seed):
--  1) Sofía reserve_class(occ#1)  → OK, descuenta 1 crédito (queda 7).
--  2) Lucía reserve_class(occ#1)  → OK, cubre membresía (no descuenta). occ#1 llena (2/2).
--  3) Marco join_waitlist(occ#1)  → OK (clase llena), position=1.
--  4) Sofía cancel_reservation(su reserva de occ#1) dentro de ventana → refund +1 (vuelve a 8).
--  5) Marco cancel_reservation(60000000-...-09) → SIN refund (pack vencido) — saldo sigue -1.
--  6) Admin B (estudio 2) NO debe poder leer/operar filas del estudio Reforma.
-- =============================================================================

-- =============================================================================
-- Fase 1J — demo enriquecido: nombres reales + alumnos + ingresos vivos.
-- Renombra los perfiles placeholder y suma 8 alumnos con estados financieros
-- variados + pagos del mes + histórico (6 meses) para el dashboard.
-- =============================================================================
update public.profiles set full_name='Valentina Ríos'  where id='a0000000-0000-0000-0000-000000000001';
update public.profiles set full_name='Sofía Castro'    where id='a0000000-0000-0000-0000-000000000002';
update public.profiles set full_name='Lucía Ferreyra'  where id='a0000000-0000-0000-0000-000000000003';
update public.profiles set full_name='Mateo Duarte'    where id='a0000000-0000-0000-0000-000000000004';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('a0000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000000','authenticated','authenticated','camila@reforma.test',   crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Camila Herrera","phone":"+54 9 11 5234-1190"}'),
 ('a0000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000000','authenticated','authenticated','joaquin@reforma.test',  crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Joaquín Vidal","phone":"+54 9 11 6781-2204"}'),
 ('a0000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000000','authenticated','authenticated','martina@reforma.test',  crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Martina Acosta","phone":"+54 9 11 4490-7781"}'),
 ('a0000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000000','authenticated','authenticated','renata@reforma.test',   crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Renata Sosa","phone":"+54 9 11 3012-5567"}'),
 ('a0000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tomas@reforma.test',    crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Tomás Aguirre","phone":"+54 9 11 7723-0098"}'),
 ('a0000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000000','authenticated','authenticated','florencia@reforma.test', crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Florencia Ledesma","phone":"+54 9 11 2245-8830"}'),
 ('a0000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000000','authenticated','authenticated','benjamin@reforma.test',  crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Benjamín Rey","phone":"+54 9 11 8890-3345"}'),
 ('a0000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000000','authenticated','authenticated','paula@reforma.test',     crypt('password123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Paula Giménez","phone":"+54 9 11 5567-1123"}')
on conflict (id) do nothing;

update auth.users set
  confirmation_token='', recovery_token='', email_change='', email_change_token_new='',
  email_change_token_current='', phone_change='', phone_change_token='',
  reauthentication_token='', email_change_confirm_status=0
where email like '%@reforma.test';

insert into public.members (id, studio_id, profile_id, role) values
 ('d1111111-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000010','client'),
 ('d1111111-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000011','client'),
 ('d1111111-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000012','client'),
 ('d1111111-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000013','client'),
 ('d1111111-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000014','client'),
 ('d1111111-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000015','client'),
 ('d1111111-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000016','client'),
 ('d1111111-0000-0000-0000-000000000017','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000017','client')
on conflict (id) do nothing;

-- Camila: pack 6/8 · Martina: pack 3/8 · Florencia: pack 8/8 · Tomás: suelta 1 · Joaquín/Benjamín: membresía · Paula: vencida · Renata: deuda
insert into public.payments (id, studio_id, member_id, amount, concept, method, status, recorded_by) values
 ('71000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000010',32000,'pack','transfer','confirmed','d1111111-0000-0000-0000-000000000001'),
 ('71000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000012',32000,'pack','cash','confirmed','d1111111-0000-0000-0000-000000000001'),
 ('71000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000015',32000,'pack','card_manual','confirmed','d1111111-0000-0000-0000-000000000001'),
 ('71000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000014',4500,'drop_in','cash','confirmed','d1111111-0000-0000-0000-000000000001'),
 ('71000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000011',26000,'membership','transfer','confirmed','d1111111-0000-0000-0000-000000000001'),
 ('71000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000016',26000,'membership','transfer','confirmed','d1111111-0000-0000-0000-000000000001');
insert into public.member_passes (id, studio_id, member_id, pass_id, credits_total, expires_at, source_payment_id) values
 ('81000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000010','a1111111-0000-0000-0000-000000000001',8, now()+interval '26 day','71000000-0000-0000-0000-000000000010'),
 ('81000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000012','a1111111-0000-0000-0000-000000000001',8, now()+interval '18 day','71000000-0000-0000-0000-000000000012'),
 ('81000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000015','a1111111-0000-0000-0000-000000000001',8, now()+interval '29 day','71000000-0000-0000-0000-000000000015'),
 ('81000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000014',null,1, now()+interval '30 day','71000000-0000-0000-0000-000000000014');
insert into public.credit_ledger (studio_id, member_id, member_pass_id, delta, reason) values
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000010','81000000-0000-0000-0000-000000000010',8,'purchase'),
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000010','81000000-0000-0000-0000-000000000010',-2,'booking'),
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000012','81000000-0000-0000-0000-000000000012',8,'purchase'),
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000012','81000000-0000-0000-0000-000000000012',-5,'booking'),
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000015','81000000-0000-0000-0000-000000000015',8,'purchase'),
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000014','81000000-0000-0000-0000-000000000014',1,'purchase');
insert into public.memberships (studio_id, member_id, type, valid_from, valid_to, status, source_payment_id) values
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000011','mensual', now()::date,(now()+interval '24 day')::date,'active','71000000-0000-0000-0000-000000000011'),
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000016','mensual', now()::date,(now()+interval '9 day')::date,'active','71000000-0000-0000-0000-000000000016');
insert into public.memberships (studio_id, member_id, type, valid_from, valid_to, status) values
 ('11111111-1111-1111-1111-111111111111','d1111111-0000-0000-0000-000000000017','mensual',(now()-interval '40 day')::date,(now()-interval '10 day')::date,'active');

-- Histórico de ingresos (sparkline, últimos 5 meses, tendencia creciente)
insert into public.payments (studio_id, member_id, amount, concept, method, status, recorded_by, paid_at)
select '11111111-1111-1111-1111-111111111111',
       (array['d1111111-0000-0000-0000-000000000002','d1111111-0000-0000-0000-000000000010',
              'd1111111-0000-0000-0000-000000000012','d1111111-0000-0000-0000-000000000015',
              'd1111111-0000-0000-0000-000000000011']::uuid[])[1 + (g % 5)],
       (array[32000,26000,32000,4500,32000])[1 + (g % 5)],
       (array['pack','membership','pack','drop_in','pack'])[1 + (g % 5)],
       'transfer','confirmed','d1111111-0000-0000-0000-000000000001',
       date_trunc('month', now()) - (mo || ' month')::interval + ((g+2) || ' day')::interval
from generate_series(1,5) as mo
cross join generate_series(1, 3 + ((6-mo)*2)) as g;

-- Fin seed.sql
