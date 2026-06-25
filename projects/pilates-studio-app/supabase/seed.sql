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
  ('d2222222-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','admin');

-- ---------- clase + recurrencia + ocurrencias ----------
insert into public.classes (id, studio_id, name, type, default_capacity, duration_min, instructor_name) values
  ('c1111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Reformer','reformer',8,60,'Caro');

insert into public.class_schedules (id, studio_id, class_id, weekday, start_time, capacity, valid_from) values
  ('51111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c1111111-0000-0000-0000-000000000001',
   extract(dow from (now()+interval '2 day'))::int, '08:00', 8, now()::date);

-- Ocurrencia FUTURA con cupo chico (capacity=2) para probar lleno→waitlist y cancelación.
insert into public.class_occurrences (id, studio_id, class_id, schedule_id, starts_at, ends_at, capacity, booked_count, status) values
  ('01111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c1111111-0000-0000-0000-000000000001',
   '51111111-0000-0000-0000-000000000001', now()+interval '2 day', now()+interval '2 day'+interval '60 min', 2, 0, 'scheduled'),
-- Ocurrencia futura cupo normal.
  ('01111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','c1111111-0000-0000-0000-000000000001',
   '51111111-0000-0000-0000-000000000001', now()+interval '3 day', now()+interval '3 day'+interval '60 min', 8, 0, 'scheduled');

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

-- ---------- Código de alta demo para Estudio Reforma (Fase 1D-1B) ----------
-- Texto plano: REFORMA-DEMO  ·  se guarda SOLO el hash (sha256 del código normalizado).
insert into public.studio_join_codes (studio_id, code_hash, label, is_active, max_uses) values
  ('11111111-1111-1111-1111-111111111111',
   encode(digest('REFORMA-DEMO','sha256'),'hex'), 'Código demo', true, null);

-- =============================================================================
-- Validaciones sugeridas (correr como cada usuario tras el seed):
--  1) Sofía reserve_class(occ#1)  → OK, descuenta 1 crédito (queda 7).
--  2) Lucía reserve_class(occ#1)  → OK, cubre membresía (no descuenta). occ#1 llena (2/2).
--  3) Marco join_waitlist(occ#1)  → OK (clase llena), position=1.
--  4) Sofía cancel_reservation(su reserva de occ#1) dentro de ventana → refund +1 (vuelve a 8).
--  5) Marco cancel_reservation(60000000-...-09) → SIN refund (pack vencido) — saldo sigue -1.
--  6) Admin B (estudio 2) NO debe poder leer/operar filas del estudio Reforma.
-- =============================================================================

-- Fin seed.sql
