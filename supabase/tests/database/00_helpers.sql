-- Tiny assertion toolkit (no pgTAP dependency). Loaded before every test file.
create schema if not exists tests;
grant usage on schema tests to authenticated, anon, service_role;

create or replace function tests.create_user(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  insert into auth.users (email) values (p_email) returning id into uid;
  return uid;
end $$;

-- Switch the current transaction to a signed-in player.
create or replace function tests.authenticate_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.authenticate_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create or replace function tests.as_service() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
end $$;

create or replace function tests.reset_role() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function tests.ok(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAILED: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

create or replace function tests.eq(p_got anyelement, p_want anyelement, p_msg text) returns void
language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'FAILED: % (got %, want %)', p_msg, p_got, p_want;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Runs p_sql and expects an error whose message or SQLSTATE matches p_expected.
create or replace function tests.throws(p_sql text, p_expected text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_expected || '%' or sqlstate = p_expected then
      raise notice 'ok - %', p_msg;
      return;
    end if;
    raise exception 'FAILED: % (unexpected error % %)', p_msg, sqlstate, sqlerrm;
  end;
  raise exception 'FAILED: % (no error raised)', p_msg;
end $$;

-- Runs p_sql and returns the affected/returned row count (used to prove RLS hides rows).
create or replace function tests.count_rows(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) q', p_sql) into n;
  return n;
end $$;

grant execute on all functions in schema tests to authenticated, anon, service_role;
