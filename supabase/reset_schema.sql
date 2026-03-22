-- MindPulse app schema reset (destructive)
-- Use this only when public schema drift is severe, for example:
-- - public.users was copied from auth.users
-- - public.users includes auth-only columns such as password_hash
-- - running schema.sql fails with NOT NULL violations on auth columns
--
-- This script drops app tables in public schema, but does NOT touch auth.users.
-- After running this file, run supabase/schema.sql.

begin;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
drop trigger if exists set_users_updated_at on public.users;
drop function if exists public.set_updated_at();

drop table if exists public.interventions;
drop table if exists public.predictions_log;
drop table if exists public.biometric_windows;
drop table if exists public.user_settings;
drop table if exists public.profiles;
drop table if exists public.users;

commit;
