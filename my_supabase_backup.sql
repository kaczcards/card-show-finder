--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

    return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;
end;
$_$;


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- Name: debug_wkb_coordinates(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.debug_wkb_coordinates(wkb_hex text) RETURNS TABLE(input_hex text, latitude double precision, longitude double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wkb_hex AS input_hex,
    public.ST_Y_Float8(ST_GeomFromEWKB(decode(wkb_hex, 'hex'))::geography) AS latitude,
    public.ST_X_Float8(ST_GeomFromEWKB(decode(wkb_hex, 'hex'))::geography) AS longitude;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY
  SELECT 
    wkb_hex AS input_hex,
    NULL::double precision AS latitude,
    NULL::double precision AS longitude;
END;
$$;


ALTER FUNCTION public.debug_wkb_coordinates(wkb_hex text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: shows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shows (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    location text NOT NULL,
    address text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    entry_fee numeric(10,2),
    description text,
    image_url text,
    rating numeric(2,1),
    coordinates public.geography(Point,4326),
    status text DEFAULT 'ACTIVE'::text,
    organizer_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    features jsonb DEFAULT '{}'::jsonb,
    categories text[] DEFAULT '{}'::text[]
);


ALTER TABLE public.shows OWNER TO postgres;

--
-- Name: find_filtered_shows(double precision, double precision, double precision, timestamp with time zone, timestamp with time zone, numeric, text[], text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.find_filtered_shows(center_lat double precision, center_lng double precision, radius_miles double precision, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, max_entry_fee numeric DEFAULT NULL::numeric, show_categories text[] DEFAULT NULL::text[], show_features text[] DEFAULT NULL::text[]) RETURNS SETOF public.shows
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT *
  FROM public.shows
  WHERE 
    -- Spatial filter
    ST_DWithin(
      coordinates::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_miles * 1609.34  -- Convert miles to meters
    )
    -- Status filter - only active shows
    AND status = 'ACTIVE'
    -- Date filters
    AND (start_date IS NULL OR shows.start_date >= start_date)
    AND (end_date IS NULL OR shows.end_date <= end_date)
    -- Entry fee filter
    AND (max_entry_fee IS NULL OR entry_fee <= max_entry_fee)
    -- Category filter
    AND (show_categories IS NULL OR shows.categories && show_categories)
    -- Features filter - this is more complex as features are stored as JSONB
    AND (
      show_features IS NULL 
      OR (
        CASE WHEN array_length(show_features, 1) > 0 THEN
          -- Check if all requested features exist in the show's features
          (SELECT bool_and(shows.features->feature = 'true')
           FROM unnest(show_features) AS feature)
        ELSE true
        END
      )
    )
  ORDER BY 
    ST_Distance(
      coordinates::geography, 
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) ASC;  -- Order by distance (closest first)
$$;


ALTER FUNCTION public.find_filtered_shows(center_lat double precision, center_lng double precision, radius_miles double precision, start_date timestamp with time zone, end_date timestamp with time zone, max_entry_fee numeric, show_categories text[], show_features text[]) OWNER TO postgres;

--
-- Name: FUNCTION find_filtered_shows(center_lat double precision, center_lng double precision, radius_miles double precision, start_date timestamp with time zone, end_date timestamp with time zone, max_entry_fee numeric, show_categories text[], show_features text[]); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.find_filtered_shows(center_lat double precision, center_lng double precision, radius_miles double precision, start_date timestamp with time zone, end_date timestamp with time zone, max_entry_fee numeric, show_categories text[], show_features text[]) IS 'Finds shows within a specified radius with additional filtering options.
Parameters:
  center_lat - Latitude of the center point
  center_lng - Longitude of the center point
  radius_miles - Radius in miles
  start_date - Optional minimum start date
  end_date - Optional maximum end date
  max_entry_fee - Optional maximum entry fee
  show_categories - Optional array of categories to filter by
  show_features - Optional array of features to filter by
Returns:
  All columns from the shows table for shows matching the filters,
  ordered by distance (closest first).';


--
-- Name: find_shows_with_coordinates(double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.find_shows_with_coordinates(lat double precision, lng double precision, radius_miles double precision) RETURNS TABLE(id uuid, title text, location text, address text, start_date timestamp with time zone, end_date timestamp with time zone, entry_fee numeric, description text, image_url text, rating numeric, coordinates public.geography, status text, organizer_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, features jsonb, categories text[], latitude double precision, longitude double precision, distance_miles double precision)
    LANGUAGE sql STABLE
    AS $$
  SELECT 
    s.*,
    -- Extract latitude from the geography point
    public.ST_Y_Float8(s.coordinates) AS latitude,
    -- Extract longitude from the geography point
    public.ST_X_Float8(s.coordinates) AS longitude,
    -- Calculate the distance in miles (convert meters to miles)
    ST_Distance(
      s.coordinates,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1609.34 AS distance_miles
  FROM 
    public.shows s
  WHERE 
    -- Find shows within the specified radius
    ST_DWithin(
      s.coordinates,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_miles * 1609.34 -- Convert miles to meters for ST_DWithin
    )
  ORDER BY 
    distance_miles ASC;
$$;


ALTER FUNCTION public.find_shows_with_coordinates(lat double precision, lng double precision, radius_miles double precision) OWNER TO postgres;

--
-- Name: find_shows_within_radius(double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.find_shows_within_radius(center_lat double precision, center_lng double precision, radius_miles double precision) RETURNS SETOF public.shows
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT *
  FROM public.shows
  WHERE ST_DWithin(
    coordinates::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_miles * 1609.34  -- Convert miles to meters
  )
  AND status = 'ACTIVE'  -- Only return active shows by default
  ORDER BY 
    ST_Distance(
      coordinates::geography, 
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) ASC;  -- Order by distance (closest first)
$$;


ALTER FUNCTION public.find_shows_within_radius(center_lat double precision, center_lng double precision, radius_miles double precision) OWNER TO postgres;

--
-- Name: FUNCTION find_shows_within_radius(center_lat double precision, center_lng double precision, radius_miles double precision); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.find_shows_within_radius(center_lat double precision, center_lng double precision, radius_miles double precision) IS 'Finds shows within a specified radius (in miles) from a center point.
Parameters:
  center_lat - Latitude of the center point
  center_lng - Longitude of the center point
  radius_miles - Radius in miles
Returns:
  All columns from the shows table for shows within the specified radius,
  ordered by distance (closest first).';


--
-- Name: get_all_shows_with_coordinates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_all_shows_with_coordinates() RETURNS TABLE(id uuid, title text, location text, address text, start_date timestamp with time zone, end_date timestamp with time zone, entry_fee numeric, description text, image_url text, rating numeric, coordinates public.geography, status text, organizer_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, features jsonb, categories text[], latitude double precision, longitude double precision)
    LANGUAGE sql STABLE
    AS $$
  SELECT 
    s.*,
    -- Extract latitude from the geography point
    public.ST_Y_Float8(s.coordinates) AS latitude,
    -- Extract longitude from the geography point
    public.ST_X_Float8(s.coordinates) AS longitude
  FROM 
    public.shows s
  WHERE
    s.coordinates IS NOT NULL
  ORDER BY 
    s.start_date ASC;
$$;


ALTER FUNCTION public.get_all_shows_with_coordinates() OWNER TO postgres;

--
-- Name: get_show_with_coordinates(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_show_with_coordinates(show_id uuid) RETURNS TABLE(id uuid, title text, location text, address text, start_date timestamp with time zone, end_date timestamp with time zone, entry_fee numeric, description text, image_url text, rating numeric, coordinates public.geography, status text, organizer_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, features jsonb, categories text[], latitude double precision, longitude double precision)
    LANGUAGE sql STABLE
    AS $$
  SELECT 
    s.*,
    -- Extract latitude from the geography point
    public.ST_Y_Float8(s.coordinates) AS latitude,
    -- Extract longitude from the geography point
    public.ST_X_Float8(s.coordinates) AS longitude
  FROM 
    public.shows s
  WHERE
    s.id = show_id;
$$;


ALTER FUNCTION public.get_show_with_coordinates(show_id uuid) OWNER TO postgres;

--
-- Name: handle_dealer_profile_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_dealer_profile_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_dealer_profile_updated_at() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'firstName', ''),
    coalesce(new.raw_user_meta_data->>'lastName', '')
  );
  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: st_x_float8(public.geography); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.st_x_float8(public.geography) RETURNS double precision
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  -- Extract the X coordinate (longitude) from a geography point
  SELECT ST_X(ST_GeomFromEWKB($1::bytea)::geometry)::float8;
$_$;


ALTER FUNCTION public.st_x_float8(public.geography) OWNER TO postgres;

--
-- Name: st_y_float8(public.geography); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.st_y_float8(public.geography) RETURNS double precision
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  -- Extract the Y coordinate (latitude) from a geography point
  SELECT ST_Y(ST_GeomFromEWKB($1::bytea)::geometry)::float8;
$_$;


ALTER FUNCTION public.st_y_float8(public.geography) OWNER TO postgres;

--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  BEGIN
    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (payload, event, topic, private, extension)
    VALUES (payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      PERFORM pg_notify(
          'realtime:system',
          jsonb_build_object(
              'error', SQLERRM,
              'function', 'realtime.send',
              'event', event,
              'topic', topic,
              'private', private
          )::text
      );
  END;
END;
$$;


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text) OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
  v_order_by text;
  v_sort_order text;
begin
  case
    when sortcolumn = 'name' then
      v_order_by = 'name';
    when sortcolumn = 'updated_at' then
      v_order_by = 'updated_at';
    when sortcolumn = 'created_at' then
      v_order_by = 'created_at';
    when sortcolumn = 'last_accessed_at' then
      v_order_by = 'last_accessed_at';
    else
      v_order_by = 'name';
  end case;

  case
    when sortorder = 'asc' then
      v_sort_order = 'asc';
    when sortorder = 'desc' then
      v_sort_order = 'desc';
    else
      v_sort_order = 'asc';
  end case;

  v_order_by = v_order_by || ' ' || v_sort_order;

  return query execute
    'with folders as (
       select path_tokens[$1] as folder
       from storage.objects
         where objects.name ilike $2 || $3 || ''%''
           and bucket_id = $4
           and array_length(objects.path_tokens, 1) <> $1
       group by folder
       order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: card_shows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.card_shows (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    location text NOT NULL,
    address text NOT NULL,
    dates daterange NOT NULL,
    times text,
    entryfee integer,
    description text,
    image text,
    features text[],
    promoter_id uuid,
    coordinate public.geography(Point,4326),
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.card_shows OWNER TO postgres;

--
-- Name: dealer_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dealer_profiles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    business_name text NOT NULL,
    description text,
    website_url text,
    instagram_url text,
    twitter_url text,
    facebook_url text,
    business_email text,
    business_phone text,
    categories text[] DEFAULT '{}'::text[],
    other_categories text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.dealer_profiles OWNER TO postgres;

--
-- Name: TABLE dealer_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dealer_profiles IS 'Stores business information for dealers and show organizers';


--
-- Name: COLUMN dealer_profiles.business_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dealer_profiles.business_name IS 'Name of the dealer''s business or store';


--
-- Name: COLUMN dealer_profiles.categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dealer_profiles.categories IS 'Array of card categories the dealer specializes in';


--
-- Name: COLUMN dealer_profiles.other_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dealer_profiles.other_categories IS 'Additional categories not covered by the predefined list';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    home_zip_code text,
    role text DEFAULT 'ATTENDEE'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    favorite_shows text[] DEFAULT '{}'::text[],
    attended_shows text[] DEFAULT '{}'::text[],
    account_type character varying(20) DEFAULT 'collector'::character varying NOT NULL,
    subscription_status character varying(20) DEFAULT 'none'::character varying NOT NULL,
    subscription_expiry timestamp with time zone,
    subscription_type text DEFAULT 'none'::text,
    subscription_id text,
    CONSTRAINT profiles_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['collector'::character varying, 'dealer'::character varying, 'organizer'::character varying])::text[]))),
    CONSTRAINT profiles_subscription_status_check CHECK (((subscription_status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'none'::character varying])::text[])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.account_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.account_type IS 'Type of user account: collector (free), dealer or organizer (paid)';


--
-- Name: COLUMN profiles.subscription_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.subscription_status IS 'Status of user subscription: active, expired, or none (for free accounts)';


--
-- Name: COLUMN profiles.subscription_expiry; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.subscription_expiry IS 'Date and time when the subscription expires (null for free accounts)';


--
-- Name: shared_want_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shared_want_lists (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    userid uuid NOT NULL,
    showid uuid NOT NULL,
    wantlistid uuid NOT NULL,
    sharedat timestamp with time zone DEFAULT now()
);


ALTER TABLE public.shared_want_lists OWNER TO postgres;

--
-- Name: show_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.show_participants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    userid uuid NOT NULL,
    showid uuid NOT NULL,
    createdat timestamp with time zone DEFAULT now()
);


ALTER TABLE public.show_participants OWNER TO postgres;

--
-- Name: user_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_cards (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    userid uuid NOT NULL,
    imageurl text NOT NULL,
    title text,
    description text,
    category text,
    iscompressed boolean DEFAULT false,
    createdat timestamp with time zone DEFAULT now(),
    updatedat timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_cards OWNER TO postgres;

--
-- Name: want_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.want_lists (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    userid uuid NOT NULL,
    content text NOT NULL,
    createdat timestamp with time zone DEFAULT now(),
    updatedat timestamp with time zone DEFAULT now()
);


ALTER TABLE public.want_lists OWNER TO postgres;

--
-- Name: zip_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zip_codes (
    zip_code text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    latitude numeric NOT NULL,
    longitude numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.zip_codes OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE realtime.subscription OWNER TO supabase_admin;

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text
);


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
00000000-0000-0000-0000-000000000000	b95812b9-f4dc-443b-bcb3-a1943d6127e8	{"action":"user_confirmation_requested","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-06-18 02:19:54.233335+00	
00000000-0000-0000-0000-000000000000	ba54b2ad-a474-4d18-9bd3-72dc37887ad4	{"action":"user_confirmation_requested","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-06-18 02:39:23.016445+00	
00000000-0000-0000-0000-000000000000	157104ed-a1fa-4217-9e74-671e92d85627	{"action":"user_confirmation_requested","actor_id":"1105b1af-dd4e-4207-8aa7-8d79c7f6928e","actor_username":"kaczcards1@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-06-18 03:16:55.498983+00	
00000000-0000-0000-0000-000000000000	99370468-be41-4e93-a228-3345342a904c	{"action":"user_confirmation_requested","actor_id":"ee66b6a2-134f-4da5-a400-d19c6e67519d","actor_username":"kaczcards2@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-06-18 03:25:45.542306+00	
00000000-0000-0000-0000-000000000000	c53e956c-57e1-46fc-9b75-652b13ea5594	{"action":"user_signedup","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"team"}	2025-06-18 14:38:30.251063+00	
00000000-0000-0000-0000-000000000000	1194b8b3-df26-4514-a2ea-6f8b1b71549d	{"action":"user_repeated_signup","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-06-18 14:40:43.069292+00	
00000000-0000-0000-0000-000000000000	2a6d9cb7-249e-4c6b-8491-6b541a4d8537	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-18 15:54:10.669746+00	
00000000-0000-0000-0000-000000000000	e2e65bd5-ac37-4d76-9137-e86a5e62961a	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-18 15:54:40.783875+00	
00000000-0000-0000-0000-000000000000	634675d6-af57-4f10-a6ca-3c22ee905b0a	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-18 16:43:36.745362+00	
00000000-0000-0000-0000-000000000000	cc4fdbd8-9d6c-4438-9e80-89c258aff317	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 16:54:09.012533+00	
00000000-0000-0000-0000-000000000000	e1e7eccc-336f-4dce-bc84-828b42fa55c0	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 16:54:09.014645+00	
00000000-0000-0000-0000-000000000000	e192f00d-8f6b-4559-93db-8bc9a5695463	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-18 17:35:57.486405+00	
00000000-0000-0000-0000-000000000000	344b01f1-6db2-444c-b312-b5d42190b663	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 17:56:08.542445+00	
00000000-0000-0000-0000-000000000000	7a10b9d9-0684-4776-881e-c0e5200356d9	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 17:56:08.543897+00	
00000000-0000-0000-0000-000000000000	8ce1e6b0-7b41-4a57-bee0-f6dda3e370f6	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 19:12:37.320293+00	
00000000-0000-0000-0000-000000000000	04e5225f-ba6c-4435-8a60-a4b08ee9c744	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 19:12:37.321638+00	
00000000-0000-0000-0000-000000000000	9fc41946-62cd-445f-a32d-221cb1b81dbe	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-18 19:37:51.875746+00	
00000000-0000-0000-0000-000000000000	ad147389-7390-4ce3-b51b-5f1c22b9a381	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 20:13:07.995016+00	
00000000-0000-0000-0000-000000000000	617c535b-fd38-48c3-933e-fff648e84959	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 20:13:07.996335+00	
00000000-0000-0000-0000-000000000000	0728c325-504a-4296-a5f9-5e8898c1a4e8	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 21:11:16.80448+00	
00000000-0000-0000-0000-000000000000	39ba7090-1003-4c9d-a1e6-e0292b0d06ff	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-18 21:11:16.805249+00	
00000000-0000-0000-0000-000000000000	a37c1b93-9cdb-4a8d-845d-a819aab2e2a8	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-18 21:11:43.091236+00	
00000000-0000-0000-0000-000000000000	ee59bf6c-d3df-47b7-9c96-ae2e93fe106f	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-19 00:06:57.092906+00	
00000000-0000-0000-0000-000000000000	337b3bc0-71c4-4721-a036-b3948c8488e8	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-19 00:06:57.094275+00	
00000000-0000-0000-0000-000000000000	22598de5-90a6-4278-bb82-affaceab1fe0	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-19 00:07:10.008066+00	
00000000-0000-0000-0000-000000000000	9d54f59e-2b58-4b37-8ace-57584da50949	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-19 01:13:04.844859+00	
00000000-0000-0000-0000-000000000000	40fae9ea-aa93-4563-b30b-4027746b5b1f	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-19 01:13:04.84693+00	
00000000-0000-0000-0000-000000000000	2e9e095e-cd36-4aaf-8631-3d57d88398c7	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-19 22:11:08.664214+00	
00000000-0000-0000-0000-000000000000	b25d8284-f2de-4ee4-a8e4-ce248994a04d	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-19 22:50:34.611807+00	
00000000-0000-0000-0000-000000000000	35983580-a08c-4045-a589-3716354d3b0c	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-19 23:14:55.275483+00	
00000000-0000-0000-0000-000000000000	bda62f99-7376-4c0f-8cd8-541c3f0d3dfb	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-19 23:15:08.076821+00	
00000000-0000-0000-0000-000000000000	4280a23a-d824-4895-90ef-1144a372ffce	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-19 23:50:19.853893+00	
00000000-0000-0000-0000-000000000000	0d56679e-bbbd-4a58-ba87-458208718f55	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-20 00:27:07.19657+00	
00000000-0000-0000-0000-000000000000	fde7b349-85a6-40a9-af95-cbf9797918ae	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-20 14:29:07.242267+00	
00000000-0000-0000-0000-000000000000	a697ed8f-8965-4fea-9c9e-80f460248689	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-20 14:29:07.247079+00	
00000000-0000-0000-0000-000000000000	b1f038d7-dab6-4664-b3a0-fd4b812fecbd	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-20 16:15:42.212862+00	
00000000-0000-0000-0000-000000000000	dcca5c71-8436-4dce-9fab-0476b0ca432c	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-20 16:15:42.214276+00	
00000000-0000-0000-0000-000000000000	0bcfcc27-b0c4-49cb-9a9f-a464b6d09967	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-20 17:13:44.329017+00	
00000000-0000-0000-0000-000000000000	672db025-d1ae-412c-8234-3440a4946c80	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-20 17:13:44.332873+00	
00000000-0000-0000-0000-000000000000	766f509d-9fda-47a9-9e41-d64b5d83e70f	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-20 17:51:43.134672+00	
00000000-0000-0000-0000-000000000000	33e84d79-e6ad-4acf-bd28-6eba8d951c88	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-20 19:00:21.572677+00	
00000000-0000-0000-0000-000000000000	c50fd6f1-687c-4e0c-97a1-0214e5154e64	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-20 19:22:27.757358+00	
00000000-0000-0000-0000-000000000000	9f7c89ad-1f9f-4d59-8c42-b0f528461d7a	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-20 21:27:02.591078+00	
00000000-0000-0000-0000-000000000000	43c38a46-aeb0-48b9-8804-d2d73016017b	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-20 21:27:02.591956+00	
00000000-0000-0000-0000-000000000000	e38c23c6-488e-44b3-a2e0-83b017a869b5	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-20 22:02:12.374901+00	
00000000-0000-0000-0000-000000000000	34cd4728-32df-47ff-b09a-37630b05dda1	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-20 22:20:11.826859+00	
00000000-0000-0000-0000-000000000000	4a33a1f1-9309-4084-aea0-bfb23ee5e27c	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-20 22:20:36.362456+00	
00000000-0000-0000-0000-000000000000	c487043c-66c9-418b-ac27-1ba822169e3d	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 13:47:36.785603+00	
00000000-0000-0000-0000-000000000000	bf3c06f0-c76c-42cd-abde-4ac41c784c43	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 13:47:36.794976+00	
00000000-0000-0000-0000-000000000000	229eab4f-c102-4e76-adc0-6468218e4767	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 14:45:36.716846+00	
00000000-0000-0000-0000-000000000000	dd278e85-400f-4b65-8c5b-99392d6859dc	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 14:45:36.719071+00	
00000000-0000-0000-0000-000000000000	b1419081-264e-4b73-b2c0-1d8aaa85abe5	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 16:29:20.041998+00	
00000000-0000-0000-0000-000000000000	8188bb03-db76-450f-b920-93900855424a	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 16:29:20.04647+00	
00000000-0000-0000-0000-000000000000	966f0aaa-7cfe-475d-91d4-b25ab2c90eb1	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 18:00:06.495976+00	
00000000-0000-0000-0000-000000000000	4cb85e7c-7736-4185-8e0e-3818493a1cb8	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 18:00:06.497952+00	
00000000-0000-0000-0000-000000000000	76ec0b54-25ef-4334-b0af-14f9be59b4c9	{"action":"logout","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 18:00:29.276848+00	
00000000-0000-0000-0000-000000000000	cf826bfe-9bc1-4c37-a2ec-5f052e1fa58e	{"action":"user_confirmation_requested","actor_id":"337c135e-2839-4bca-8a47-9f0f30fe692d","actor_username":"kaczcards@yahoo.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-06-23 18:01:08.921727+00	
00000000-0000-0000-0000-000000000000	4220c8eb-2f4b-4472-bc38-7bf303b8cbab	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 18:02:54.463607+00	
00000000-0000-0000-0000-000000000000	5d2d1da3-779f-4c8e-89fb-b20497bf2dd8	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 19:16:12.210429+00	
00000000-0000-0000-0000-000000000000	7b51f8ca-c48d-4e4a-927b-b2de61bd7feb	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 19:16:12.21395+00	
00000000-0000-0000-0000-000000000000	c5434c32-0c88-47b6-8e4a-de36049cce84	{"action":"logout","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 19:17:07.836315+00	
00000000-0000-0000-0000-000000000000	16b8437a-7075-43f2-ae0a-f5a22e11f41e	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 19:17:20.033113+00	
00000000-0000-0000-0000-000000000000	936a760a-9b57-44ed-bdf3-944cf972a734	{"action":"token_refreshed","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 20:15:42.303066+00	
00000000-0000-0000-0000-000000000000	b99dabfc-228b-4ac5-a691-0981f1600aa8	{"action":"token_revoked","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-23 20:15:42.304768+00	
00000000-0000-0000-0000-000000000000	35fe06cd-55cb-459c-9240-3f5e377f91d3	{"action":"logout","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 20:59:54.081227+00	
00000000-0000-0000-0000-000000000000	13792318-260c-45bc-852f-ad4526f7c7ba	{"action":"login","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 21:00:05.328066+00	
00000000-0000-0000-0000-000000000000	38de12ec-db8b-49d5-9e92-9c3c8949e4b3	{"action":"user_modified","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-23 21:00:27.755594+00	
00000000-0000-0000-0000-000000000000	aa28150d-2b94-4d8b-a721-69800a592227	{"action":"logout","actor_id":"84ec4c75-1c32-46f6-b0bb-7930869a4c81","actor_username":"kaczcards@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 21:00:34.77593+00	
00000000-0000-0000-0000-000000000000	351e1d5a-9f31-4c7d-a817-90d49b0490ba	{"action":"user_confirmation_requested","actor_id":"8c07a4af-5eb1-4012-a491-737a9343434e","actor_username":"kkacz76@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-06-23 21:03:49.790226+00	
00000000-0000-0000-0000-000000000000	fe661ac1-11fa-4df9-b945-8a501abddef3	{"action":"user_signedup","actor_id":"8c07a4af-5eb1-4012-a491-737a9343434e","actor_username":"kkacz76@gmail.com","actor_via_sso":false,"log_type":"team"}	2025-06-23 21:03:58.663735+00	
00000000-0000-0000-0000-000000000000	67e1bcd4-ef02-4034-ba0e-082539ff5f91	{"action":"login","actor_id":"8c07a4af-5eb1-4012-a491-737a9343434e","actor_username":"kkacz76@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 21:05:20.109302+00	
00000000-0000-0000-0000-000000000000	e811d112-af7b-4fdc-8445-845ec4a1b98f	{"action":"user_modified","actor_id":"8c07a4af-5eb1-4012-a491-737a9343434e","actor_username":"kkacz76@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-23 21:05:33.564006+00	
00000000-0000-0000-0000-000000000000	895cfc1f-47b7-46ce-a6fd-5fa4747ac967	{"action":"user_modified","actor_id":"8c07a4af-5eb1-4012-a491-737a9343434e","actor_username":"kkacz76@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-23 21:06:56.742773+00	
00000000-0000-0000-0000-000000000000	5869f0cd-75fb-491c-ba1b-7a41046480e6	{"action":"logout","actor_id":"8c07a4af-5eb1-4012-a491-737a9343434e","actor_username":"kkacz76@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 21:07:05.4666+00	
00000000-0000-0000-0000-000000000000	aab76e1f-acd8-4ba1-b1fd-e63d62a8a6ea	{"action":"login","actor_id":"8c07a4af-5eb1-4012-a491-737a9343434e","actor_username":"kkacz76@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 21:07:21.706937+00	
00000000-0000-0000-0000-000000000000	ad1dff3d-23f7-429c-9a0c-115f17fbc41e	{"action":"logout","actor_id":"8c07a4af-5eb1-4012-a491-737a9343434e","actor_username":"kkacz76@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 21:25:20.147484+00	
00000000-0000-0000-0000-000000000000	d84ec5f0-17bc-4a00-b805-387295980e0f	{"action":"user_confirmation_requested","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}	2025-06-23 21:26:24.710849+00	
00000000-0000-0000-0000-000000000000	d41014d1-d1ec-4d12-8ab4-cdcbb149ebcb	{"action":"user_signedup","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"team"}	2025-06-23 21:26:31.540508+00	
00000000-0000-0000-0000-000000000000	5f1ee57b-b248-404c-a845-9e5b62b29ac9	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 21:26:55.993533+00	
00000000-0000-0000-0000-000000000000	d73e2c58-84b8-4cc2-9be7-328ccb9dfbf8	{"action":"user_modified","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-23 21:27:07.236432+00	
00000000-0000-0000-0000-000000000000	fdbde58a-440f-4613-bdee-09433b2cf972	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 21:27:39.19752+00	
00000000-0000-0000-0000-000000000000	41f1707a-70a5-495d-a3ed-40f5988be511	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 21:27:53.460219+00	
00000000-0000-0000-0000-000000000000	0256033a-d09c-40df-b50f-87301ff142f9	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 21:29:04.941781+00	
00000000-0000-0000-0000-000000000000	887ba450-18ea-4408-b979-1a6f1078c4ca	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 21:29:18.319317+00	
00000000-0000-0000-0000-000000000000	cc447f86-3a1b-4629-b953-61bf1cf4c633	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 21:53:45.039021+00	
00000000-0000-0000-0000-000000000000	c8ed98ba-d38f-4cf6-af17-1e47dd9e3555	{"action":"user_modified","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-23 21:56:39.973749+00	
00000000-0000-0000-0000-000000000000	c1ed0618-6af1-4d7c-8bff-f38f3f801922	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-23 21:57:22.213361+00	
00000000-0000-0000-0000-000000000000	21ff9865-0d36-44a7-b600-78ca934e8f72	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-23 21:57:40.985593+00	
00000000-0000-0000-0000-000000000000	aaea5fbc-412f-43a4-93f8-aa703477c742	{"action":"user_modified","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-23 21:58:58.908788+00	
00000000-0000-0000-0000-000000000000	9359372e-94ea-4128-a7f0-4ba4e7b79e34	{"action":"token_refreshed","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 00:23:48.102552+00	
00000000-0000-0000-0000-000000000000	6b8dc61f-1479-4a29-8a6d-426928ac9686	{"action":"token_revoked","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 00:23:48.105571+00	
00000000-0000-0000-0000-000000000000	474a29f7-79fc-4d74-bbb0-72db3e0c43f7	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 00:25:02.946448+00	
00000000-0000-0000-0000-000000000000	2ea3790c-0b29-409f-af8a-46b40706dee3	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 00:25:21.913269+00	
00000000-0000-0000-0000-000000000000	38365360-24af-43e7-8bf2-a3f4b260cb26	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 00:41:24.278621+00	
00000000-0000-0000-0000-000000000000	3508441f-2c2c-4283-abd4-950b735dec4e	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 00:41:42.660323+00	
00000000-0000-0000-0000-000000000000	8698bdd6-708d-413e-ab48-5629f5462253	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 00:43:56.664922+00	
00000000-0000-0000-0000-000000000000	f18859f5-b27f-4376-8616-4cf5b419e0a5	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 00:52:09.946056+00	
00000000-0000-0000-0000-000000000000	4ac2d511-9c60-4e7f-bb33-641657fa64fd	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 00:52:26.997704+00	
00000000-0000-0000-0000-000000000000	70783fed-86bd-46dc-b3a6-dfb467f4cc25	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 00:58:43.588934+00	
00000000-0000-0000-0000-000000000000	3bdedaa1-aa58-405a-9069-5cdbd74fd9fa	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 00:58:56.831241+00	
00000000-0000-0000-0000-000000000000	a5d9cc60-a31b-4f84-ae7e-205b1f93d71b	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 00:59:36.403346+00	
00000000-0000-0000-0000-000000000000	6af29230-d780-4949-8cc8-6b5949f6d6e7	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 00:59:49.337418+00	
00000000-0000-0000-0000-000000000000	f01c3faf-a559-4440-bf81-27e9c626940e	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 01:04:04.724516+00	
00000000-0000-0000-0000-000000000000	f573a2c6-d4f4-4405-9ca5-2b7d9dc80bd5	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 01:04:12.827067+00	
00000000-0000-0000-0000-000000000000	2faefadc-1b9f-448d-92cf-c1530a283c11	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 01:04:27.462089+00	
00000000-0000-0000-0000-000000000000	a9ccf5d8-8219-4f31-ae62-3b2c8f6452b2	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 01:08:06.205755+00	
00000000-0000-0000-0000-000000000000	1f0b2597-2ac8-4d3b-a46a-080cd5bb308d	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 01:08:17.914304+00	
00000000-0000-0000-0000-000000000000	05f42b55-3154-476a-81fd-a88df3cdf122	{"action":"token_refreshed","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 13:50:38.924739+00	
00000000-0000-0000-0000-000000000000	27838e40-5ef9-42fc-ad17-5fa251607961	{"action":"token_revoked","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 13:50:38.937581+00	
00000000-0000-0000-0000-000000000000	5bdb4484-8b2f-41fc-8767-93ec653c9fc5	{"action":"user_modified","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"user"}	2025-06-24 14:17:17.218104+00	
00000000-0000-0000-0000-000000000000	021d8c40-4b48-471c-b092-310085bca61e	{"action":"token_refreshed","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 15:53:37.217485+00	
00000000-0000-0000-0000-000000000000	8f72fdcd-2d33-4f34-b5f4-aab5d8e2e7b0	{"action":"token_revoked","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 15:53:37.219462+00	
00000000-0000-0000-0000-000000000000	53b0774c-2d24-49c2-84b9-31fe74b2707a	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 15:53:43.602914+00	
00000000-0000-0000-0000-000000000000	874d4f42-d715-4613-a93c-a6d3538586de	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 15:53:56.73603+00	
00000000-0000-0000-0000-000000000000	24aa1ca9-f116-4852-b581-c6933460d284	{"action":"token_refreshed","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 16:52:07.398277+00	
00000000-0000-0000-0000-000000000000	8d2ecefe-2959-41aa-bb94-04672f98b606	{"action":"token_revoked","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 16:52:07.400454+00	
00000000-0000-0000-0000-000000000000	b17a6110-4720-49c4-b220-4d441d2efeea	{"action":"logout","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account"}	2025-06-24 17:28:47.93642+00	
00000000-0000-0000-0000-000000000000	0715fe7c-fdd0-42a4-869c-e523495b765c	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 17:29:00.711039+00	
00000000-0000-0000-0000-000000000000	e996ab69-60de-49b3-8759-08a363a51878	{"action":"token_refreshed","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 18:27:29.450062+00	
00000000-0000-0000-0000-000000000000	47504c52-4131-49d2-9c27-268eeab4b9af	{"action":"token_revoked","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 18:27:29.456334+00	
00000000-0000-0000-0000-000000000000	d0c6a734-fe2d-4b02-8203-656c61e0aae8	{"action":"login","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2025-06-24 20:38:42.051918+00	
00000000-0000-0000-0000-000000000000	956b083a-a1d0-44d2-b3e5-67afab2c62a6	{"action":"token_refreshed","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 21:39:58.799877+00	
00000000-0000-0000-0000-000000000000	a4078fd6-8992-4f95-adba-37b28b8091f3	{"action":"token_revoked","actor_id":"a3d8f808-1eaf-4f31-88ee-b93203d00176","actor_username":"salesstreamlinedai@gmail.com","actor_via_sso":false,"log_type":"token"}	2025-06-24 21:39:58.807318+00	
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at) FROM stdin;
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
1105b1af-dd4e-4207-8aa7-8d79c7f6928e	1105b1af-dd4e-4207-8aa7-8d79c7f6928e	{"sub": "1105b1af-dd4e-4207-8aa7-8d79c7f6928e", "email": "kaczcards1@gmail.com", "lastName": "", "firstName": "Kavin", "homeZipCode": "46060", "email_verified": false, "phone_verified": false}	email	2025-06-18 03:16:55.49651+00	2025-06-18 03:16:55.496555+00	2025-06-18 03:16:55.496555+00	99ddf719-ab8e-4329-b0c2-405b24177d45
ee66b6a2-134f-4da5-a400-d19c6e67519d	ee66b6a2-134f-4da5-a400-d19c6e67519d	{"sub": "ee66b6a2-134f-4da5-a400-d19c6e67519d", "email": "kaczcards2@gmail.com", "lastName": "", "firstName": "Kovin", "homeZipCode": "46060", "email_verified": false, "phone_verified": false}	email	2025-06-18 03:25:45.538081+00	2025-06-18 03:25:45.538126+00	2025-06-18 03:25:45.538126+00	e3de75ac-d3f6-4d05-9c45-9587499536ee
84ec4c75-1c32-46f6-b0bb-7930869a4c81	84ec4c75-1c32-46f6-b0bb-7930869a4c81	{"sub": "84ec4c75-1c32-46f6-b0bb-7930869a4c81", "email": "kaczcards@gmail.com", "lastName": "", "firstName": "Kevin", "homeZipCode": "46060", "email_verified": true, "phone_verified": false}	email	2025-06-18 02:19:54.225301+00	2025-06-18 02:19:54.225348+00	2025-06-18 02:19:54.225348+00	9c8fc717-6296-4b30-ac40-d4460507d22d
337c135e-2839-4bca-8a47-9f0f30fe692d	337c135e-2839-4bca-8a47-9f0f30fe692d	{"sub": "337c135e-2839-4bca-8a47-9f0f30fe692d", "email": "kaczcards@yahoo.com", "lastName": "", "firstName": "Kalvin", "homeZipCode": "46060", "email_verified": false, "phone_verified": false}	email	2025-06-23 18:01:08.917439+00	2025-06-23 18:01:08.917493+00	2025-06-23 18:01:08.917493+00	f2baacef-caf6-4548-a4af-f5afe14faab9
8c07a4af-5eb1-4012-a491-737a9343434e	8c07a4af-5eb1-4012-a491-737a9343434e	{"sub": "8c07a4af-5eb1-4012-a491-737a9343434e", "email": "kkacz76@gmail.com", "lastName": "", "firstName": "Kazman", "homeZipCode": "46060", "email_verified": true, "phone_verified": false}	email	2025-06-23 21:03:49.785893+00	2025-06-23 21:03:49.785958+00	2025-06-23 21:03:49.785958+00	9f45e3a1-8a7b-465e-aebc-d5d48cb73d01
a3d8f808-1eaf-4f31-88ee-b93203d00176	a3d8f808-1eaf-4f31-88ee-b93203d00176	{"sub": "a3d8f808-1eaf-4f31-88ee-b93203d00176", "email": "salesstreamlinedai@gmail.com", "lastName": "", "firstName": "JPK", "homeZipCode": "46060", "email_verified": true, "phone_verified": false}	email	2025-06-23 21:26:24.704888+00	2025-06-23 21:26:24.704934+00	2025-06-23 21:26:24.704934+00	f1b6e113-654b-4d0d-badd-dff257edee34
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
3751b3bb-0b99-43ce-b420-1b4062bbf0dc	2025-06-24 17:29:00.715949+00	2025-06-24 17:29:00.715949+00	password	60269d1a-a404-46b9-b5f1-fe54f6b1c9c9
8d3ce0b5-0ffc-42a8-9069-0428a31c3cdc	2025-06-24 20:38:42.070785+00	2025-06-24 20:38:42.070785+00	password	4a60c0c7-38c5-4bd5-8d1b-f48241b4d1f9
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
3b19b17e-88d1-45f9-a1c9-c6b53204fc2e	1105b1af-dd4e-4207-8aa7-8d79c7f6928e	confirmation_token	71d91de0c7ce60383d61b020a978fe90d6af1b621028712af8067016	kaczcards1@gmail.com	2025-06-18 03:16:55.960034	2025-06-18 03:16:55.960034
e65aee86-d1d4-4036-8fcd-e7df769f4c92	ee66b6a2-134f-4da5-a400-d19c6e67519d	confirmation_token	b822aec4d924bfe8dd7d577db5111f1708e2cc39f8d54021fae8e0ba	kaczcards2@gmail.com	2025-06-18 03:25:45.999277	2025-06-18 03:25:45.999277
28904d60-b0f1-461d-a085-d888a05dd836	337c135e-2839-4bca-8a47-9f0f30fe692d	confirmation_token	e0797435b9727dc572e21c35fb2833e2ed41cd8ceb3fa62aa1854a65	kaczcards@yahoo.com	2025-06-23 18:01:09.415311	2025-06-23 18:01:09.415311
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
00000000-0000-0000-0000-000000000000	54	3l3f2utlicmt	a3d8f808-1eaf-4f31-88ee-b93203d00176	t	2025-06-24 17:29:00.713741+00	2025-06-24 18:27:29.457488+00	\N	3751b3bb-0b99-43ce-b420-1b4062bbf0dc
00000000-0000-0000-0000-000000000000	55	nb3hiwoqnl3b	a3d8f808-1eaf-4f31-88ee-b93203d00176	f	2025-06-24 18:27:29.464633+00	2025-06-24 18:27:29.464633+00	3l3f2utlicmt	3751b3bb-0b99-43ce-b420-1b4062bbf0dc
00000000-0000-0000-0000-000000000000	56	6i7mimhmusw2	a3d8f808-1eaf-4f31-88ee-b93203d00176	t	2025-06-24 20:38:42.067437+00	2025-06-24 21:39:58.807847+00	\N	8d3ce0b5-0ffc-42a8-9069-0428a31c3cdc
00000000-0000-0000-0000-000000000000	57	b2dhu5vju6pw	a3d8f808-1eaf-4f31-88ee-b93203d00176	f	2025-06-24 21:39:58.811494+00	2025-06-24 21:39:58.811494+00	6i7mimhmusw2	8d3ce0b5-0ffc-42a8-9069-0428a31c3cdc
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag) FROM stdin;
3751b3bb-0b99-43ce-b420-1b4062bbf0dc	a3d8f808-1eaf-4f31-88ee-b93203d00176	2025-06-24 17:29:00.711839+00	2025-06-24 18:27:29.477514+00	\N	aal1	\N	2025-06-24 18:27:29.477436	Expo/2.33.13 CFNetwork/3826.500.131 Darwin/24.5.0	68.58.73.218	\N
8d3ce0b5-0ffc-42a8-9069-0428a31c3cdc	a3d8f808-1eaf-4f31-88ee-b93203d00176	2025-06-24 20:38:42.063504+00	2025-06-24 21:39:58.819249+00	\N	aal1	\N	2025-06-24 21:39:58.81918	Expo/2.33.13 CFNetwork/3826.500.131 Darwin/24.5.0	68.58.73.218	\N
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	84ec4c75-1c32-46f6-b0bb-7930869a4c81	authenticated	authenticated	kaczcards@gmail.com	$2a$10$nk7BN.WvkaCrajkTJJUNP.hzEjkxZ1.hloto15EsI1yGP389fThsG	2025-06-18 14:38:30.255564+00	\N		2025-06-18 02:39:23.018551+00		\N			\N	2025-06-23 21:00:05.341401+00	{"provider": "email", "providers": ["email"]}	{"sub": "84ec4c75-1c32-46f6-b0bb-7930869a4c81", "email": "kaczcards@gmail.com", "lastName": "", "firstName": "Kevin", "homeZipCode": "46060", "email_verified": true, "phone_verified": false}	\N	2025-06-18 02:19:54.206659+00	2025-06-23 21:00:27.755071+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	8c07a4af-5eb1-4012-a491-737a9343434e	authenticated	authenticated	kkacz76@gmail.com	$2a$10$R.e8KxlxnqDyFxfgpbRatOzSloEWhbjThuTOlb0LCvSJ2U0ap7iL6	2025-06-23 21:03:58.66438+00	\N		2025-06-23 21:03:49.791926+00		\N			\N	2025-06-23 21:07:21.707665+00	{"provider": "email", "providers": ["email"]}	{"sub": "8c07a4af-5eb1-4012-a491-737a9343434e", "email": "kkacz76@gmail.com", "lastName": "", "firstName": "Kazman", "homeZipCode": "46060", "email_verified": true, "phone_verified": false}	\N	2025-06-23 21:03:49.771254+00	2025-06-23 21:07:21.710277+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	1105b1af-dd4e-4207-8aa7-8d79c7f6928e	authenticated	authenticated	kaczcards1@gmail.com	$2a$10$ugIL2E6b64z6947O9529TOYz2exjcb8ate0FPNtoL4qJubdUuBCOW	\N	\N	71d91de0c7ce60383d61b020a978fe90d6af1b621028712af8067016	2025-06-18 03:16:55.499614+00		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"sub": "1105b1af-dd4e-4207-8aa7-8d79c7f6928e", "email": "kaczcards1@gmail.com", "lastName": "", "firstName": "Kavin", "homeZipCode": "46060", "email_verified": false, "phone_verified": false}	\N	2025-06-18 03:16:55.487936+00	2025-06-18 03:16:55.958213+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	337c135e-2839-4bca-8a47-9f0f30fe692d	authenticated	authenticated	kaczcards@yahoo.com	$2a$10$w3KYU2nKeJ4j6Z7f4LV07ezARWkGX/D3ob6JCmYA9Jg6pwRz9XZzi	\N	\N	e0797435b9727dc572e21c35fb2833e2ed41cd8ceb3fa62aa1854a65	2025-06-23 18:01:08.924456+00		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"sub": "337c135e-2839-4bca-8a47-9f0f30fe692d", "email": "kaczcards@yahoo.com", "lastName": "", "firstName": "Kalvin", "homeZipCode": "46060", "email_verified": false, "phone_verified": false}	\N	2025-06-23 18:01:08.898492+00	2025-06-23 18:01:09.409303+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	ee66b6a2-134f-4da5-a400-d19c6e67519d	authenticated	authenticated	kaczcards2@gmail.com	$2a$10$iimGLslgesm/fh2IaM7c7OWZE7dOQphV6RHIBcxov1f6ZhFr4XpS.	\N	\N	b822aec4d924bfe8dd7d577db5111f1708e2cc39f8d54021fae8e0ba	2025-06-18 03:25:45.542962+00		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"sub": "ee66b6a2-134f-4da5-a400-d19c6e67519d", "email": "kaczcards2@gmail.com", "lastName": "", "firstName": "Kovin", "homeZipCode": "46060", "email_verified": false, "phone_verified": false}	\N	2025-06-18 03:25:45.531798+00	2025-06-18 03:25:45.997407+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	a3d8f808-1eaf-4f31-88ee-b93203d00176	authenticated	authenticated	salesstreamlinedai@gmail.com	$2a$10$THe6CwpyZzfnBlF1/Yb8n.hxJWhaFc.k8Ht7PCkHKpqF4BwRmL5M6	2025-06-23 21:26:31.541109+00	\N		2025-06-23 21:26:24.712685+00		\N			\N	2025-06-24 20:38:42.062828+00	{"provider": "email", "providers": ["email"]}	{"sub": "a3d8f808-1eaf-4f31-88ee-b93203d00176", "email": "salesstreamlinedai@gmail.com", "lastName": "", "firstName": "JPK", "homeZipCode": "46060", "email_verified": true, "phone_verified": false}	\N	2025-06-23 21:26:24.69695+00	2025-06-24 21:39:58.813836+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: card_shows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.card_shows (id, title, location, address, dates, times, entryfee, description, image, features, promoter_id, coordinate, status, created_at, updated_at) FROM stdin;
8d8a5952-2d20-4e6c-8c61-78d6b15b47b0	Regional Pokemon Tournament	Austin Gaming Center	456 Gaming Center Blvd, Austin, TX 78701	[2025-07-22,2025-07-23)	9:00 AM - 8:00 PM	500	Official Pokemon tournament with prize support and vendor booths.	\N	{"Prize Support","Vendor Booths",Pokemon}	\N	\N	pending	2025-06-18 20:56:10.22039+00	2025-06-18 20:56:10.22039+00
0094d77e-b030-4e02-b44b-7867be4d1fb7	East Coast Card Show	Philadelphia Convention Center	123 Convention Center Dr, Philadelphia, PA 19103	[2025-07-15,2025-07-16)	10:00 AM - 6:00 PM	0	Large trading card show featuring sports cards, Pokemon, and vintage collectibles. On-site grading available.	\N	{"On-Site Grading",Trading,Pokemon,"Sports Cards"}	\N	\N	pending	2025-06-18 20:56:10.475494+00	2025-06-18 20:56:10.475494+00
11903c65-8535-41e9-b8bc-10c91cc74ba6	Regional Pokemon Tournament	Austin Gaming Center	456 Gaming Center Blvd, Austin, TX 78701	[2025-07-22,2025-07-23)	9:00 AM - 8:00 PM	500	Official Pokemon tournament with prize support and vendor booths.	\N	{"Prize Support","Vendor Booths",Pokemon}	\N	\N	pending	2025-06-18 20:56:14.143631+00	2025-06-18 20:56:14.143631+00
56cbaa2a-e7c7-40b5-ab27-fa2a0ad3e121	East Coast Card Show	Philadelphia Convention Center	123 Convention Center Dr, Philadelphia, PA 19103	[2025-07-15,2025-07-16)	10:00 AM - 6:00 PM	0	Large trading card show featuring sports cards, Pokemon, and vintage collectibles. On-site grading available.	\N	{"On-Site Grading",Trading,Pokemon,"Sports Cards"}	\N	\N	pending	2025-06-18 20:56:14.360007+00	2025-06-18 20:56:14.360007+00
563c3fff-5c87-4410-9044-a817196bac43	Magic: The Gathering Regional Championship	Seattle Convention Center	789 Tournament Hall, Seattle, WA 98101	[2025-08-10,2025-08-11)	9:00 AM - 9:00 PM	0	Official Magic tournament with cash prizes and vendor booths selling cards.	\N	{"Vendor Booths",Selling}	\N	\N	pending	2025-06-18 20:56:42.390075+00	2025-06-18 20:56:42.390075+00
60315045-0c87-4f6d-8393-ba99edc1683d	Regional Pokemon Tournament	Austin Gaming Center	456 Gaming Center Blvd, Austin, TX 78701	[2025-07-22,2025-07-23)	9:00 AM - 8:00 PM	500	Official Pokemon tournament with prize support and vendor booths.	\N	{"Prize Support","Vendor Booths",Pokemon}	\N	\N	pending	2025-06-18 20:56:42.496032+00	2025-06-18 20:56:42.496032+00
bc6e48d0-81ee-4862-b960-3979757f8931	East Coast Card Show	Philadelphia Convention Center	123 Convention Center Dr, Philadelphia, PA 19103	[2025-07-15,2025-07-16)	10:00 AM - 6:00 PM	0	Large trading card show featuring sports cards, Pokemon, and vintage collectibles. On-site grading available.	\N	{"On-Site Grading",Trading,Pokemon,"Sports Cards"}	\N	\N	pending	2025-06-18 20:56:42.727663+00	2025-06-18 20:56:42.727663+00
7aff84cb-c71d-4c54-9d01-84d938b7ca4b	Magic: The Gathering Regional Championship	Seattle Convention Center	789 Tournament Hall, Seattle, WA 98101	[2025-08-10,2025-08-11)	9:00 AM - 9:00 PM	0	Official Magic tournament with cash prizes and vendor booths selling cards.	\N	{"Vendor Booths",Selling}	\N	\N	pending	2025-06-18 21:01:30.426016+00	2025-06-18 21:01:30.426016+00
da59487e-d679-498b-8bfe-859a6d7a5741	Regional Pokemon Tournament	Austin Gaming Center	456 Gaming Center Blvd, Austin, TX 78701	[2025-07-22,2025-07-23)	9:00 AM - 8:00 PM	500	Official Pokemon tournament with prize support and vendor booths.	\N	{"Prize Support","Vendor Booths",Pokemon}	\N	\N	pending	2025-06-18 21:01:30.670194+00	2025-06-18 21:01:30.670194+00
241d3dd4-2370-4afb-a634-9393b4bc4d0e	East Coast Card Show	Philadelphia Convention Center	123 Convention Center Dr, Philadelphia, PA 19103	[2025-07-15,2025-07-16)	10:00 AM - 6:00 PM	0	Large trading card show featuring sports cards, Pokemon, and vintage collectibles. On-site grading available.	\N	{"On-Site Grading",Trading,Pokemon,"Sports Cards"}	\N	\N	pending	2025-06-18 21:01:30.891002+00	2025-06-18 21:01:30.891002+00
\.


--
-- Data for Name: dealer_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dealer_profiles (id, user_id, business_name, description, website_url, instagram_url, twitter_url, facebook_url, business_email, business_phone, categories, other_categories, created_at, updated_at) FROM stdin;
22affa62-188b-4ad0-927e-65ab95a03ab3	a3d8f808-1eaf-4f31-88ee-b93203d00176	Mac cards	We specialize in 1st Bowman prospects	https://www.ebay.com/str/kaczcards	kaczcards	kaczcards	kaczcards	kaczcards@gmail.com	3173969820	{"Sports Cards",Vintage,Pokemon}		2025-06-24 18:32:40.999+00	2025-06-24 18:32:40.999+00
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, email, first_name, last_name, home_zip_code, role, created_at, updated_at, favorite_shows, attended_shows, account_type, subscription_status, subscription_expiry, subscription_type, subscription_id) FROM stdin;
1105b1af-dd4e-4207-8aa7-8d79c7f6928e	kaczcards1@gmail.com	Kavin		\N	ATTENDEE	2025-06-18 03:16:55.487602+00	2025-06-18 03:16:55.487602+00	{}	{}	collector	none	\N	none	\N
ee66b6a2-134f-4da5-a400-d19c6e67519d	kaczcards2@gmail.com	Kovin		\N	ATTENDEE	2025-06-18 03:25:45.53139+00	2025-06-18 03:25:45.53139+00	{}	{}	collector	none	\N	none	\N
a3d8f808-1eaf-4f31-88ee-b93203d00176	salesstreamlinedai@gmail.com	JPK		46060	dealer	2025-06-23 21:26:24.696603+00	2025-06-24 15:52:44.739304+00	{}	{}	dealer	active	2025-07-24 15:52:44.739304+00	monthly	\N
337c135e-2839-4bca-8a47-9f0f30fe692d	kaczcards@yahoo.com	Kalvin		\N	ATTENDEE	2025-06-23 18:01:08.89753+00	2025-06-23 18:01:08.89753+00	{}	{}	collector	none	\N	none	\N
84ec4c75-1c32-46f6-b0bb-7930869a4c81	kaczcards@gmail.com	Kevin		46060	ATTENDEE	2025-06-18 02:19:54.206285+00	2025-06-23 21:00:27.503+00	{0784a733-4fb2-41ec-9514-0d7c197fb87b,796eb5b3-01b7-463c-aa74-801e4479dbba,3b6e387b-39a2-4ace-a233-a243e1db02c6,19f9ef9d-fbad-4aad-8741-31e73f893725}	{}	organizer	active	2025-06-30 20:59:46.569+00	none	\N
8c07a4af-5eb1-4012-a491-737a9343434e	kkacz76@gmail.com	Kazman		46060	ATTENDEE	2025-06-23 21:03:49.770871+00	2025-06-23 21:06:56.413+00	{}	{}	organizer	active	2025-06-30 21:05:46.88+00	none	\N
\.


--
-- Data for Name: shared_want_lists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shared_want_lists (id, userid, showid, wantlistid, sharedat) FROM stdin;
\.


--
-- Data for Name: show_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.show_participants (id, userid, showid, createdat) FROM stdin;
ab248a76-4a46-4f35-99f1-d44e339e7b41	a3d8f808-1eaf-4f31-88ee-b93203d00176	3b6e387b-39a2-4ace-a233-a243e1db02c6	2025-06-24 21:12:20.920067+00
\.


--
-- Data for Name: shows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shows (id, title, location, address, start_date, end_date, entry_fee, description, image_url, rating, coordinates, status, organizer_id, created_at, updated_at, features, categories) FROM stdin;
0d7279ec-d895-4397-8051-287f21c327f4	Carmel Card Show	American Legion Post 155	852 W. Main Street Carmel IN 46032	2025-06-21 12:30:00+00	2025-06-21 18:00:00+00	0.00	Two floors of cards	\N	\N	\N	ACTIVE	\N	2025-06-18 14:45:17.74883+00	2025-06-18 14:45:17.74883+00	{}	{}
54af141a-9a08-4101-89ec-b4430e36f1ea	Magic: The Gathering Regional Championship	Seattle Convention Center	789 Tournament Hall, Seattle, WA 98101	2025-08-10 00:00:00+00	2025-08-10 00:00:00+00	0.00	Official Magic tournament with cash prizes and vendor booths selling cards.	\N	0.0	\N	pending	\N	2025-06-18 21:04:36.13134+00	2025-06-18 21:04:36.13134+00	["Vendor Booths", "Selling"]	{}
ceebfb54-60f6-416b-8089-76f2715a7477	Regional Pokemon Tournament	Austin Gaming Center	456 Gaming Center Blvd, Austin, TX 78701	2025-07-22 00:00:00+00	2025-07-22 00:00:00+00	500.00	Official Pokemon tournament with prize support and vendor booths.	\N	0.0	\N	pending	\N	2025-06-18 21:04:36.710245+00	2025-06-18 21:04:36.710245+00	["Prize Support", "Vendor Booths", "Pokemon"]	{}
958d184e-bc86-41fd-ba24-a58d0f4d5eef	East Coast Card Show	Philadelphia Convention Center	123 Convention Center Dr, Philadelphia, PA 19103	2025-07-15 00:00:00+00	2025-07-15 00:00:00+00	0.00	Large trading card show featuring sports cards, Pokemon, and vintage collectibles. On-site grading available.	\N	0.0	\N	pending	\N	2025-06-18 21:04:37.275392+00	2025-06-18 21:04:37.275392+00	["On-Site Grading", "Trading", "Pokemon", "Sports Cards"]	{}
0784a733-4fb2-41ec-9514-0d7c197fb87b	East Coast Card Show	Boston Convention Center	415 Summer St, Boston, MA 02210	2025-07-15 10:00:00+00	2025-07-15 18:00:00+00	5.00	The largest card show in New England featuring over 200 vendors. Door prizes and autograph guests.	\N	\N	0101000020E610000097FF907EFBC251C087A757CA322C4540	ACTIVE	\N	2025-06-17 21:15:58.148009+00	2025-06-17 21:15:58.148009+00	{"Food Vendors": true, "On-site Grading": true, "Autograph Guests": true}	{"Sports Cards","Trading Cards",Memorabilia}
796eb5b3-01b7-463c-aa74-801e4479dbba	Midwest Collectors Convention	Chicago Exhibition Hall	2301 S Lake Shore Dr, Chicago, IL 60616	2025-08-10 09:00:00+00	2025-08-11 17:00:00+00	10.00	Two-day event with special guests and the largest selection of vintage sports cards in the Midwest.	\N	\N	0101000020E61000005DDC460378E755C0CC5D4BC807ED4440	ACTIVE	\N	2025-06-17 21:15:58.148009+00	2025-06-17 21:15:58.148009+00	{"Food Vendors": true, "On-site Grading": true, "Autograph Guests": true}	{"Sports Cards",Vintage,Memorabilia}
0908ec35-7cc8-4304-9f14-ca7dcb0dcbd1	West Coast Card Expo	LA Convention Center	1201 S Figueroa St, Los Angeles, CA 90015	2025-09-05 10:00:00+00	2025-09-07 19:00:00+00	15.00	The premier West Coast trading card event featuring exclusive releases and athlete appearances.	\N	\N	0101000020E6100000228E75711B915DC0B003E78C28054140	ACTIVE	\N	2025-06-17 21:15:58.148009+00	2025-06-17 21:15:58.148009+00	{"Card Breaks": true, "On-site Grading": true, "Autograph Guests": true}	{"Sports Cards","Trading Cards",Collectibles}
37ce9ac0-aa71-4377-914a-9110e94ebf56	We are Pleased to Bring a Larger Location to Gaithersburg on Sunday, May 18 and Washingtonian Center (. Gaithersburg, MD 20878)	With 5,000+ Guests Over 3 Days, Raleigh Became our Highest Attended Venue to Date!	With 5,000+ Guests Over 3 Days, Raleigh Became our Highest Attended Venue to Date!	2025-08-17 00:00:00+00	2025-08-17 00:00:00+00	\N	Very Excited to Partner with Tony Roma's of Durham, NC for a Lunch Discount!	\N	0.0	0101000020E61000003E6079EBD7A853C034E66498C9E34140	pending	\N	2025-06-18 21:33:39.875644+00	2025-06-18 21:33:39.875644+00	{}	{}
1bd97d89-8360-415f-81ee-cfe48c06778e	Wednesday -	93 W. Campbell Rd.	93 W. Campbell Rd.	2025-11-26 00:00:00+00	2025-11-26 00:00:00+00	500.00	Johnstown Moose Club	\N	0.0	0101000020E6100000C0AD60C0377F52C09382B8BC83674540	pending	\N	2025-06-18 21:33:40.313374+00	2025-06-18 21:33:40.313374+00	{}	{}
81755af7-db02-4c2a-a0c2-cdbb34ade1a1	Sun -	18801 E. 39th St. S.	18801 E. 39th St. S.	2025-06-22 00:00:00+00	2025-06-22 00:00:00+00	\N	Larry Yeager	\N	0.0	0101000020E61000008125B26AEB9657C05EB642FDD3854340	pending	\N	2025-06-18 21:33:40.864346+00	2025-06-18 21:33:40.864346+00	{}	{}
81d3b7dd-d739-4fcd-bf93-b2bc66613656	Thu -	380 Social Street	380 Social Street	2025-06-19 00:00:00+00	2025-06-19 00:00:00+00	\N	Bill Bryda	\N	0.0	0101000020E6100000220670696BE051C0BDC804FC1A014540	pending	\N	2025-06-18 21:33:41.571513+00	2025-06-18 21:33:41.571513+00	{}	{}
9b30b690-8bc7-445d-8f3e-333d6f917054	Sun -	2500 W Moreland Road	2500 W Moreland Road	2025-10-26 00:00:00+00	2025-10-26 00:00:00+00	\N	Mike	\N	0.0	0101000020E6100000DECDAED6E4C752C099E8E225EE114440	pending	\N	2025-06-18 21:33:42.118107+00	2025-06-18 21:33:42.118107+00	{}	{}
fa6e637a-70e6-47a5-a230-3d65372cb056	Sat -	3101 E Semoran Blvd	3101 E Semoran Blvd	2025-06-21 00:00:00+00	2025-06-21 00:00:00+00	\N	Louie Morales	\N	0.0	0101000020E6100000CB6E1C67095D54C0EE9AFCBBE3AB3C40	pending	\N	2025-06-18 21:33:42.884247+00	2025-06-18 21:33:42.884247+00	{}	{}
3ce6e3c8-de6d-4f8d-81d7-d2b4b9ebf67a	May 31– |	21 Mounts Bay Rd |	21 Mounts Bay Rd |	2025-06-01 00:00:00+00	2025-06-01 00:00:00+00	\N	Pavilion 20, Bologna Fiere, Bologna, Italy |	\N	0.0	0101000020E6100000A7B3EE7AC4F45C40D356DB0363F93FC0	pending	\N	2025-06-18 21:33:43.204372+00	2025-06-18 21:33:43.204372+00	{}	{}
2b8d83ca-e786-49ca-ad4a-3316c1e968ee	|	Shop 6/7, The Auroras, 9 Aurora Drive, Umhlanga Rocks, 4320, South Africa |	Shop 6/7, The Auroras, 9 Aurora Drive, Umhlanga Rocks, 4320, South Africa |	2025-04-27 00:00:00+00	2025-04-27 00:00:00+00	\N	A-I Fest (VG + GO) |	\N	0.0	0101000020E6100000F895CE8767113F407F5D972BCDB93DC0	pending	\N	2025-06-18 21:33:43.501953+00	2025-06-18 21:33:43.501953+00	{}	{}
d64927d9-552f-4b2e-a88e-dc69eafbcef2	May 31-	Bologna Pokémon Special Event 2025	Bologna Pokémon Special Event 2025	2025-06-01 00:00:00+00	2025-06-01 00:00:00+00	\N	Bologna, IT	\N	0.0	0101000020E61000002E2757676BAF2640971B0C75583F4640	pending	\N	2025-06-18 21:33:43.798327+00	2025-06-18 21:33:43.798327+00	{}	{}
8bb6cb4d-66ae-42f9-82f3-42327a0a4c91	November 30-	Stuttgart Pokémon Regional Championships 2025	Stuttgart Pokémon Regional Championships 2025	2024-12-01 00:00:00+00	2024-12-01 00:00:00+00	\N	Stuttgart, Baden Wuerttemberg, DE	\N	0.0	0101000020E6100000F7C6B546A95D22402B9E1FEB4E634840	pending	\N	2025-06-18 21:33:44.067928+00	2025-06-18 21:33:44.067928+00	{}	{}
fa77662a-e7f0-47b2-a997-a018d748df15	Indianapolis Card Show	Indianapolis, IN	VFW 1120, 1850 South East St	2025-06-28 00:00:00+00	2025-06-28 00:00:00+00	\N	Card show in Indianapolis, Indiana. Times: 8:30 – 3. Contact: Kevin (317)508 – 9467 or Jason (317)864 – 2085. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000D95F764F1E8A55C08A1F63EE5AE24340	ACTIVE	\N	2025-06-19 00:03:27.425034+00	2025-06-19 00:03:27.425034+00	{}	{}
525d30da-d2b6-4575-80d5-b5ff4744a2e8	Indianapolis Card Show	Indianapolis, IN	Evan’s Event Center, 1159 Country Club Rd	2025-06-29 00:00:00+00	2025-06-29 00:00:00+00	\N	Card show in Indianapolis, Indiana. Times: 8 – 2. Contact: Tom (812)369 – 0824 – (317)902 – 1559. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000D95F764F1E8A55C08A1F63EE5AE24340	ACTIVE	\N	2025-06-19 00:03:27.522794+00	2025-06-19 00:03:27.522794+00	{}	{}
19f9ef9d-fbad-4aad-8741-31e73f893725	Indianapolis Card Show	Indianapolis, IN	LaQuinta Inn, 5120 Victory Drive	2025-07-05 00:00:00+00	2025-07-05 00:00:00+00	\N	Card show in Indianapolis, Indiana. Times: 8 – 2. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000D95F764F1E8A55C08A1F63EE5AE24340	ACTIVE	\N	2025-06-19 00:03:27.709657+00	2025-06-19 00:03:27.709657+00	{}	{}
a749907f-3cd9-4f24-96a4-036fc127901f	Indianapolis Card Show	Indianapolis, IN	Evan’s Event Center, 1159 Country Club Rd	2025-07-27 00:00:00+00	2025-07-27 00:00:00+00	\N	Card show in Indianapolis, Indiana. Times: 8 – 2. Contact: Tom (812)369 – 0824 – (317)902 – 1559. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000D95F764F1E8A55C08A1F63EE5AE24340	ACTIVE	\N	2025-06-19 00:03:28.671106+00	2025-06-19 00:03:28.671106+00	{}	{}
c78b6a19-f80f-4296-9cb1-0632b9387f8a	Carmel Card Show	Carmel, IN	American Legion Post 155, 852 W. Main Street	2025-06-21 00:00:00+00	2025-06-21 00:00:00+00	\N	Card show in Carmel, Indiana. Times: 8:30 – 2. Contact: Ryan (317)586 – 9982. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000643BDF4F8D8755C0053411363CFD4340	ACTIVE	\N	2025-06-19 00:03:26.916095+00	2025-06-19 00:03:26.916095+00	{}	{}
3599f803-5e95-4756-8477-38592ea41dc1	Carmel Card Show	Carmel, IN	American Legion Post 155, 852 W. Main Street	2025-07-26 00:00:00+00	2025-07-26 00:00:00+00	\N	Card show in Carmel, Indiana. Times: 8:30 – 2. Contact: Ryan (317)586 – 9982. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000643BDF4F8D8755C0053411363CFD4340	ACTIVE	\N	2025-06-19 00:03:28.486924+00	2025-06-19 00:03:28.486924+00	{}	{}
ed239a18-f4ef-4f6c-a775-a0c055302179	Fort Wayne Card Show	Fort Wayne, IN	Indiana Wesleyan Univ, 8211 W Jefferson Blvd	2025-06-28 00:00:00+00	2025-06-28 00:00:00+00	\N	Card show in Fort Wayne, Indiana. Times: 10 – 4. Contact: (260)437 – 9147. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000FE43FAEDEB4855C052499D80268A4440	ACTIVE	\N	2025-06-19 00:03:27.223268+00	2025-06-19 00:03:27.223268+00	{}	{}
70c17d07-2b66-4365-92de-d1323234b3ef	Fort Wayne Card Show	Fort Wayne, IN	Allen Co. Fairgrounds, 2726 Carroll Rd	2025-07-12 00:00:00+00	2025-07-12 00:00:00+00	\N	Card show in Fort Wayne, Indiana. Times: 10 – 3. Contact: Greg (260)827 – 0317. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000FE43FAEDEB4855C052499D80268A4440	ACTIVE	\N	2025-06-19 00:03:28.00165+00	2025-06-19 00:03:28.00165+00	{}	{}
78b66cf8-9288-4f90-ad5b-dab08999dd94	South Bend Card Show	South Bend, IN	American Legion Post 357 5414 W Sample St (10, 3) Haley	2025-07-05 00:00:00+00	2025-07-05 00:00:00+00	\N	Card show in South Bend, Indiana. Times: 574. Contact: 252 – 9463. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000E3A59BC4209055C0D881734694D64440	ACTIVE	\N	2025-06-19 00:03:27.808113+00	2025-06-19 00:03:27.808113+00	{}	{}
4a5fd485-0bf8-4014-8bd0-24edc78f67e5	Fishers Card Show	Fishers, IN	American Legion #470, 9091 East 126th St.	2025-07-19 00:00:00+00	2025-07-19 00:00:00+00	\N	Card show in Fishers, Indiana. Times: 8 – 2. Contact: Jeff (317)504 – 8110. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E61000004D158C4AEA8055C0A60A462575FA4340	ACTIVE	\N	2025-06-19 00:03:28.102542+00	2025-06-19 00:03:28.102542+00	{}	{}
3b6e387b-39a2-4ace-a233-a243e1db02c6	Noblesville Card Show	Noblesville, IN	Moose Lodge, 950 Field Drive	2025-07-12 00:00:00+00	2025-07-12 00:00:00+00	\N	Card show in Noblesville, Indiana. Times: 9 – 3. Contact: – Brad (463)673 – 6073. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000B8AF03E78C8055C04B598638D6054440	ACTIVE	\N	2025-06-19 00:03:27.906947+00	2025-06-19 00:03:27.906947+00	{}	{}
1f31f244-f52d-4a69-ae9c-96c00676755f	Muncie Card Show	Muncie, IN	Delaware Co Fairgrounds, 1210 N Wheeling Ave	2025-06-28 00:00:00+00	2025-06-28 00:00:00+00	\N	Card show in Muncie, Indiana. Times: 9 – 2. Contact: Jimmy (765)730 – 3628. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E610000029CB10C7BA5855C0F085C954C1184440	ACTIVE	\N	2025-06-19 00:03:27.334072+00	2025-06-19 00:03:27.334072+00	{}	{}
cc329284-f355-4051-8e50-a11f5554cd8d	Kokomo Card Show	Kokomo, IN	Elite Conference Center, 2820 South Lafountain St.	2025-06-14 00:00:00+00	2025-06-14 00:00:00+00	\N	Card show in Kokomo, Indiana. Times: 10 – 6. Contact: Troy (765)434 – 5637. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000B8AF03E78C8855C083C0CAA1453E4440	ACTIVE	\N	2025-06-19 00:03:26.819584+00	2025-06-19 00:03:26.819584+00	{}	{}
051deadb-973e-4bef-82a3-1532cd47f950	Michigan City Card Show	Michigan City, IN	FOP Lodge, 416 US Highway 20	2025-06-21 00:00:00+00	2025-06-21 00:00:00+00	\N	Card show in Michigan City, Indiana. Times: 9 – 2. Contact: Mike (219)229 – 0411. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000E17A14AE47B955C0C3F5285C8FDA4440	ACTIVE	\N	2025-06-19 00:03:27.013472+00	2025-06-19 00:03:27.013472+00	{}	{}
d982709c-8f5d-4462-91e8-337c8f0a8643	Michigan City Card Show	Michigan City, IN	FOP Lodge, 416 US Highway 20	2025-07-19 00:00:00+00	2025-07-19 00:00:00+00	\N	Card show in Michigan City, Indiana. Times: 9 – 2. Contact: Mike (219)229 – 0411. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000E17A14AE47B955C0C3F5285C8FDA4440	ACTIVE	\N	2025-06-19 00:03:28.203537+00	2025-06-19 00:03:28.203537+00	{}	{}
f7578666-7008-4539-b577-e789388af3d6	Greenwood Card Show	Greenwood, IN	American Legion Post 252, 334 US 31 South	2025-06-22 00:00:00+00	2025-06-22 00:00:00+00	\N	Card show in Greenwood, Indiana. Times: 10 – 3:30. Contact: Tim Welch (317)797 – 5971. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E61000003B70CE88D28655C011C7BAB88DCE4340	ACTIVE	\N	2025-06-19 00:03:27.118067+00	2025-06-19 00:03:27.118067+00	{}	{}
7f6b44a8-e391-46c1-9892-809cc6295da3	Schererville Card Show	Schererville, IN	Villa Cesare, 900 Eagle Ridge Drive	2025-07-19 00:00:00+00	2025-07-19 00:00:00+00	\N	Card show in Schererville, Indiana. Times: 10 – 5. Contact: Eric (219)455 – 0397. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000705F07CE19DD55C0F7065F984CBD4440	ACTIVE	\N	2025-06-19 00:03:28.397237+00	2025-06-19 00:03:28.397237+00	{}	{}
a50a3f81-5251-4064-8a0f-7a6b0efdf531	Lake Station Card Show	Lake Station, IN	VFW, 2750 Central Ave	2025-06-29 00:00:00+00	2025-06-29 00:00:00+00	\N	Card show in Lake Station, Indiana. Times: 9 – 2. Contact: (219)455 – 0860. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E610000071AC8BDB68D055C00C93A98251C94440	ACTIVE	\N	2025-06-19 00:03:27.618534+00	2025-06-19 00:03:27.618534+00	{}	{}
d648a21b-2285-41a1-bfe4-8165bb02bcdb	Lake Station Card Show	Lake Station, IN	VFW, 2750 Central Ave	2025-07-27 00:00:00+00	2025-07-27 00:00:00+00	\N	Card show in Lake Station, Indiana. Times: 9 – 2. Contact: (219)455 – 0860. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E610000071AC8BDB68D055C00C93A98251C94440	ACTIVE	\N	2025-06-19 00:03:28.764015+00	2025-06-19 00:03:28.764015+00	{}	{}
853030c9-7d31-46a3-b009-b05bd16351b4	Salem Card Show	Salem, IN	Salem Armory, 1100 N. Shelby St	2025-06-14 00:00:00+00	2025-06-14 00:00:00+00	\N	Card show in Salem, Indiana. Times: 9 – 2. Contact: Brad (812)572 – 1500. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E61000006DC5FEB27B8655C04BC8073D9B4D4340	ACTIVE	\N	2025-06-19 00:03:26.726404+00	2025-06-19 00:03:26.726404+00	{}	{}
4b9b462b-c401-43b9-9bb9-888548da0429	Crawfordsville Card Show	Crawfordsville, IN	Montgomery Co Fairgrounds, 400 Parke Ave	2025-06-14 00:00:00+00	2025-06-14 00:00:00+00	\N	Card show in Crawfordsville, Indiana. Times: 10 – 3. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E6100000D5E76A2BF6B755C0CCEEC9C342054440	ACTIVE	\N	2025-06-19 00:03:26.59252+00	2025-06-19 00:03:26.59252+00	{}	{}
c496d67c-d0a0-4b64-8f63-81a36565495b	Huntington Card Show	Huntington, IN	Fairgrounds Community Building, 631 E Taylor St	2025-07-26 00:00:00+00	2025-07-26 00:00:00+00	\N	Card show in Huntington, Indiana. Times: 10 – 4. Contact: David (260)224 – 2258. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E61000005D6DC5FEB25F55C07E8CB96B09714440	ACTIVE	\N	2025-06-19 00:03:28.584548+00	2025-06-19 00:03:28.584548+00	{}	{}
913db02e-d015-416d-ae00-409dd85104a6	Marion Card Show	Marion, IN	4, H Expo Center – 1403 E. S.R.18	2025-07-19 00:00:00+00	2025-07-19 00:00:00+00	\N	Card show in Marion, Indiana. Times: 9 – 2. Contact: Jerry (765)639 – 6387. Features trading cards, sports memorabilia, and collectibles.	\N	\N	0101000020E61000002E90A0F8316A55C00F0BB5A679474440	ACTIVE	\N	2025-06-19 00:03:28.300325+00	2025-06-19 00:03:28.300325+00	{}	{}
2b8fb5c2-bc28-4ea7-9863-fb6cbd72fdf8	Crawfordsville Card Show	Crawfordsville	Montgomery Co Fairgrounds, 400 Parke Ave	2026-06-14 00:00:00+00	2026-06-14 00:00:00+00	\N	Card show in Crawfordsville at Montgomery Co Fairgrounds, 400 Parke Ave	\N	\N	\N	active	\N	2025-06-20 21:24:17.074965+00	2025-06-20 21:24:17.317272+00	{}	{}
995348f8-74c9-475f-b625-ab51379cc16a	Salem Card Show	Salem	Salem Armory, 1100 N. Shelby St	2026-06-14 00:00:00+00	2026-06-14 00:00:00+00	\N	Card show in Salem at Salem Armory, 1100 N. Shelby St	\N	\N	\N	active	\N	2025-06-20 21:24:17.407359+00	2025-06-20 21:24:17.590444+00	{}	{}
47790069-3636-4300-88d6-2d61ff0758f1	Kokomo Card Show	Kokomo	Elite Conference Center, 2820 South Lafountain St.	2026-06-14 00:00:00+00	2026-06-14 00:00:00+00	\N	Card show in Kokomo at Elite Conference Center, 2820 South Lafountain St.	\N	\N	\N	active	\N	2025-06-20 21:24:17.654158+00	2025-06-20 21:24:17.821428+00	{}	{}
db086276-44d2-401e-be05-632be2faae7c	Michigan City Card Show	Michigan City	FOP Lodge, 416 US Highway 20	2025-06-21 00:00:00+00	2025-06-21 00:00:00+00	\N	Card show in Michigan City at FOP Lodge, 416 US Highway 20	\N	\N	\N	active	\N	2025-06-20 21:24:17.877008+00	2025-06-20 21:24:17.931363+00	{}	{}
55f7fd2c-64aa-4eb5-908b-eedaa5c45053	Fort Wayne Card Show	Fort Wayne	Indiana Wesleyan Univ, 8211 W Jefferson Blvd	2025-06-28 00:00:00+00	2025-06-28 00:00:00+00	\N	Card show in Fort Wayne at Indiana Wesleyan Univ, 8211 W Jefferson Blvd	\N	\N	\N	active	\N	2025-06-20 21:24:17.983049+00	2025-06-20 21:24:18.030414+00	{}	{}
01c6f108-e905-4a11-b3fa-c80400b21929	Muncie Card Show	Muncie	Delaware Co Fairgrounds, 1210 N Wheeling Ave	2025-06-28 00:00:00+00	2025-06-28 00:00:00+00	\N	Card show in Muncie at Delaware Co Fairgrounds, 1210 N Wheeling Ave	\N	\N	\N	active	\N	2025-06-20 21:24:18.076596+00	2025-06-20 21:24:18.140789+00	{}	{}
c8b7627e-4bdf-4817-94f4-c174820fecdc	Indianapolis Card Show	Indianapolis	Evan’s Event Center, 1159 Country Club Rd	2025-06-29 00:00:00+00	2025-06-29 00:00:00+00	\N	Card show in Indianapolis at Evan’s Event Center, 1159 Country Club Rd	\N	\N	\N	active	\N	2025-06-20 21:24:18.19525+00	2025-06-20 21:24:18.247144+00	{}	{}
43c6b09b-8a70-4486-b4da-2a5d9e47b5f0	Lake Station Card Show	Lake Station	VFW, 2750 Central Ave	2025-06-29 00:00:00+00	2025-06-29 00:00:00+00	\N	Card show in Lake Station at VFW, 2750 Central Ave	\N	\N	\N	active	\N	2025-06-20 21:24:18.293206+00	2025-06-20 21:24:18.471509+00	{}	{}
10823913-5467-42a8-adff-2da450b617d3	Indianapolis Card Show	Indianapolis	LaQuinta Inn, 5120 Victory Drive	2025-07-05 00:00:00+00	2025-07-05 00:00:00+00	\N	Card show in Indianapolis at LaQuinta Inn, 5120 Victory Drive	\N	\N	\N	active	\N	2025-06-20 21:24:18.518508+00	2025-06-20 21:24:18.690598+00	{}	{}
d744f7c3-445f-4531-b7f4-dc6c2567ba89	South Bend Card Show	South Bend	American Legion Post 357 5414 W Sample St (10, 3) Haley	2025-07-05 00:00:00+00	2025-07-05 00:00:00+00	\N	Card show in South Bend at American Legion Post 357 5414 W Sample St (10, 3) Haley	\N	\N	\N	active	\N	2025-06-20 21:24:18.741021+00	2025-06-20 21:24:18.923191+00	{}	{}
ee734ced-83b4-44ad-8b3d-41c69bcfcef1	Noblesville Card Show	Noblesville	Moose Lodge, 950 Field Drive	2025-07-12 00:00:00+00	2025-07-12 00:00:00+00	\N	Card show in Noblesville at Moose Lodge, 950 Field Drive	\N	\N	\N	active	\N	2025-06-20 21:24:18.965471+00	2025-06-20 21:24:19.021896+00	{}	{}
c4904d35-9176-459e-bcd7-64e06cd417d8	Fort Wayne Card Show	Fort Wayne	Allen Co. Fairgrounds, 2726 Carroll Rd	2025-07-12 00:00:00+00	2025-07-12 00:00:00+00	\N	Card show in Fort Wayne at Allen Co. Fairgrounds, 2726 Carroll Rd	\N	\N	\N	active	\N	2025-06-20 21:24:19.093596+00	2025-06-20 21:24:19.143085+00	{}	{}
e5c8ef1e-be01-4255-8270-2bf7cfb6e0cc	Fishers Card Show	Fishers	American Legion #470, 9091 East 126th St.	2025-07-19 00:00:00+00	2025-07-19 00:00:00+00	\N	Card show in Fishers at American Legion #470, 9091 East 126th St.	\N	\N	\N	active	\N	2025-06-20 21:24:19.187936+00	2025-06-20 21:24:19.354874+00	{}	{}
d4c69b9a-a4eb-4037-afd9-13557363f0be	Michigan City Card Show	Michigan City	FOP Lodge, 416 US Highway 20	2025-07-19 00:00:00+00	2025-07-19 00:00:00+00	\N	Card show in Michigan City at FOP Lodge, 416 US Highway 20	\N	\N	\N	active	\N	2025-06-20 21:24:19.41158+00	2025-06-20 21:24:19.46394+00	{}	{}
55946ecc-3f53-4fbb-9671-1ba03804c6a8	Marion Card Show	Marion	4, H Expo Center – 1403 E. S.R.18	2025-07-19 00:00:00+00	2025-07-19 00:00:00+00	\N	Card show in Marion at 4, H Expo Center – 1403 E. S.R.18	\N	\N	\N	active	\N	2025-06-20 21:24:19.519999+00	2025-06-20 21:24:19.578029+00	{}	{}
edaeed47-50d5-41c6-b7a6-c7d8c3f4f935	Schererville Card Show	Schererville	Villa Cesare, 900 Eagle Ridge Drive	2025-07-19 00:00:00+00	2025-07-19 00:00:00+00	\N	Card show in Schererville at Villa Cesare, 900 Eagle Ridge Drive	\N	\N	\N	active	\N	2025-06-20 21:24:19.6313+00	2025-06-20 21:24:19.798928+00	{}	{}
99f92750-c620-4ccc-b338-06e8c3b461e2	Huntington Card Show	Huntington	Fairgrounds Community Building, 631 E Taylor St	2025-07-26 00:00:00+00	2025-07-26 00:00:00+00	\N	Card show in Huntington at Fairgrounds Community Building, 631 E Taylor St	\N	\N	\N	active	\N	2025-06-20 21:24:19.853418+00	2025-06-20 21:24:20.033832+00	{}	{}
ff766ebe-4863-4d3d-bdb3-7c2e985b5ccc	Indianapolis Card Show	Indianapolis	Evan’s Event Center, 1159 Country Club Rd	2025-07-27 00:00:00+00	2025-07-27 00:00:00+00	\N	Card show in Indianapolis at Evan’s Event Center, 1159 Country Club Rd	\N	\N	\N	active	\N	2025-06-20 21:24:20.0757+00	2025-06-20 21:24:20.129209+00	{}	{}
93a20492-286b-4999-b24a-76295d34474d	Lake Station Card Show	Lake Station	VFW, 2750 Central Ave	2025-07-27 00:00:00+00	2025-07-27 00:00:00+00	\N	Card show in Lake Station at VFW, 2750 Central Ave	\N	\N	\N	active	\N	2025-06-20 21:24:20.171609+00	2025-06-20 21:24:20.230025+00	{}	{}
22d45c5e-6172-4954-b8e2-c404e5a4cb2b	The 45th National Sports Collectors ConventionDonald E. Stephens Convention Center	Rosemont, IL	Rosemont, IL	2025-06-30 00:00:00+00	2025-06-30 00:00:00+00	\N	0 Skip to Content Home Chicago 2025 What to Expect National Experiences Interactive Map Show Hours Hotels Transportation Corporate Sponsors Mobility Aid Equipment Rentals Shipping Services Floorplan D	\N	\N	\N	active	\N	2025-06-20 21:24:20.278842+00	2025-06-20 21:24:20.32646+00	{}	{}
88673c49-ad4b-4bab-aa90-2a5bb59ecefe	The 45th National Sports Collectors ConventionDonald E. Stephens Convention Center	Rosemont, IL	Rosemont, IL	2025-06-30 00:00:00+00	2025-06-30 00:00:00+00	\N	0 Skip to Content Home Chicago 2025 What to Expect National Experiences Interactive Map Show Hours Hotels Transportation Corporate Sponsors Mobility Aid Equipment Rentals Shipping Services Floorplan D	\N	\N	\N	active	\N	2025-06-20 21:24:20.375564+00	2025-06-20 21:24:20.610517+00	{}	{}
c4facf13-6181-4a65-9dbe-b75ced01d001	The 45th National Sports Collectors ConventionDonald E. Stephens Convention Cent	Rosemont, IL	Rosemont, IL	2025-08-03 00:00:00+00	2025-08-03 00:00:00+00	\N	The 45th National Sports Collectors ConventionDonald E. Stephens Convention CenterJuly 30th - August 3rd, 2025 Rosemont, IL	\N	\N	\N	active	\N	2025-06-20 21:24:20.663432+00	2025-06-20 21:24:20.729282+00	{}	{}
73c8ab07-0a32-4e80-9891-f37101701b5c	saturday, june 28hickory, North Carolina sports cards, toys, pokemon, & collecti	Hickory, NC	Hickory, NC	2025-06-28 00:00:00+00	2025-06-28 00:00:00+00	\N	saturday, june 28hickory, North Carolina sports cards, toys, pokemon, & collectibles showhickory metro convention centerAddress: 1960 13th Ave Dr SE #5186Hickory, NC 28602Saturday: 9am - 4pm$5 Daily A	\N	\N	\N	active	\N	2025-06-20 21:24:20.784433+00	2025-06-20 21:24:20.83711+00	{}	{}
c23c297b-2707-474e-91f4-c092900226f9	January 4 & 5Raleigh, North CarolinaSports Cards, Toys, Pokémon, & Collectibles	Exposition Center, NC	Exposition Center, NC	2026-01-04 00:00:00+00	2026-01-04 00:00:00+00	\N	January 4 & 5Raleigh, North CarolinaSports Cards, Toys, Pokémon, & Collectibles ShowExposition Center, NC State FairgroundsSaturday, 9a-4p, Sunday 10a-3p$5 Adults, $7 Weekend Pass, 10 & Under Free, F	\N	\N	\N	active	\N	2025-06-20 21:24:20.881336+00	2025-06-20 21:24:20.939585+00	{}	{}
d664ed40-dda2-484b-ad31-7ca57d0eca80	May 31 & June 1Raleigh, North CarolinaSports Cards, Toys, Pokémon, & Collectible	Exposition Center, NC	Exposition Center, NC	2026-05-31 00:00:00+00	2026-05-31 00:00:00+00	\N	May 31 & June 1Raleigh, North CarolinaSports Cards, Toys, Pokémon, & Collectibles ShowExposition Center, NC State FairgroundsSaturday, 9a-4p, Sunday 10a-3p$5 Adults, $7 Weekend Pass, 10 & Under Free,	\N	\N	\N	active	\N	2025-06-20 21:24:20.984597+00	2025-06-20 21:24:21.032597+00	{}	{}
be42e1b5-3fc2-4965-86d5-a416014bc133	September 13 & 14Raleigh, North CarolinaSports Cards & Pokémon ShowKerr Scott Bu	Kerr Scott Building, NC	Kerr Scott Building, NC	2025-09-13 00:00:00+00	2025-09-13 00:00:00+00	\N	September 13 & 14Raleigh, North CarolinaSports Cards & Pokémon ShowKerr Scott Building, NC State FairgroundsSaturday, 9a-4p, Sunday 10a-3p$5 Adults, $7 Weekend Pass, 10 & Under Free, Free Parking	\N	\N	\N	active	\N	2025-06-20 21:24:21.090833+00	2025-06-20 21:24:21.151662+00	{}	{}
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: supabase_admin
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: user_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_cards (id, userid, imageurl, title, description, category, iscompressed, createdat, updatedat) FROM stdin;
\.


--
-- Data for Name: want_lists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.want_lists (id, userid, content, createdat, updatedat) FROM stdin;
bd234221-4552-4698-8c72-2736d44b1ec6	84ec4c75-1c32-46f6-b0bb-7930869a4c81	I want to bulk buy 1st Bowman chromes	2025-06-20 17:07:11.955+00	2025-06-20 17:07:11.955+00
\.


--
-- Data for Name: zip_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zip_codes (zip_code, city, state, latitude, longitude, created_at) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2025-06-17 20:08:52
20211116045059	2025-06-17 20:08:52
20211116050929	2025-06-17 20:08:52
20211116051442	2025-06-17 20:08:52
20211116212300	2025-06-17 20:08:53
20211116213355	2025-06-17 20:08:53
20211116213934	2025-06-17 20:08:53
20211116214523	2025-06-17 20:08:53
20211122062447	2025-06-17 20:08:53
20211124070109	2025-06-17 20:08:53
20211202204204	2025-06-17 20:08:54
20211202204605	2025-06-17 20:08:54
20211210212804	2025-06-17 20:08:54
20211228014915	2025-06-17 20:08:55
20220107221237	2025-06-17 20:08:55
20220228202821	2025-06-17 20:08:55
20220312004840	2025-06-17 20:08:56
20220603231003	2025-06-17 20:08:56
20220603232444	2025-06-17 20:08:56
20220615214548	2025-06-17 20:08:56
20220712093339	2025-06-17 20:08:57
20220908172859	2025-06-17 20:08:57
20220916233421	2025-06-17 20:08:57
20230119133233	2025-06-17 20:08:57
20230128025114	2025-06-17 20:08:57
20230128025212	2025-06-17 20:08:58
20230227211149	2025-06-17 20:08:58
20230228184745	2025-06-17 20:08:58
20230308225145	2025-06-17 20:08:58
20230328144023	2025-06-17 20:08:58
20231018144023	2025-06-17 20:08:59
20231204144023	2025-06-17 20:08:59
20231204144024	2025-06-17 20:08:59
20231204144025	2025-06-17 20:08:59
20240108234812	2025-06-17 20:09:00
20240109165339	2025-06-17 20:09:00
20240227174441	2025-06-17 20:09:00
20240311171622	2025-06-17 20:09:00
20240321100241	2025-06-17 20:09:01
20240401105812	2025-06-17 20:09:01
20240418121054	2025-06-17 20:09:02
20240523004032	2025-06-17 20:09:02
20240618124746	2025-06-17 20:09:03
20240801235015	2025-06-17 20:09:03
20240805133720	2025-06-17 20:09:03
20240827160934	2025-06-17 20:09:03
20240919163303	2025-06-17 20:09:03
20240919163305	2025-06-17 20:09:04
20241019105805	2025-06-17 20:09:04
20241030150047	2025-06-17 20:09:04
20241108114728	2025-06-17 20:09:05
20241121104152	2025-06-17 20:09:05
20241130184212	2025-06-17 20:09:05
20241220035512	2025-06-17 20:09:05
20241220123912	2025-06-17 20:09:05
20241224161212	2025-06-17 20:09:06
20250107150512	2025-06-17 20:09:06
20250110162412	2025-06-17 20:09:06
20250123174212	2025-06-17 20:09:06
20250128220012	2025-06-17 20:09:06
20250506224012	2025-06-17 20:09:07
20250523164012	2025-06-17 20:09:07
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id) FROM stdin;
card_images	Card Images	\N	2025-06-20 16:30:54.208998+00	2025-06-20 16:30:54.208998+00	t	f	\N	\N	\N
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2025-06-17 20:08:53.60749
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2025-06-17 20:08:53.617457
2	storage-schema	5c7968fd083fcea04050c1b7f6253c9771b99011	2025-06-17 20:08:53.629465
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2025-06-17 20:08:53.64759
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2025-06-17 20:08:53.670611
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2025-06-17 20:08:53.67891
6	change-column-name-in-get-size	f93f62afdf6613ee5e7e815b30d02dc990201044	2025-06-17 20:08:53.69038
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2025-06-17 20:08:53.699279
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2025-06-17 20:08:53.705895
9	fix-search-function	3a0af29f42e35a4d101c259ed955b67e1bee6825	2025-06-17 20:08:53.721264
10	search-files-search-function	68dc14822daad0ffac3746a502234f486182ef6e	2025-06-17 20:08:53.738128
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2025-06-17 20:08:53.785415
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2025-06-17 20:08:53.80014
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2025-06-17 20:08:53.807418
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2025-06-17 20:08:53.815034
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2025-06-17 20:08:53.846874
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2025-06-17 20:08:53.861953
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2025-06-17 20:08:53.872846
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2025-06-17 20:08:53.887023
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2025-06-17 20:08:53.896209
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2025-06-17 20:08:53.903754
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2025-06-17 20:08:53.918287
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2025-06-17 20:08:53.947494
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2025-06-17 20:08:53.983974
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2025-06-17 20:08:53.991204
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2025-06-17 20:08:54.001343
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 57, true);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: supabase_admin
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: card_shows card_shows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_shows
    ADD CONSTRAINT card_shows_pkey PRIMARY KEY (id);


--
-- Name: dealer_profiles dealer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_profiles
    ADD CONSTRAINT dealer_profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: shared_want_lists shared_want_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shared_want_lists
    ADD CONSTRAINT shared_want_lists_pkey PRIMARY KEY (id);


--
-- Name: shared_want_lists shared_want_lists_userid_showid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shared_want_lists
    ADD CONSTRAINT shared_want_lists_userid_showid_key UNIQUE (userid, showid);


--
-- Name: show_participants show_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.show_participants
    ADD CONSTRAINT show_participants_pkey PRIMARY KEY (id);


--
-- Name: show_participants show_participants_userid_showid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.show_participants
    ADD CONSTRAINT show_participants_userid_showid_key UNIQUE (userid, showid);


--
-- Name: shows shows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_pkey PRIMARY KEY (id);


--
-- Name: dealer_profiles unique_user_dealer_profile; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_profiles
    ADD CONSTRAINT unique_user_dealer_profile UNIQUE (user_id);


--
-- Name: user_cards user_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_cards
    ADD CONSTRAINT user_cards_pkey PRIMARY KEY (id);


--
-- Name: want_lists want_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.want_lists
    ADD CONSTRAINT want_lists_pkey PRIMARY KEY (id);


--
-- Name: want_lists want_lists_userid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.want_lists
    ADD CONSTRAINT want_lists_userid_key UNIQUE (userid);


--
-- Name: zip_codes zip_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zip_codes
    ADD CONSTRAINT zip_codes_pkey PRIMARY KEY (zip_code);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: dealer_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dealer_profiles_user_id_idx ON public.dealer_profiles USING btree (user_id);


--
-- Name: idx_card_shows_coordinate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_card_shows_coordinate ON public.card_shows USING gist (coordinate);


--
-- Name: idx_card_shows_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_card_shows_dates ON public.card_shows USING gist (dates);


--
-- Name: idx_card_shows_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_card_shows_location ON public.card_shows USING btree (location);


--
-- Name: idx_card_shows_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_card_shows_status ON public.card_shows USING btree (status);


--
-- Name: idx_profiles_account_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_account_type ON public.profiles USING btree (account_type);


--
-- Name: idx_profiles_subscription_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_subscription_status ON public.profiles USING btree (subscription_status);


--
-- Name: idx_shared_want_lists_show_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shared_want_lists_show_id ON public.shared_want_lists USING btree (showid);


--
-- Name: idx_shared_want_lists_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shared_want_lists_user_id ON public.shared_want_lists USING btree (userid);


--
-- Name: idx_shared_want_lists_want_list_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shared_want_lists_want_list_id ON public.shared_want_lists USING btree (wantlistid);


--
-- Name: idx_show_participants_show_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_show_participants_show_id ON public.show_participants USING btree (showid);


--
-- Name: idx_show_participants_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_show_participants_user_id ON public.show_participants USING btree (userid);


--
-- Name: idx_user_cards_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_cards_user_id ON public.user_cards USING btree (userid);


--
-- Name: idx_want_lists_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_want_lists_user_id ON public.want_lists USING btree (userid);


--
-- Name: show_coordinates_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX show_coordinates_idx ON public.shows USING gist (coordinates);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: dealer_profiles set_dealer_profile_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_dealer_profile_updated_at BEFORE UPDATE ON public.dealer_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_dealer_profile_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: card_shows card_shows_promoter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_shows
    ADD CONSTRAINT card_shows_promoter_id_fkey FOREIGN KEY (promoter_id) REFERENCES public.profiles(id);


--
-- Name: dealer_profiles dealer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dealer_profiles
    ADD CONSTRAINT dealer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: shared_want_lists shared_want_lists_showid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shared_want_lists
    ADD CONSTRAINT shared_want_lists_showid_fkey FOREIGN KEY (showid) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: shared_want_lists shared_want_lists_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shared_want_lists
    ADD CONSTRAINT shared_want_lists_userid_fkey FOREIGN KEY (userid) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shared_want_lists shared_want_lists_wantlistid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shared_want_lists
    ADD CONSTRAINT shared_want_lists_wantlistid_fkey FOREIGN KEY (wantlistid) REFERENCES public.want_lists(id) ON DELETE CASCADE;


--
-- Name: show_participants show_participants_showid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.show_participants
    ADD CONSTRAINT show_participants_showid_fkey FOREIGN KEY (showid) REFERENCES public.shows(id) ON DELETE CASCADE;


--
-- Name: show_participants show_participants_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.show_participants
    ADD CONSTRAINT show_participants_userid_fkey FOREIGN KEY (userid) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shows shows_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shows
    ADD CONSTRAINT shows_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id);


--
-- Name: user_cards user_cards_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_cards
    ADD CONSTRAINT user_cards_userid_fkey FOREIGN KEY (userid) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: want_lists want_lists_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.want_lists
    ADD CONSTRAINT want_lists_userid_fkey FOREIGN KEY (userid) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: dealer_profiles Allow anyone to read dealer profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anyone to read dealer profiles" ON public.dealer_profiles FOR SELECT TO authenticated, anon USING (true);


--
-- Name: shows Allow anyone to read shows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anyone to read shows" ON public.shows FOR SELECT TO authenticated, anon USING (true);


--
-- Name: zip_codes Allow anyone to read zip codes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anyone to read zip codes" ON public.zip_codes FOR SELECT TO authenticated, anon USING (true);


--
-- Name: shows Allow authenticated users to create shows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users to create shows" ON public.shows FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: shows Allow organizers to delete their own shows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow organizers to delete their own shows" ON public.shows FOR DELETE TO authenticated USING ((organizer_id = auth.uid()));


--
-- Name: shows Allow organizers to update their own shows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow organizers to update their own shows" ON public.shows FOR UPDATE TO authenticated USING ((organizer_id = auth.uid()));


--
-- Name: card_shows Allow read access to approved shows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow read access to approved shows" ON public.card_shows FOR SELECT TO authenticated USING ((status = 'active'::text));


--
-- Name: card_shows Allow service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow service role full access" ON public.card_shows TO service_role USING (true);


--
-- Name: dealer_profiles Allow users to delete their own dealer profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to delete their own dealer profile" ON public.dealer_profiles FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: dealer_profiles Allow users to insert their own dealer profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to insert their own dealer profile" ON public.dealer_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Allow users to insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Allow users to read all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to read all profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);


--
-- Name: dealer_profiles Allow users to update their own dealer profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to update their own dealer profile" ON public.dealer_profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Allow users to update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: card_shows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.card_shows ENABLE ROW LEVEL SECURITY;

--
-- Name: dealer_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dealer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_want_lists; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.shared_want_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_want_lists shared_want_lists_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shared_want_lists_policy ON public.shared_want_lists USING ((auth.uid() = userid));


--
-- Name: show_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.show_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: show_participants show_participants_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY show_participants_policy ON public.show_participants USING ((auth.uid() = userid));


--
-- Name: show_participants show_participants_select_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY show_participants_select_policy ON public.show_participants FOR SELECT USING (true);


--
-- Name: shows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;

--
-- Name: user_cards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: user_cards user_cards_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_cards_policy ON public.user_cards USING ((auth.uid() = userid));


--
-- Name: want_lists; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.want_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: want_lists want_lists_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY want_lists_policy ON public.want_lists USING ((auth.uid() = userid));


--
-- Name: zip_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.zip_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Public read access for card images; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Public read access for card images" ON storage.objects FOR SELECT USING ((bucket_id = 'card_images'::text));


--
-- Name: objects Users can delete their own card images; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Users can delete their own card images" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'card_images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


--
-- Name: objects Users can update their own card images; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Users can update their own card images" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'card_images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


--
-- Name: objects Users can upload their own card images; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--

CREATE POLICY "Users can upload their own card images" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'card_images'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION box2d_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box2d_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.box2d_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.box2d_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.box2d_in(cstring) TO service_role;


--
-- Name: FUNCTION box2d_out(public.box2d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box2d_out(public.box2d) TO postgres;
GRANT ALL ON FUNCTION public.box2d_out(public.box2d) TO anon;
GRANT ALL ON FUNCTION public.box2d_out(public.box2d) TO authenticated;
GRANT ALL ON FUNCTION public.box2d_out(public.box2d) TO service_role;


--
-- Name: FUNCTION box2df_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box2df_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.box2df_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.box2df_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.box2df_in(cstring) TO service_role;


--
-- Name: FUNCTION box2df_out(public.box2df); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box2df_out(public.box2df) TO postgres;
GRANT ALL ON FUNCTION public.box2df_out(public.box2df) TO anon;
GRANT ALL ON FUNCTION public.box2df_out(public.box2df) TO authenticated;
GRANT ALL ON FUNCTION public.box2df_out(public.box2df) TO service_role;


--
-- Name: FUNCTION box3d_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box3d_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.box3d_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.box3d_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.box3d_in(cstring) TO service_role;


--
-- Name: FUNCTION box3d_out(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box3d_out(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.box3d_out(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.box3d_out(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.box3d_out(public.box3d) TO service_role;


--
-- Name: FUNCTION geography_analyze(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_analyze(internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_analyze(internal) TO anon;
GRANT ALL ON FUNCTION public.geography_analyze(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_analyze(internal) TO service_role;


--
-- Name: FUNCTION geography_in(cstring, oid, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_in(cstring, oid, integer) TO postgres;
GRANT ALL ON FUNCTION public.geography_in(cstring, oid, integer) TO anon;
GRANT ALL ON FUNCTION public.geography_in(cstring, oid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.geography_in(cstring, oid, integer) TO service_role;


--
-- Name: FUNCTION geography_out(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_out(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_out(public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_out(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_out(public.geography) TO service_role;


--
-- Name: FUNCTION geography_recv(internal, oid, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_recv(internal, oid, integer) TO postgres;
GRANT ALL ON FUNCTION public.geography_recv(internal, oid, integer) TO anon;
GRANT ALL ON FUNCTION public.geography_recv(internal, oid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.geography_recv(internal, oid, integer) TO service_role;


--
-- Name: FUNCTION geography_send(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_send(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_send(public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_send(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_send(public.geography) TO service_role;


--
-- Name: FUNCTION geography_typmod_in(cstring[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_typmod_in(cstring[]) TO postgres;
GRANT ALL ON FUNCTION public.geography_typmod_in(cstring[]) TO anon;
GRANT ALL ON FUNCTION public.geography_typmod_in(cstring[]) TO authenticated;
GRANT ALL ON FUNCTION public.geography_typmod_in(cstring[]) TO service_role;


--
-- Name: FUNCTION geography_typmod_out(integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_typmod_out(integer) TO postgres;
GRANT ALL ON FUNCTION public.geography_typmod_out(integer) TO anon;
GRANT ALL ON FUNCTION public.geography_typmod_out(integer) TO authenticated;
GRANT ALL ON FUNCTION public.geography_typmod_out(integer) TO service_role;


--
-- Name: FUNCTION geometry_analyze(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_analyze(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_analyze(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_analyze(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_analyze(internal) TO service_role;


--
-- Name: FUNCTION geometry_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.geometry_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.geometry_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_in(cstring) TO service_role;


--
-- Name: FUNCTION geometry_out(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_out(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_out(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_out(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_out(public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_recv(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_recv(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_recv(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_recv(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_recv(internal) TO service_role;


--
-- Name: FUNCTION geometry_send(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_send(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_send(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_send(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_send(public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_typmod_in(cstring[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_typmod_in(cstring[]) TO postgres;
GRANT ALL ON FUNCTION public.geometry_typmod_in(cstring[]) TO anon;
GRANT ALL ON FUNCTION public.geometry_typmod_in(cstring[]) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_typmod_in(cstring[]) TO service_role;


--
-- Name: FUNCTION geometry_typmod_out(integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_typmod_out(integer) TO postgres;
GRANT ALL ON FUNCTION public.geometry_typmod_out(integer) TO anon;
GRANT ALL ON FUNCTION public.geometry_typmod_out(integer) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_typmod_out(integer) TO service_role;


--
-- Name: FUNCTION gidx_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gidx_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.gidx_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.gidx_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.gidx_in(cstring) TO service_role;


--
-- Name: FUNCTION gidx_out(public.gidx); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gidx_out(public.gidx) TO postgres;
GRANT ALL ON FUNCTION public.gidx_out(public.gidx) TO anon;
GRANT ALL ON FUNCTION public.gidx_out(public.gidx) TO authenticated;
GRANT ALL ON FUNCTION public.gidx_out(public.gidx) TO service_role;


--
-- Name: FUNCTION spheroid_in(cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.spheroid_in(cstring) TO postgres;
GRANT ALL ON FUNCTION public.spheroid_in(cstring) TO anon;
GRANT ALL ON FUNCTION public.spheroid_in(cstring) TO authenticated;
GRANT ALL ON FUNCTION public.spheroid_in(cstring) TO service_role;


--
-- Name: FUNCTION spheroid_out(public.spheroid); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.spheroid_out(public.spheroid) TO postgres;
GRANT ALL ON FUNCTION public.spheroid_out(public.spheroid) TO anon;
GRANT ALL ON FUNCTION public.spheroid_out(public.spheroid) TO authenticated;
GRANT ALL ON FUNCTION public.spheroid_out(public.spheroid) TO service_role;


--
-- Name: FUNCTION box3d(public.box2d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box3d(public.box2d) TO postgres;
GRANT ALL ON FUNCTION public.box3d(public.box2d) TO anon;
GRANT ALL ON FUNCTION public.box3d(public.box2d) TO authenticated;
GRANT ALL ON FUNCTION public.box3d(public.box2d) TO service_role;


--
-- Name: FUNCTION geometry(public.box2d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(public.box2d) TO postgres;
GRANT ALL ON FUNCTION public.geometry(public.box2d) TO anon;
GRANT ALL ON FUNCTION public.geometry(public.box2d) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(public.box2d) TO service_role;


--
-- Name: FUNCTION box(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.box(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.box(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.box(public.box3d) TO service_role;


--
-- Name: FUNCTION box2d(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box2d(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.box2d(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.box2d(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.box2d(public.box3d) TO service_role;


--
-- Name: FUNCTION geometry(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.geometry(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.geometry(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(public.box3d) TO service_role;


--
-- Name: FUNCTION geography(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography(bytea) TO postgres;
GRANT ALL ON FUNCTION public.geography(bytea) TO anon;
GRANT ALL ON FUNCTION public.geography(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.geography(bytea) TO service_role;


--
-- Name: FUNCTION geometry(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(bytea) TO postgres;
GRANT ALL ON FUNCTION public.geometry(bytea) TO anon;
GRANT ALL ON FUNCTION public.geometry(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(bytea) TO service_role;


--
-- Name: FUNCTION bytea(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.bytea(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.bytea(public.geography) TO anon;
GRANT ALL ON FUNCTION public.bytea(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.bytea(public.geography) TO service_role;


--
-- Name: FUNCTION geography(public.geography, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography(public.geography, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.geography(public.geography, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.geography(public.geography, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.geography(public.geography, integer, boolean) TO service_role;


--
-- Name: FUNCTION geometry(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geometry(public.geography) TO anon;
GRANT ALL ON FUNCTION public.geometry(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(public.geography) TO service_role;


--
-- Name: FUNCTION box(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.box(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.box(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.box(public.geometry) TO service_role;


--
-- Name: FUNCTION box2d(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box2d(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.box2d(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.box2d(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.box2d(public.geometry) TO service_role;


--
-- Name: FUNCTION box3d(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box3d(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.box3d(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.box3d(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.box3d(public.geometry) TO service_role;


--
-- Name: FUNCTION bytea(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.bytea(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.bytea(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.bytea(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.bytea(public.geometry) TO service_role;


--
-- Name: FUNCTION geography(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geography(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geography(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geography(public.geometry) TO service_role;


--
-- Name: FUNCTION geometry(public.geometry, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(public.geometry, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.geometry(public.geometry, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.geometry(public.geometry, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(public.geometry, integer, boolean) TO service_role;


--
-- Name: FUNCTION "json"(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public."json"(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public."json"(public.geometry) TO anon;
GRANT ALL ON FUNCTION public."json"(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public."json"(public.geometry) TO service_role;


--
-- Name: FUNCTION jsonb(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.jsonb(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.jsonb(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.jsonb(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.jsonb(public.geometry) TO service_role;


--
-- Name: FUNCTION path(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.path(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.path(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.path(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.path(public.geometry) TO service_role;


--
-- Name: FUNCTION point(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.point(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.point(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.point(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.point(public.geometry) TO service_role;


--
-- Name: FUNCTION polygon(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.polygon(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.polygon(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.polygon(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.polygon(public.geometry) TO service_role;


--
-- Name: FUNCTION text(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.text(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.text(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.text(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.text(public.geometry) TO service_role;


--
-- Name: FUNCTION geometry(path); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(path) TO postgres;
GRANT ALL ON FUNCTION public.geometry(path) TO anon;
GRANT ALL ON FUNCTION public.geometry(path) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(path) TO service_role;


--
-- Name: FUNCTION geometry(point); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(point) TO postgres;
GRANT ALL ON FUNCTION public.geometry(point) TO anon;
GRANT ALL ON FUNCTION public.geometry(point) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(point) TO service_role;


--
-- Name: FUNCTION geometry(polygon); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(polygon) TO postgres;
GRANT ALL ON FUNCTION public.geometry(polygon) TO anon;
GRANT ALL ON FUNCTION public.geometry(polygon) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(polygon) TO service_role;


--
-- Name: FUNCTION geometry(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry(text) TO postgres;
GRANT ALL ON FUNCTION public.geometry(text) TO anon;
GRANT ALL ON FUNCTION public.geometry(text) TO authenticated;
GRANT ALL ON FUNCTION public.geometry(text) TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT blk_read_time double precision, OUT blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT blk_read_time double precision, OUT blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT blk_read_time double precision, OUT blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT blk_read_time double precision, OUT blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint) TO dashboard_user;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO postgres;


--
-- Name: FUNCTION _postgis_deprecate(oldname text, newname text, version text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._postgis_deprecate(oldname text, newname text, version text) TO postgres;
GRANT ALL ON FUNCTION public._postgis_deprecate(oldname text, newname text, version text) TO anon;
GRANT ALL ON FUNCTION public._postgis_deprecate(oldname text, newname text, version text) TO authenticated;
GRANT ALL ON FUNCTION public._postgis_deprecate(oldname text, newname text, version text) TO service_role;


--
-- Name: FUNCTION _postgis_index_extent(tbl regclass, col text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._postgis_index_extent(tbl regclass, col text) TO postgres;
GRANT ALL ON FUNCTION public._postgis_index_extent(tbl regclass, col text) TO anon;
GRANT ALL ON FUNCTION public._postgis_index_extent(tbl regclass, col text) TO authenticated;
GRANT ALL ON FUNCTION public._postgis_index_extent(tbl regclass, col text) TO service_role;


--
-- Name: FUNCTION _postgis_join_selectivity(regclass, text, regclass, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._postgis_join_selectivity(regclass, text, regclass, text, text) TO postgres;
GRANT ALL ON FUNCTION public._postgis_join_selectivity(regclass, text, regclass, text, text) TO anon;
GRANT ALL ON FUNCTION public._postgis_join_selectivity(regclass, text, regclass, text, text) TO authenticated;
GRANT ALL ON FUNCTION public._postgis_join_selectivity(regclass, text, regclass, text, text) TO service_role;


--
-- Name: FUNCTION _postgis_pgsql_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._postgis_pgsql_version() TO postgres;
GRANT ALL ON FUNCTION public._postgis_pgsql_version() TO anon;
GRANT ALL ON FUNCTION public._postgis_pgsql_version() TO authenticated;
GRANT ALL ON FUNCTION public._postgis_pgsql_version() TO service_role;


--
-- Name: FUNCTION _postgis_scripts_pgsql_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._postgis_scripts_pgsql_version() TO postgres;
GRANT ALL ON FUNCTION public._postgis_scripts_pgsql_version() TO anon;
GRANT ALL ON FUNCTION public._postgis_scripts_pgsql_version() TO authenticated;
GRANT ALL ON FUNCTION public._postgis_scripts_pgsql_version() TO service_role;


--
-- Name: FUNCTION _postgis_selectivity(tbl regclass, att_name text, geom public.geometry, mode text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._postgis_selectivity(tbl regclass, att_name text, geom public.geometry, mode text) TO postgres;
GRANT ALL ON FUNCTION public._postgis_selectivity(tbl regclass, att_name text, geom public.geometry, mode text) TO anon;
GRANT ALL ON FUNCTION public._postgis_selectivity(tbl regclass, att_name text, geom public.geometry, mode text) TO authenticated;
GRANT ALL ON FUNCTION public._postgis_selectivity(tbl regclass, att_name text, geom public.geometry, mode text) TO service_role;


--
-- Name: FUNCTION _postgis_stats(tbl regclass, att_name text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._postgis_stats(tbl regclass, att_name text, text) TO postgres;
GRANT ALL ON FUNCTION public._postgis_stats(tbl regclass, att_name text, text) TO anon;
GRANT ALL ON FUNCTION public._postgis_stats(tbl regclass, att_name text, text) TO authenticated;
GRANT ALL ON FUNCTION public._postgis_stats(tbl regclass, att_name text, text) TO service_role;


--
-- Name: FUNCTION _st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public._st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public._st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public._st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION _st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public._st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public._st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public._st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION _st_3dintersects(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_3dintersects(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_3dintersects(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_3dintersects(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_3dintersects(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_asgml(integer, public.geometry, integer, integer, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_asgml(integer, public.geometry, integer, integer, text, text) TO postgres;
GRANT ALL ON FUNCTION public._st_asgml(integer, public.geometry, integer, integer, text, text) TO anon;
GRANT ALL ON FUNCTION public._st_asgml(integer, public.geometry, integer, integer, text, text) TO authenticated;
GRANT ALL ON FUNCTION public._st_asgml(integer, public.geometry, integer, integer, text, text) TO service_role;


--
-- Name: FUNCTION _st_asx3d(integer, public.geometry, integer, integer, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_asx3d(integer, public.geometry, integer, integer, text) TO postgres;
GRANT ALL ON FUNCTION public._st_asx3d(integer, public.geometry, integer, integer, text) TO anon;
GRANT ALL ON FUNCTION public._st_asx3d(integer, public.geometry, integer, integer, text) TO authenticated;
GRANT ALL ON FUNCTION public._st_asx3d(integer, public.geometry, integer, integer, text) TO service_role;


--
-- Name: FUNCTION _st_bestsrid(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_bestsrid(public.geography) TO postgres;
GRANT ALL ON FUNCTION public._st_bestsrid(public.geography) TO anon;
GRANT ALL ON FUNCTION public._st_bestsrid(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public._st_bestsrid(public.geography) TO service_role;


--
-- Name: FUNCTION _st_bestsrid(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_bestsrid(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public._st_bestsrid(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public._st_bestsrid(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public._st_bestsrid(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION _st_contains(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_contains(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_contains(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_contains(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_contains(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_containsproperly(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_containsproperly(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_containsproperly(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_containsproperly(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_containsproperly(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_coveredby(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_coveredby(geog1 public.geography, geog2 public.geography) TO postgres;
GRANT ALL ON FUNCTION public._st_coveredby(geog1 public.geography, geog2 public.geography) TO anon;
GRANT ALL ON FUNCTION public._st_coveredby(geog1 public.geography, geog2 public.geography) TO authenticated;
GRANT ALL ON FUNCTION public._st_coveredby(geog1 public.geography, geog2 public.geography) TO service_role;


--
-- Name: FUNCTION _st_coveredby(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_coveredby(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_coveredby(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_coveredby(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_coveredby(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_covers(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_covers(geog1 public.geography, geog2 public.geography) TO postgres;
GRANT ALL ON FUNCTION public._st_covers(geog1 public.geography, geog2 public.geography) TO anon;
GRANT ALL ON FUNCTION public._st_covers(geog1 public.geography, geog2 public.geography) TO authenticated;
GRANT ALL ON FUNCTION public._st_covers(geog1 public.geography, geog2 public.geography) TO service_role;


--
-- Name: FUNCTION _st_covers(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_covers(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_covers(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_covers(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_covers(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_crosses(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_crosses(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_crosses(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_crosses(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_crosses(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public._st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public._st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public._st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION _st_distancetree(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_distancetree(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public._st_distancetree(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public._st_distancetree(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public._st_distancetree(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION _st_distancetree(public.geography, public.geography, double precision, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_distancetree(public.geography, public.geography, double precision, boolean) TO postgres;
GRANT ALL ON FUNCTION public._st_distancetree(public.geography, public.geography, double precision, boolean) TO anon;
GRANT ALL ON FUNCTION public._st_distancetree(public.geography, public.geography, double precision, boolean) TO authenticated;
GRANT ALL ON FUNCTION public._st_distancetree(public.geography, public.geography, double precision, boolean) TO service_role;


--
-- Name: FUNCTION _st_distanceuncached(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION _st_distanceuncached(public.geography, public.geography, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, boolean) TO postgres;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, boolean) TO anon;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, boolean) TO authenticated;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, boolean) TO service_role;


--
-- Name: FUNCTION _st_distanceuncached(public.geography, public.geography, double precision, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, double precision, boolean) TO postgres;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, double precision, boolean) TO anon;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, double precision, boolean) TO authenticated;
GRANT ALL ON FUNCTION public._st_distanceuncached(public.geography, public.geography, double precision, boolean) TO service_role;


--
-- Name: FUNCTION _st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public._st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public._st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public._st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION _st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) TO postgres;
GRANT ALL ON FUNCTION public._st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) TO anon;
GRANT ALL ON FUNCTION public._st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) TO authenticated;
GRANT ALL ON FUNCTION public._st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) TO service_role;


--
-- Name: FUNCTION _st_dwithinuncached(public.geography, public.geography, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision) TO postgres;
GRANT ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision) TO anon;
GRANT ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision) TO authenticated;
GRANT ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision) TO service_role;


--
-- Name: FUNCTION _st_dwithinuncached(public.geography, public.geography, double precision, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision, boolean) TO postgres;
GRANT ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision, boolean) TO anon;
GRANT ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision, boolean) TO authenticated;
GRANT ALL ON FUNCTION public._st_dwithinuncached(public.geography, public.geography, double precision, boolean) TO service_role;


--
-- Name: FUNCTION _st_equals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_equals(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_equals(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_equals(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_equals(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_expand(public.geography, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_expand(public.geography, double precision) TO postgres;
GRANT ALL ON FUNCTION public._st_expand(public.geography, double precision) TO anon;
GRANT ALL ON FUNCTION public._st_expand(public.geography, double precision) TO authenticated;
GRANT ALL ON FUNCTION public._st_expand(public.geography, double precision) TO service_role;


--
-- Name: FUNCTION _st_geomfromgml(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_geomfromgml(text, integer) TO postgres;
GRANT ALL ON FUNCTION public._st_geomfromgml(text, integer) TO anon;
GRANT ALL ON FUNCTION public._st_geomfromgml(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public._st_geomfromgml(text, integer) TO service_role;


--
-- Name: FUNCTION _st_intersects(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_intersects(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_intersects(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_intersects(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_intersects(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_linecrossingdirection(line1 public.geometry, line2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_linecrossingdirection(line1 public.geometry, line2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_linecrossingdirection(line1 public.geometry, line2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_linecrossingdirection(line1 public.geometry, line2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_linecrossingdirection(line1 public.geometry, line2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_longestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_longestline(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_longestline(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_longestline(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_longestline(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_maxdistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_maxdistance(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_maxdistance(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_maxdistance(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_maxdistance(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_orderingequals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_orderingequals(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_orderingequals(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_orderingequals(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_orderingequals(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_overlaps(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_overlaps(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_overlaps(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_overlaps(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_overlaps(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_pointoutside(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_pointoutside(public.geography) TO postgres;
GRANT ALL ON FUNCTION public._st_pointoutside(public.geography) TO anon;
GRANT ALL ON FUNCTION public._st_pointoutside(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public._st_pointoutside(public.geography) TO service_role;


--
-- Name: FUNCTION _st_sortablehash(geom public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_sortablehash(geom public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_sortablehash(geom public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_sortablehash(geom public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_sortablehash(geom public.geometry) TO service_role;


--
-- Name: FUNCTION _st_touches(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_touches(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_touches(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_touches(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_touches(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION _st_voronoi(g1 public.geometry, clip public.geometry, tolerance double precision, return_polygons boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_voronoi(g1 public.geometry, clip public.geometry, tolerance double precision, return_polygons boolean) TO postgres;
GRANT ALL ON FUNCTION public._st_voronoi(g1 public.geometry, clip public.geometry, tolerance double precision, return_polygons boolean) TO anon;
GRANT ALL ON FUNCTION public._st_voronoi(g1 public.geometry, clip public.geometry, tolerance double precision, return_polygons boolean) TO authenticated;
GRANT ALL ON FUNCTION public._st_voronoi(g1 public.geometry, clip public.geometry, tolerance double precision, return_polygons boolean) TO service_role;


--
-- Name: FUNCTION _st_within(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public._st_within(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public._st_within(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public._st_within(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public._st_within(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION addauth(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.addauth(text) TO postgres;
GRANT ALL ON FUNCTION public.addauth(text) TO anon;
GRANT ALL ON FUNCTION public.addauth(text) TO authenticated;
GRANT ALL ON FUNCTION public.addauth(text) TO service_role;


--
-- Name: FUNCTION addgeometrycolumn(table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.addgeometrycolumn(table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) TO postgres;
GRANT ALL ON FUNCTION public.addgeometrycolumn(table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) TO anon;
GRANT ALL ON FUNCTION public.addgeometrycolumn(table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) TO authenticated;
GRANT ALL ON FUNCTION public.addgeometrycolumn(table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) TO service_role;


--
-- Name: FUNCTION addgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.addgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) TO postgres;
GRANT ALL ON FUNCTION public.addgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) TO anon;
GRANT ALL ON FUNCTION public.addgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) TO authenticated;
GRANT ALL ON FUNCTION public.addgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying, new_srid integer, new_type character varying, new_dim integer, use_typmod boolean) TO service_role;


--
-- Name: FUNCTION addgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer, new_type character varying, new_dim integer, use_typmod boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.addgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer, new_type character varying, new_dim integer, use_typmod boolean) TO postgres;
GRANT ALL ON FUNCTION public.addgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer, new_type character varying, new_dim integer, use_typmod boolean) TO anon;
GRANT ALL ON FUNCTION public.addgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer, new_type character varying, new_dim integer, use_typmod boolean) TO authenticated;
GRANT ALL ON FUNCTION public.addgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer, new_type character varying, new_dim integer, use_typmod boolean) TO service_role;


--
-- Name: FUNCTION box3dtobox(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.box3dtobox(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.box3dtobox(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.box3dtobox(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.box3dtobox(public.box3d) TO service_role;


--
-- Name: FUNCTION checkauth(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.checkauth(text, text) TO postgres;
GRANT ALL ON FUNCTION public.checkauth(text, text) TO anon;
GRANT ALL ON FUNCTION public.checkauth(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.checkauth(text, text) TO service_role;


--
-- Name: FUNCTION checkauth(text, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.checkauth(text, text, text) TO postgres;
GRANT ALL ON FUNCTION public.checkauth(text, text, text) TO anon;
GRANT ALL ON FUNCTION public.checkauth(text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.checkauth(text, text, text) TO service_role;


--
-- Name: FUNCTION checkauthtrigger(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.checkauthtrigger() TO postgres;
GRANT ALL ON FUNCTION public.checkauthtrigger() TO anon;
GRANT ALL ON FUNCTION public.checkauthtrigger() TO authenticated;
GRANT ALL ON FUNCTION public.checkauthtrigger() TO service_role;


--
-- Name: FUNCTION contains_2d(public.box2df, public.box2df); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.contains_2d(public.box2df, public.box2df) TO postgres;
GRANT ALL ON FUNCTION public.contains_2d(public.box2df, public.box2df) TO anon;
GRANT ALL ON FUNCTION public.contains_2d(public.box2df, public.box2df) TO authenticated;
GRANT ALL ON FUNCTION public.contains_2d(public.box2df, public.box2df) TO service_role;


--
-- Name: FUNCTION contains_2d(public.box2df, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.contains_2d(public.box2df, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.contains_2d(public.box2df, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.contains_2d(public.box2df, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.contains_2d(public.box2df, public.geometry) TO service_role;


--
-- Name: FUNCTION contains_2d(public.geometry, public.box2df); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.contains_2d(public.geometry, public.box2df) TO postgres;
GRANT ALL ON FUNCTION public.contains_2d(public.geometry, public.box2df) TO anon;
GRANT ALL ON FUNCTION public.contains_2d(public.geometry, public.box2df) TO authenticated;
GRANT ALL ON FUNCTION public.contains_2d(public.geometry, public.box2df) TO service_role;


--
-- Name: FUNCTION debug_wkb_coordinates(wkb_hex text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.debug_wkb_coordinates(wkb_hex text) TO anon;
GRANT ALL ON FUNCTION public.debug_wkb_coordinates(wkb_hex text) TO authenticated;
GRANT ALL ON FUNCTION public.debug_wkb_coordinates(wkb_hex text) TO service_role;


--
-- Name: FUNCTION disablelongtransactions(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.disablelongtransactions() TO postgres;
GRANT ALL ON FUNCTION public.disablelongtransactions() TO anon;
GRANT ALL ON FUNCTION public.disablelongtransactions() TO authenticated;
GRANT ALL ON FUNCTION public.disablelongtransactions() TO service_role;


--
-- Name: FUNCTION dropgeometrycolumn(table_name character varying, column_name character varying); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.dropgeometrycolumn(table_name character varying, column_name character varying) TO postgres;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(table_name character varying, column_name character varying) TO anon;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(table_name character varying, column_name character varying) TO authenticated;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(table_name character varying, column_name character varying) TO service_role;


--
-- Name: FUNCTION dropgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.dropgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying) TO postgres;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying) TO anon;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying) TO authenticated;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(schema_name character varying, table_name character varying, column_name character varying) TO service_role;


--
-- Name: FUNCTION dropgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.dropgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying) TO postgres;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying) TO anon;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying) TO authenticated;
GRANT ALL ON FUNCTION public.dropgeometrycolumn(catalog_name character varying, schema_name character varying, table_name character varying, column_name character varying) TO service_role;


--
-- Name: FUNCTION dropgeometrytable(table_name character varying); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.dropgeometrytable(table_name character varying) TO postgres;
GRANT ALL ON FUNCTION public.dropgeometrytable(table_name character varying) TO anon;
GRANT ALL ON FUNCTION public.dropgeometrytable(table_name character varying) TO authenticated;
GRANT ALL ON FUNCTION public.dropgeometrytable(table_name character varying) TO service_role;


--
-- Name: FUNCTION dropgeometrytable(schema_name character varying, table_name character varying); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.dropgeometrytable(schema_name character varying, table_name character varying) TO postgres;
GRANT ALL ON FUNCTION public.dropgeometrytable(schema_name character varying, table_name character varying) TO anon;
GRANT ALL ON FUNCTION public.dropgeometrytable(schema_name character varying, table_name character varying) TO authenticated;
GRANT ALL ON FUNCTION public.dropgeometrytable(schema_name character varying, table_name character varying) TO service_role;


--
-- Name: FUNCTION dropgeometrytable(catalog_name character varying, schema_name character varying, table_name character varying); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.dropgeometrytable(catalog_name character varying, schema_name character varying, table_name character varying) TO postgres;
GRANT ALL ON FUNCTION public.dropgeometrytable(catalog_name character varying, schema_name character varying, table_name character varying) TO anon;
GRANT ALL ON FUNCTION public.dropgeometrytable(catalog_name character varying, schema_name character varying, table_name character varying) TO authenticated;
GRANT ALL ON FUNCTION public.dropgeometrytable(catalog_name character varying, schema_name character varying, table_name character varying) TO service_role;


--
-- Name: FUNCTION enablelongtransactions(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.enablelongtransactions() TO postgres;
GRANT ALL ON FUNCTION public.enablelongtransactions() TO anon;
GRANT ALL ON FUNCTION public.enablelongtransactions() TO authenticated;
GRANT ALL ON FUNCTION public.enablelongtransactions() TO service_role;


--
-- Name: FUNCTION equals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.equals(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.equals(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.equals(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.equals(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: TABLE shows; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.shows TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.shows TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.shows TO service_role;


--
-- Name: FUNCTION find_filtered_shows(center_lat double precision, center_lng double precision, radius_miles double precision, start_date timestamp with time zone, end_date timestamp with time zone, max_entry_fee numeric, show_categories text[], show_features text[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.find_filtered_shows(center_lat double precision, center_lng double precision, radius_miles double precision, start_date timestamp with time zone, end_date timestamp with time zone, max_entry_fee numeric, show_categories text[], show_features text[]) TO anon;
GRANT ALL ON FUNCTION public.find_filtered_shows(center_lat double precision, center_lng double precision, radius_miles double precision, start_date timestamp with time zone, end_date timestamp with time zone, max_entry_fee numeric, show_categories text[], show_features text[]) TO authenticated;
GRANT ALL ON FUNCTION public.find_filtered_shows(center_lat double precision, center_lng double precision, radius_miles double precision, start_date timestamp with time zone, end_date timestamp with time zone, max_entry_fee numeric, show_categories text[], show_features text[]) TO service_role;


--
-- Name: FUNCTION find_shows_with_coordinates(lat double precision, lng double precision, radius_miles double precision); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.find_shows_with_coordinates(lat double precision, lng double precision, radius_miles double precision) TO anon;
GRANT ALL ON FUNCTION public.find_shows_with_coordinates(lat double precision, lng double precision, radius_miles double precision) TO authenticated;
GRANT ALL ON FUNCTION public.find_shows_with_coordinates(lat double precision, lng double precision, radius_miles double precision) TO service_role;


--
-- Name: FUNCTION find_shows_within_radius(center_lat double precision, center_lng double precision, radius_miles double precision); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.find_shows_within_radius(center_lat double precision, center_lng double precision, radius_miles double precision) TO anon;
GRANT ALL ON FUNCTION public.find_shows_within_radius(center_lat double precision, center_lng double precision, radius_miles double precision) TO authenticated;
GRANT ALL ON FUNCTION public.find_shows_within_radius(center_lat double precision, center_lng double precision, radius_miles double precision) TO service_role;


--
-- Name: FUNCTION find_srid(character varying, character varying, character varying); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.find_srid(character varying, character varying, character varying) TO postgres;
GRANT ALL ON FUNCTION public.find_srid(character varying, character varying, character varying) TO anon;
GRANT ALL ON FUNCTION public.find_srid(character varying, character varying, character varying) TO authenticated;
GRANT ALL ON FUNCTION public.find_srid(character varying, character varying, character varying) TO service_role;


--
-- Name: FUNCTION geog_brin_inclusion_add_value(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geog_brin_inclusion_add_value(internal, internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geog_brin_inclusion_add_value(internal, internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geog_brin_inclusion_add_value(internal, internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geog_brin_inclusion_add_value(internal, internal, internal, internal) TO service_role;


--
-- Name: FUNCTION geography_cmp(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_cmp(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_cmp(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_cmp(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_cmp(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION geography_distance_knn(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_distance_knn(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_distance_knn(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_distance_knn(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_distance_knn(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION geography_eq(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_eq(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_eq(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_eq(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_eq(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION geography_ge(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_ge(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_ge(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_ge(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_ge(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION geography_gist_compress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gist_compress(internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_gist_compress(internal) TO anon;
GRANT ALL ON FUNCTION public.geography_gist_compress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gist_compress(internal) TO service_role;


--
-- Name: FUNCTION geography_gist_consistent(internal, public.geography, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gist_consistent(internal, public.geography, integer) TO postgres;
GRANT ALL ON FUNCTION public.geography_gist_consistent(internal, public.geography, integer) TO anon;
GRANT ALL ON FUNCTION public.geography_gist_consistent(internal, public.geography, integer) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gist_consistent(internal, public.geography, integer) TO service_role;


--
-- Name: FUNCTION geography_gist_decompress(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gist_decompress(internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_gist_decompress(internal) TO anon;
GRANT ALL ON FUNCTION public.geography_gist_decompress(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gist_decompress(internal) TO service_role;


--
-- Name: FUNCTION geography_gist_distance(internal, public.geography, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gist_distance(internal, public.geography, integer) TO postgres;
GRANT ALL ON FUNCTION public.geography_gist_distance(internal, public.geography, integer) TO anon;
GRANT ALL ON FUNCTION public.geography_gist_distance(internal, public.geography, integer) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gist_distance(internal, public.geography, integer) TO service_role;


--
-- Name: FUNCTION geography_gist_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gist_penalty(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_gist_penalty(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_gist_penalty(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gist_penalty(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION geography_gist_picksplit(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gist_picksplit(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_gist_picksplit(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_gist_picksplit(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gist_picksplit(internal, internal) TO service_role;


--
-- Name: FUNCTION geography_gist_same(public.box2d, public.box2d, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gist_same(public.box2d, public.box2d, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_gist_same(public.box2d, public.box2d, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_gist_same(public.box2d, public.box2d, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gist_same(public.box2d, public.box2d, internal) TO service_role;


--
-- Name: FUNCTION geography_gist_union(bytea, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gist_union(bytea, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_gist_union(bytea, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_gist_union(bytea, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gist_union(bytea, internal) TO service_role;


--
-- Name: FUNCTION geography_gt(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_gt(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_gt(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_gt(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_gt(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION geography_le(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_le(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_le(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_le(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_le(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION geography_lt(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_lt(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_lt(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_lt(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_lt(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION geography_overlaps(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_overlaps(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geography_overlaps(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.geography_overlaps(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geography_overlaps(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION geography_spgist_choose_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_spgist_choose_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_spgist_choose_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_spgist_choose_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_spgist_choose_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geography_spgist_compress_nd(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_spgist_compress_nd(internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_spgist_compress_nd(internal) TO anon;
GRANT ALL ON FUNCTION public.geography_spgist_compress_nd(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_spgist_compress_nd(internal) TO service_role;


--
-- Name: FUNCTION geography_spgist_config_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_spgist_config_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_spgist_config_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_spgist_config_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_spgist_config_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geography_spgist_inner_consistent_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_spgist_inner_consistent_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_spgist_inner_consistent_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_spgist_inner_consistent_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_spgist_inner_consistent_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geography_spgist_leaf_consistent_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_spgist_leaf_consistent_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_spgist_leaf_consistent_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_spgist_leaf_consistent_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_spgist_leaf_consistent_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geography_spgist_picksplit_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geography_spgist_picksplit_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geography_spgist_picksplit_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geography_spgist_picksplit_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geography_spgist_picksplit_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geom2d_brin_inclusion_add_value(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geom2d_brin_inclusion_add_value(internal, internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geom2d_brin_inclusion_add_value(internal, internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geom2d_brin_inclusion_add_value(internal, internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geom2d_brin_inclusion_add_value(internal, internal, internal, internal) TO service_role;


--
-- Name: FUNCTION geom3d_brin_inclusion_add_value(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geom3d_brin_inclusion_add_value(internal, internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geom3d_brin_inclusion_add_value(internal, internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geom3d_brin_inclusion_add_value(internal, internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geom3d_brin_inclusion_add_value(internal, internal, internal, internal) TO service_role;


--
-- Name: FUNCTION geom4d_brin_inclusion_add_value(internal, internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geom4d_brin_inclusion_add_value(internal, internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geom4d_brin_inclusion_add_value(internal, internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geom4d_brin_inclusion_add_value(internal, internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geom4d_brin_inclusion_add_value(internal, internal, internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_above(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_above(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_above(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_above(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_above(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_below(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_below(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_below(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_below(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_below(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_cmp(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_cmp(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_cmp(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_cmp(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_cmp(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_contained_3d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_contained_3d(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_contained_3d(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_contained_3d(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_contained_3d(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_contains(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_contains(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_contains(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_contains(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_contains(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_contains_3d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_contains_3d(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_contains_3d(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_contains_3d(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_contains_3d(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_contains_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_contains_nd(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_contains_nd(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_contains_nd(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_contains_nd(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_distance_box(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_distance_box(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_distance_box(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_distance_box(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_distance_box(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_distance_centroid(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_distance_centroid(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_distance_centroid(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_distance_centroid(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_distance_centroid(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_distance_centroid_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_distance_centroid_nd(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_distance_centroid_nd(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_distance_centroid_nd(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_distance_centroid_nd(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_distance_cpa(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_distance_cpa(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_distance_cpa(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_distance_cpa(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_distance_cpa(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_eq(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_eq(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_eq(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_eq(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_eq(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_ge(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_ge(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_ge(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_ge(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_ge(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_gist_compress_2d(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_compress_2d(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_compress_2d(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_compress_2d(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_compress_2d(internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_compress_nd(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_compress_nd(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_compress_nd(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_compress_nd(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_compress_nd(internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_consistent_2d(internal, public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_consistent_2d(internal, public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_consistent_2d(internal, public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_consistent_2d(internal, public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_consistent_2d(internal, public.geometry, integer) TO service_role;


--
-- Name: FUNCTION geometry_gist_consistent_nd(internal, public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_consistent_nd(internal, public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_consistent_nd(internal, public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_consistent_nd(internal, public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_consistent_nd(internal, public.geometry, integer) TO service_role;


--
-- Name: FUNCTION geometry_gist_decompress_2d(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_decompress_2d(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_decompress_2d(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_decompress_2d(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_decompress_2d(internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_decompress_nd(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_decompress_nd(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_decompress_nd(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_decompress_nd(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_decompress_nd(internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_distance_2d(internal, public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_distance_2d(internal, public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_distance_2d(internal, public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_distance_2d(internal, public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_distance_2d(internal, public.geometry, integer) TO service_role;


--
-- Name: FUNCTION geometry_gist_distance_nd(internal, public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_distance_nd(internal, public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_distance_nd(internal, public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_distance_nd(internal, public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_distance_nd(internal, public.geometry, integer) TO service_role;


--
-- Name: FUNCTION geometry_gist_penalty_2d(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_penalty_2d(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_penalty_2d(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_penalty_2d(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_penalty_2d(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_penalty_nd(internal, internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_penalty_nd(internal, internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_penalty_nd(internal, internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_penalty_nd(internal, internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_penalty_nd(internal, internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_picksplit_2d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_picksplit_2d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_picksplit_2d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_picksplit_2d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_picksplit_2d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_picksplit_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_picksplit_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_picksplit_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_picksplit_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_picksplit_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_same_2d(geom1 public.geometry, geom2 public.geometry, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_same_2d(geom1 public.geometry, geom2 public.geometry, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_same_2d(geom1 public.geometry, geom2 public.geometry, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_same_2d(geom1 public.geometry, geom2 public.geometry, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_same_2d(geom1 public.geometry, geom2 public.geometry, internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_same_nd(public.geometry, public.geometry, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_same_nd(public.geometry, public.geometry, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_same_nd(public.geometry, public.geometry, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_same_nd(public.geometry, public.geometry, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_same_nd(public.geometry, public.geometry, internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_sortsupport_2d(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_sortsupport_2d(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_sortsupport_2d(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_sortsupport_2d(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_sortsupport_2d(internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_union_2d(bytea, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_union_2d(bytea, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_union_2d(bytea, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_union_2d(bytea, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_union_2d(bytea, internal) TO service_role;


--
-- Name: FUNCTION geometry_gist_union_nd(bytea, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gist_union_nd(bytea, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gist_union_nd(bytea, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_gist_union_nd(bytea, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gist_union_nd(bytea, internal) TO service_role;


--
-- Name: FUNCTION geometry_gt(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_gt(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_gt(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_gt(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_gt(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_hash(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_hash(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_hash(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_hash(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_hash(public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_le(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_le(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_le(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_le(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_le(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_left(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_left(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_left(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_left(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_left(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_lt(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_lt(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_lt(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_lt(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_lt(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_overabove(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_overabove(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_overabove(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_overabove(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_overabove(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_overbelow(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_overbelow(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_overbelow(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_overbelow(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_overbelow(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_overlaps(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_overlaps(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_overlaps(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_overlaps(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_overlaps(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_overlaps_3d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_overlaps_3d(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_overlaps_3d(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_overlaps_3d(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_overlaps_3d(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_overlaps_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_overlaps_nd(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_overlaps_nd(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_overlaps_nd(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_overlaps_nd(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_overleft(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_overleft(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_overleft(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_overleft(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_overleft(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_overright(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_overright(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_overright(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_overright(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_overright(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_right(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_right(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_right(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_right(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_right(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_same(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_same(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_same(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_same(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_same(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_same_3d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_same_3d(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_same_3d(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_same_3d(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_same_3d(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_same_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_same_nd(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_same_nd(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_same_nd(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_same_nd(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_sortsupport(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_sortsupport(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_sortsupport(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_sortsupport(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_sortsupport(internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_choose_2d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_choose_2d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_2d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_2d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_2d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_choose_3d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_choose_3d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_3d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_3d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_3d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_choose_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_choose_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_choose_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_compress_2d(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_compress_2d(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_2d(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_2d(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_2d(internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_compress_3d(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_compress_3d(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_3d(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_3d(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_3d(internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_compress_nd(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_compress_nd(internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_nd(internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_nd(internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_compress_nd(internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_config_2d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_config_2d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_config_2d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_config_2d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_config_2d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_config_3d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_config_3d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_config_3d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_config_3d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_config_3d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_config_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_config_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_config_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_config_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_config_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_inner_consistent_2d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_2d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_2d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_2d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_2d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_inner_consistent_3d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_3d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_3d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_3d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_3d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_inner_consistent_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_inner_consistent_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_leaf_consistent_2d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_2d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_2d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_2d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_2d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_leaf_consistent_3d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_3d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_3d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_3d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_3d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_leaf_consistent_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_leaf_consistent_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_picksplit_2d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_2d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_2d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_2d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_2d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_picksplit_3d(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_3d(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_3d(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_3d(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_3d(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_spgist_picksplit_nd(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_nd(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_nd(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_nd(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_spgist_picksplit_nd(internal, internal) TO service_role;


--
-- Name: FUNCTION geometry_within(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_within(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_within(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_within(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_within(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION geometry_within_nd(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometry_within_nd(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometry_within_nd(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometry_within_nd(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometry_within_nd(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION geometrytype(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometrytype(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.geometrytype(public.geography) TO anon;
GRANT ALL ON FUNCTION public.geometrytype(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.geometrytype(public.geography) TO service_role;


--
-- Name: FUNCTION geometrytype(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geometrytype(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.geometrytype(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.geometrytype(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.geometrytype(public.geometry) TO service_role;


--
-- Name: FUNCTION geomfromewkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geomfromewkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.geomfromewkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.geomfromewkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.geomfromewkb(bytea) TO service_role;


--
-- Name: FUNCTION geomfromewkt(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.geomfromewkt(text) TO postgres;
GRANT ALL ON FUNCTION public.geomfromewkt(text) TO anon;
GRANT ALL ON FUNCTION public.geomfromewkt(text) TO authenticated;
GRANT ALL ON FUNCTION public.geomfromewkt(text) TO service_role;


--
-- Name: FUNCTION get_all_shows_with_coordinates(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_all_shows_with_coordinates() TO anon;
GRANT ALL ON FUNCTION public.get_all_shows_with_coordinates() TO authenticated;
GRANT ALL ON FUNCTION public.get_all_shows_with_coordinates() TO service_role;


--
-- Name: FUNCTION get_proj4_from_srid(integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.get_proj4_from_srid(integer) TO postgres;
GRANT ALL ON FUNCTION public.get_proj4_from_srid(integer) TO anon;
GRANT ALL ON FUNCTION public.get_proj4_from_srid(integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_proj4_from_srid(integer) TO service_role;


--
-- Name: FUNCTION get_show_with_coordinates(show_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_show_with_coordinates(show_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_show_with_coordinates(show_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_show_with_coordinates(show_id uuid) TO service_role;


--
-- Name: FUNCTION gettransactionid(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gettransactionid() TO postgres;
GRANT ALL ON FUNCTION public.gettransactionid() TO anon;
GRANT ALL ON FUNCTION public.gettransactionid() TO authenticated;
GRANT ALL ON FUNCTION public.gettransactionid() TO service_role;


--
-- Name: FUNCTION gserialized_gist_joinsel_2d(internal, oid, internal, smallint); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gserialized_gist_joinsel_2d(internal, oid, internal, smallint) TO postgres;
GRANT ALL ON FUNCTION public.gserialized_gist_joinsel_2d(internal, oid, internal, smallint) TO anon;
GRANT ALL ON FUNCTION public.gserialized_gist_joinsel_2d(internal, oid, internal, smallint) TO authenticated;
GRANT ALL ON FUNCTION public.gserialized_gist_joinsel_2d(internal, oid, internal, smallint) TO service_role;


--
-- Name: FUNCTION gserialized_gist_joinsel_nd(internal, oid, internal, smallint); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gserialized_gist_joinsel_nd(internal, oid, internal, smallint) TO postgres;
GRANT ALL ON FUNCTION public.gserialized_gist_joinsel_nd(internal, oid, internal, smallint) TO anon;
GRANT ALL ON FUNCTION public.gserialized_gist_joinsel_nd(internal, oid, internal, smallint) TO authenticated;
GRANT ALL ON FUNCTION public.gserialized_gist_joinsel_nd(internal, oid, internal, smallint) TO service_role;


--
-- Name: FUNCTION gserialized_gist_sel_2d(internal, oid, internal, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gserialized_gist_sel_2d(internal, oid, internal, integer) TO postgres;
GRANT ALL ON FUNCTION public.gserialized_gist_sel_2d(internal, oid, internal, integer) TO anon;
GRANT ALL ON FUNCTION public.gserialized_gist_sel_2d(internal, oid, internal, integer) TO authenticated;
GRANT ALL ON FUNCTION public.gserialized_gist_sel_2d(internal, oid, internal, integer) TO service_role;


--
-- Name: FUNCTION gserialized_gist_sel_nd(internal, oid, internal, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.gserialized_gist_sel_nd(internal, oid, internal, integer) TO postgres;
GRANT ALL ON FUNCTION public.gserialized_gist_sel_nd(internal, oid, internal, integer) TO anon;
GRANT ALL ON FUNCTION public.gserialized_gist_sel_nd(internal, oid, internal, integer) TO authenticated;
GRANT ALL ON FUNCTION public.gserialized_gist_sel_nd(internal, oid, internal, integer) TO service_role;


--
-- Name: FUNCTION handle_dealer_profile_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_dealer_profile_updated_at() TO anon;
GRANT ALL ON FUNCTION public.handle_dealer_profile_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.handle_dealer_profile_updated_at() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_contained_2d(public.box2df, public.box2df); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.is_contained_2d(public.box2df, public.box2df) TO postgres;
GRANT ALL ON FUNCTION public.is_contained_2d(public.box2df, public.box2df) TO anon;
GRANT ALL ON FUNCTION public.is_contained_2d(public.box2df, public.box2df) TO authenticated;
GRANT ALL ON FUNCTION public.is_contained_2d(public.box2df, public.box2df) TO service_role;


--
-- Name: FUNCTION is_contained_2d(public.box2df, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.is_contained_2d(public.box2df, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.is_contained_2d(public.box2df, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.is_contained_2d(public.box2df, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.is_contained_2d(public.box2df, public.geometry) TO service_role;


--
-- Name: FUNCTION is_contained_2d(public.geometry, public.box2df); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.is_contained_2d(public.geometry, public.box2df) TO postgres;
GRANT ALL ON FUNCTION public.is_contained_2d(public.geometry, public.box2df) TO anon;
GRANT ALL ON FUNCTION public.is_contained_2d(public.geometry, public.box2df) TO authenticated;
GRANT ALL ON FUNCTION public.is_contained_2d(public.geometry, public.box2df) TO service_role;


--
-- Name: FUNCTION lockrow(text, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.lockrow(text, text, text) TO postgres;
GRANT ALL ON FUNCTION public.lockrow(text, text, text) TO anon;
GRANT ALL ON FUNCTION public.lockrow(text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.lockrow(text, text, text) TO service_role;


--
-- Name: FUNCTION lockrow(text, text, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.lockrow(text, text, text, text) TO postgres;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, text) TO service_role;


--
-- Name: FUNCTION lockrow(text, text, text, timestamp without time zone); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.lockrow(text, text, text, timestamp without time zone) TO postgres;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, timestamp without time zone) TO anon;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, timestamp without time zone) TO authenticated;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, timestamp without time zone) TO service_role;


--
-- Name: FUNCTION lockrow(text, text, text, text, timestamp without time zone); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.lockrow(text, text, text, text, timestamp without time zone) TO postgres;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, text, timestamp without time zone) TO anon;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, text, timestamp without time zone) TO authenticated;
GRANT ALL ON FUNCTION public.lockrow(text, text, text, text, timestamp without time zone) TO service_role;


--
-- Name: FUNCTION longtransactionsenabled(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.longtransactionsenabled() TO postgres;
GRANT ALL ON FUNCTION public.longtransactionsenabled() TO anon;
GRANT ALL ON FUNCTION public.longtransactionsenabled() TO authenticated;
GRANT ALL ON FUNCTION public.longtransactionsenabled() TO service_role;


--
-- Name: FUNCTION overlaps_2d(public.box2df, public.box2df); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_2d(public.box2df, public.box2df) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_2d(public.box2df, public.box2df) TO anon;
GRANT ALL ON FUNCTION public.overlaps_2d(public.box2df, public.box2df) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_2d(public.box2df, public.box2df) TO service_role;


--
-- Name: FUNCTION overlaps_2d(public.box2df, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_2d(public.box2df, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_2d(public.box2df, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.overlaps_2d(public.box2df, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_2d(public.box2df, public.geometry) TO service_role;


--
-- Name: FUNCTION overlaps_2d(public.geometry, public.box2df); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_2d(public.geometry, public.box2df) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_2d(public.geometry, public.box2df) TO anon;
GRANT ALL ON FUNCTION public.overlaps_2d(public.geometry, public.box2df) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_2d(public.geometry, public.box2df) TO service_role;


--
-- Name: FUNCTION overlaps_geog(public.geography, public.gidx); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_geog(public.geography, public.gidx) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_geog(public.geography, public.gidx) TO anon;
GRANT ALL ON FUNCTION public.overlaps_geog(public.geography, public.gidx) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_geog(public.geography, public.gidx) TO service_role;


--
-- Name: FUNCTION overlaps_geog(public.gidx, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_geog(public.gidx, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_geog(public.gidx, public.geography) TO anon;
GRANT ALL ON FUNCTION public.overlaps_geog(public.gidx, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_geog(public.gidx, public.geography) TO service_role;


--
-- Name: FUNCTION overlaps_geog(public.gidx, public.gidx); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_geog(public.gidx, public.gidx) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_geog(public.gidx, public.gidx) TO anon;
GRANT ALL ON FUNCTION public.overlaps_geog(public.gidx, public.gidx) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_geog(public.gidx, public.gidx) TO service_role;


--
-- Name: FUNCTION overlaps_nd(public.geometry, public.gidx); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_nd(public.geometry, public.gidx) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_nd(public.geometry, public.gidx) TO anon;
GRANT ALL ON FUNCTION public.overlaps_nd(public.geometry, public.gidx) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_nd(public.geometry, public.gidx) TO service_role;


--
-- Name: FUNCTION overlaps_nd(public.gidx, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_nd(public.gidx, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_nd(public.gidx, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.overlaps_nd(public.gidx, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_nd(public.gidx, public.geometry) TO service_role;


--
-- Name: FUNCTION overlaps_nd(public.gidx, public.gidx); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.overlaps_nd(public.gidx, public.gidx) TO postgres;
GRANT ALL ON FUNCTION public.overlaps_nd(public.gidx, public.gidx) TO anon;
GRANT ALL ON FUNCTION public.overlaps_nd(public.gidx, public.gidx) TO authenticated;
GRANT ALL ON FUNCTION public.overlaps_nd(public.gidx, public.gidx) TO service_role;


--
-- Name: FUNCTION pgis_asflatgeobuf_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_asflatgeobuf_transfn(internal, anyelement); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement) TO anon;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement) TO service_role;


--
-- Name: FUNCTION pgis_asflatgeobuf_transfn(internal, anyelement, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement, boolean) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement, boolean) TO anon;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement, boolean) TO service_role;


--
-- Name: FUNCTION pgis_asflatgeobuf_transfn(internal, anyelement, boolean, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement, boolean, text) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement, boolean, text) TO anon;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement, boolean, text) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asflatgeobuf_transfn(internal, anyelement, boolean, text) TO service_role;


--
-- Name: FUNCTION pgis_asgeobuf_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asgeobuf_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_asgeobuf_transfn(internal, anyelement); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement) TO anon;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement) TO service_role;


--
-- Name: FUNCTION pgis_asgeobuf_transfn(internal, anyelement, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement, text) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement, text) TO anon;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement, text) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asgeobuf_transfn(internal, anyelement, text) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_combinefn(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_combinefn(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_combinefn(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_combinefn(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_combinefn(internal, internal) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_deserialfn(bytea, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_deserialfn(bytea, internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_deserialfn(bytea, internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_deserialfn(bytea, internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_deserialfn(bytea, internal) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_serialfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_serialfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_serialfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_serialfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_serialfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement, text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement, text, integer, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text) TO service_role;


--
-- Name: FUNCTION pgis_asmvt_transfn(internal, anyelement, text, integer, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text, text) TO postgres;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text, text) TO anon;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_asmvt_transfn(internal, anyelement, text, integer, text, text) TO service_role;


--
-- Name: FUNCTION pgis_geometry_accum_transfn(internal, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry) TO service_role;


--
-- Name: FUNCTION pgis_geometry_accum_transfn(internal, public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION pgis_geometry_accum_transfn(internal, public.geometry, double precision, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision, integer) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision, integer) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision, integer) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_accum_transfn(internal, public.geometry, double precision, integer) TO service_role;


--
-- Name: FUNCTION pgis_geometry_clusterintersecting_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_clusterintersecting_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_clusterintersecting_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_clusterintersecting_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_clusterintersecting_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_clusterwithin_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_clusterwithin_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_clusterwithin_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_clusterwithin_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_clusterwithin_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_collect_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_collect_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_collect_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_collect_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_collect_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_makeline_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_makeline_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_makeline_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_makeline_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_makeline_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_polygonize_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_polygonize_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_polygonize_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_polygonize_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_polygonize_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_union_parallel_combinefn(internal, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_combinefn(internal, internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_combinefn(internal, internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_combinefn(internal, internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_combinefn(internal, internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_union_parallel_deserialfn(bytea, internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_deserialfn(bytea, internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_deserialfn(bytea, internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_deserialfn(bytea, internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_deserialfn(bytea, internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_union_parallel_finalfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_finalfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_finalfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_finalfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_finalfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_union_parallel_serialfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_serialfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_serialfn(internal) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_serialfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_serialfn(internal) TO service_role;


--
-- Name: FUNCTION pgis_geometry_union_parallel_transfn(internal, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_transfn(internal, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_transfn(internal, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_transfn(internal, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_transfn(internal, public.geometry) TO service_role;


--
-- Name: FUNCTION pgis_geometry_union_parallel_transfn(internal, public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_transfn(internal, public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_transfn(internal, public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_transfn(internal, public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.pgis_geometry_union_parallel_transfn(internal, public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION populate_geometry_columns(use_typmod boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.populate_geometry_columns(use_typmod boolean) TO postgres;
GRANT ALL ON FUNCTION public.populate_geometry_columns(use_typmod boolean) TO anon;
GRANT ALL ON FUNCTION public.populate_geometry_columns(use_typmod boolean) TO authenticated;
GRANT ALL ON FUNCTION public.populate_geometry_columns(use_typmod boolean) TO service_role;


--
-- Name: FUNCTION populate_geometry_columns(tbl_oid oid, use_typmod boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.populate_geometry_columns(tbl_oid oid, use_typmod boolean) TO postgres;
GRANT ALL ON FUNCTION public.populate_geometry_columns(tbl_oid oid, use_typmod boolean) TO anon;
GRANT ALL ON FUNCTION public.populate_geometry_columns(tbl_oid oid, use_typmod boolean) TO authenticated;
GRANT ALL ON FUNCTION public.populate_geometry_columns(tbl_oid oid, use_typmod boolean) TO service_role;


--
-- Name: FUNCTION postgis_addbbox(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_addbbox(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.postgis_addbbox(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.postgis_addbbox(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_addbbox(public.geometry) TO service_role;


--
-- Name: FUNCTION postgis_cache_bbox(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_cache_bbox() TO postgres;
GRANT ALL ON FUNCTION public.postgis_cache_bbox() TO anon;
GRANT ALL ON FUNCTION public.postgis_cache_bbox() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_cache_bbox() TO service_role;


--
-- Name: FUNCTION postgis_constraint_dims(geomschema text, geomtable text, geomcolumn text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_constraint_dims(geomschema text, geomtable text, geomcolumn text) TO postgres;
GRANT ALL ON FUNCTION public.postgis_constraint_dims(geomschema text, geomtable text, geomcolumn text) TO anon;
GRANT ALL ON FUNCTION public.postgis_constraint_dims(geomschema text, geomtable text, geomcolumn text) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_constraint_dims(geomschema text, geomtable text, geomcolumn text) TO service_role;


--
-- Name: FUNCTION postgis_constraint_srid(geomschema text, geomtable text, geomcolumn text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_constraint_srid(geomschema text, geomtable text, geomcolumn text) TO postgres;
GRANT ALL ON FUNCTION public.postgis_constraint_srid(geomschema text, geomtable text, geomcolumn text) TO anon;
GRANT ALL ON FUNCTION public.postgis_constraint_srid(geomschema text, geomtable text, geomcolumn text) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_constraint_srid(geomschema text, geomtable text, geomcolumn text) TO service_role;


--
-- Name: FUNCTION postgis_constraint_type(geomschema text, geomtable text, geomcolumn text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_constraint_type(geomschema text, geomtable text, geomcolumn text) TO postgres;
GRANT ALL ON FUNCTION public.postgis_constraint_type(geomschema text, geomtable text, geomcolumn text) TO anon;
GRANT ALL ON FUNCTION public.postgis_constraint_type(geomschema text, geomtable text, geomcolumn text) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_constraint_type(geomschema text, geomtable text, geomcolumn text) TO service_role;


--
-- Name: FUNCTION postgis_dropbbox(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_dropbbox(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.postgis_dropbbox(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.postgis_dropbbox(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_dropbbox(public.geometry) TO service_role;


--
-- Name: FUNCTION postgis_extensions_upgrade(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_extensions_upgrade() TO postgres;
GRANT ALL ON FUNCTION public.postgis_extensions_upgrade() TO anon;
GRANT ALL ON FUNCTION public.postgis_extensions_upgrade() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_extensions_upgrade() TO service_role;


--
-- Name: FUNCTION postgis_full_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_full_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_full_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_full_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_full_version() TO service_role;


--
-- Name: FUNCTION postgis_geos_noop(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_geos_noop(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.postgis_geos_noop(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.postgis_geos_noop(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_geos_noop(public.geometry) TO service_role;


--
-- Name: FUNCTION postgis_geos_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_geos_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_geos_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_geos_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_geos_version() TO service_role;


--
-- Name: FUNCTION postgis_getbbox(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_getbbox(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.postgis_getbbox(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.postgis_getbbox(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_getbbox(public.geometry) TO service_role;


--
-- Name: FUNCTION postgis_hasbbox(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_hasbbox(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.postgis_hasbbox(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.postgis_hasbbox(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_hasbbox(public.geometry) TO service_role;


--
-- Name: FUNCTION postgis_index_supportfn(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_index_supportfn(internal) TO postgres;
GRANT ALL ON FUNCTION public.postgis_index_supportfn(internal) TO anon;
GRANT ALL ON FUNCTION public.postgis_index_supportfn(internal) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_index_supportfn(internal) TO service_role;


--
-- Name: FUNCTION postgis_lib_build_date(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_lib_build_date() TO postgres;
GRANT ALL ON FUNCTION public.postgis_lib_build_date() TO anon;
GRANT ALL ON FUNCTION public.postgis_lib_build_date() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_lib_build_date() TO service_role;


--
-- Name: FUNCTION postgis_lib_revision(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_lib_revision() TO postgres;
GRANT ALL ON FUNCTION public.postgis_lib_revision() TO anon;
GRANT ALL ON FUNCTION public.postgis_lib_revision() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_lib_revision() TO service_role;


--
-- Name: FUNCTION postgis_lib_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_lib_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_lib_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_lib_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_lib_version() TO service_role;


--
-- Name: FUNCTION postgis_libjson_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_libjson_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_libjson_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_libjson_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_libjson_version() TO service_role;


--
-- Name: FUNCTION postgis_liblwgeom_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_liblwgeom_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_liblwgeom_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_liblwgeom_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_liblwgeom_version() TO service_role;


--
-- Name: FUNCTION postgis_libprotobuf_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_libprotobuf_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_libprotobuf_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_libprotobuf_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_libprotobuf_version() TO service_role;


--
-- Name: FUNCTION postgis_libxml_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_libxml_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_libxml_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_libxml_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_libxml_version() TO service_role;


--
-- Name: FUNCTION postgis_noop(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_noop(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.postgis_noop(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.postgis_noop(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_noop(public.geometry) TO service_role;


--
-- Name: FUNCTION postgis_proj_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_proj_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_proj_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_proj_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_proj_version() TO service_role;


--
-- Name: FUNCTION postgis_scripts_build_date(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_scripts_build_date() TO postgres;
GRANT ALL ON FUNCTION public.postgis_scripts_build_date() TO anon;
GRANT ALL ON FUNCTION public.postgis_scripts_build_date() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_scripts_build_date() TO service_role;


--
-- Name: FUNCTION postgis_scripts_installed(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_scripts_installed() TO postgres;
GRANT ALL ON FUNCTION public.postgis_scripts_installed() TO anon;
GRANT ALL ON FUNCTION public.postgis_scripts_installed() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_scripts_installed() TO service_role;


--
-- Name: FUNCTION postgis_scripts_released(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_scripts_released() TO postgres;
GRANT ALL ON FUNCTION public.postgis_scripts_released() TO anon;
GRANT ALL ON FUNCTION public.postgis_scripts_released() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_scripts_released() TO service_role;


--
-- Name: FUNCTION postgis_svn_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_svn_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_svn_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_svn_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_svn_version() TO service_role;


--
-- Name: FUNCTION postgis_transform_geometry(geom public.geometry, text, text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_transform_geometry(geom public.geometry, text, text, integer) TO postgres;
GRANT ALL ON FUNCTION public.postgis_transform_geometry(geom public.geometry, text, text, integer) TO anon;
GRANT ALL ON FUNCTION public.postgis_transform_geometry(geom public.geometry, text, text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_transform_geometry(geom public.geometry, text, text, integer) TO service_role;


--
-- Name: FUNCTION postgis_type_name(geomname character varying, coord_dimension integer, use_new_name boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_type_name(geomname character varying, coord_dimension integer, use_new_name boolean) TO postgres;
GRANT ALL ON FUNCTION public.postgis_type_name(geomname character varying, coord_dimension integer, use_new_name boolean) TO anon;
GRANT ALL ON FUNCTION public.postgis_type_name(geomname character varying, coord_dimension integer, use_new_name boolean) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_type_name(geomname character varying, coord_dimension integer, use_new_name boolean) TO service_role;


--
-- Name: FUNCTION postgis_typmod_dims(integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_typmod_dims(integer) TO postgres;
GRANT ALL ON FUNCTION public.postgis_typmod_dims(integer) TO anon;
GRANT ALL ON FUNCTION public.postgis_typmod_dims(integer) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_typmod_dims(integer) TO service_role;


--
-- Name: FUNCTION postgis_typmod_srid(integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_typmod_srid(integer) TO postgres;
GRANT ALL ON FUNCTION public.postgis_typmod_srid(integer) TO anon;
GRANT ALL ON FUNCTION public.postgis_typmod_srid(integer) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_typmod_srid(integer) TO service_role;


--
-- Name: FUNCTION postgis_typmod_type(integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_typmod_type(integer) TO postgres;
GRANT ALL ON FUNCTION public.postgis_typmod_type(integer) TO anon;
GRANT ALL ON FUNCTION public.postgis_typmod_type(integer) TO authenticated;
GRANT ALL ON FUNCTION public.postgis_typmod_type(integer) TO service_role;


--
-- Name: FUNCTION postgis_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_version() TO service_role;


--
-- Name: FUNCTION postgis_wagyu_version(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.postgis_wagyu_version() TO postgres;
GRANT ALL ON FUNCTION public.postgis_wagyu_version() TO anon;
GRANT ALL ON FUNCTION public.postgis_wagyu_version() TO authenticated;
GRANT ALL ON FUNCTION public.postgis_wagyu_version() TO service_role;


--
-- Name: FUNCTION st_3dclosestpoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dclosestpoint(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dclosestpoint(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dclosestpoint(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dclosestpoint(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_3ddfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_3ddistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3ddistance(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3ddistance(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3ddistance(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3ddistance(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_3ddwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_3dintersects(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dintersects(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dintersects(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dintersects(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dintersects(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_3dlength(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dlength(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dlength(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dlength(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dlength(public.geometry) TO service_role;


--
-- Name: FUNCTION st_3dlineinterpolatepoint(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dlineinterpolatepoint(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_3dlineinterpolatepoint(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_3dlineinterpolatepoint(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dlineinterpolatepoint(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_3dlongestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dlongestline(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dlongestline(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dlongestline(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dlongestline(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_3dmakebox(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dmakebox(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dmakebox(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dmakebox(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dmakebox(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_3dmaxdistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dmaxdistance(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dmaxdistance(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dmaxdistance(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dmaxdistance(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_3dperimeter(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dperimeter(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dperimeter(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dperimeter(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dperimeter(public.geometry) TO service_role;


--
-- Name: FUNCTION st_3dshortestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dshortestline(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dshortestline(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dshortestline(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dshortestline(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_addmeasure(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_addmeasure(public.geometry, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_addmeasure(public.geometry, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_addmeasure(public.geometry, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_addmeasure(public.geometry, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_addpoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_addpoint(geom1 public.geometry, geom2 public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_addpoint(geom1 public.geometry, geom2 public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_affine(public.geometry, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_angle(line1 public.geometry, line2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_angle(line1 public.geometry, line2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_angle(line1 public.geometry, line2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_angle(line1 public.geometry, line2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_angle(line1 public.geometry, line2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_angle(pt1 public.geometry, pt2 public.geometry, pt3 public.geometry, pt4 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_angle(pt1 public.geometry, pt2 public.geometry, pt3 public.geometry, pt4 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_angle(pt1 public.geometry, pt2 public.geometry, pt3 public.geometry, pt4 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_angle(pt1 public.geometry, pt2 public.geometry, pt3 public.geometry, pt4 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_angle(pt1 public.geometry, pt2 public.geometry, pt3 public.geometry, pt4 public.geometry) TO service_role;


--
-- Name: FUNCTION st_area(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_area(text) TO postgres;
GRANT ALL ON FUNCTION public.st_area(text) TO anon;
GRANT ALL ON FUNCTION public.st_area(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_area(text) TO service_role;


--
-- Name: FUNCTION st_area(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_area(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_area(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_area(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_area(public.geometry) TO service_role;


--
-- Name: FUNCTION st_area(geog public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_area(geog public.geography, use_spheroid boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_area(geog public.geography, use_spheroid boolean) TO anon;
GRANT ALL ON FUNCTION public.st_area(geog public.geography, use_spheroid boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_area(geog public.geography, use_spheroid boolean) TO service_role;


--
-- Name: FUNCTION st_area2d(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_area2d(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_area2d(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_area2d(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_area2d(public.geometry) TO service_role;


--
-- Name: FUNCTION st_asbinary(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asbinary(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_asbinary(public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_asbinary(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_asbinary(public.geography) TO service_role;


--
-- Name: FUNCTION st_asbinary(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asbinary(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_asbinary(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_asbinary(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_asbinary(public.geometry) TO service_role;


--
-- Name: FUNCTION st_asbinary(public.geography, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asbinary(public.geography, text) TO postgres;
GRANT ALL ON FUNCTION public.st_asbinary(public.geography, text) TO anon;
GRANT ALL ON FUNCTION public.st_asbinary(public.geography, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asbinary(public.geography, text) TO service_role;


--
-- Name: FUNCTION st_asbinary(public.geometry, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asbinary(public.geometry, text) TO postgres;
GRANT ALL ON FUNCTION public.st_asbinary(public.geometry, text) TO anon;
GRANT ALL ON FUNCTION public.st_asbinary(public.geometry, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asbinary(public.geometry, text) TO service_role;


--
-- Name: FUNCTION st_asencodedpolyline(geom public.geometry, nprecision integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asencodedpolyline(geom public.geometry, nprecision integer) TO postgres;
GRANT ALL ON FUNCTION public.st_asencodedpolyline(geom public.geometry, nprecision integer) TO anon;
GRANT ALL ON FUNCTION public.st_asencodedpolyline(geom public.geometry, nprecision integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_asencodedpolyline(geom public.geometry, nprecision integer) TO service_role;


--
-- Name: FUNCTION st_asewkb(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asewkb(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_asewkb(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_asewkb(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_asewkb(public.geometry) TO service_role;


--
-- Name: FUNCTION st_asewkb(public.geometry, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asewkb(public.geometry, text) TO postgres;
GRANT ALL ON FUNCTION public.st_asewkb(public.geometry, text) TO anon;
GRANT ALL ON FUNCTION public.st_asewkb(public.geometry, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asewkb(public.geometry, text) TO service_role;


--
-- Name: FUNCTION st_asewkt(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asewkt(text) TO postgres;
GRANT ALL ON FUNCTION public.st_asewkt(text) TO anon;
GRANT ALL ON FUNCTION public.st_asewkt(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asewkt(text) TO service_role;


--
-- Name: FUNCTION st_asewkt(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asewkt(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_asewkt(public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_asewkt(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_asewkt(public.geography) TO service_role;


--
-- Name: FUNCTION st_asewkt(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asewkt(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_asewkt(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_asewkt(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_asewkt(public.geometry) TO service_role;


--
-- Name: FUNCTION st_asewkt(public.geography, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asewkt(public.geography, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_asewkt(public.geography, integer) TO anon;
GRANT ALL ON FUNCTION public.st_asewkt(public.geography, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_asewkt(public.geography, integer) TO service_role;


--
-- Name: FUNCTION st_asewkt(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asewkt(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_asewkt(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_asewkt(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_asewkt(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_asgeojson(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgeojson(text) TO postgres;
GRANT ALL ON FUNCTION public.st_asgeojson(text) TO anon;
GRANT ALL ON FUNCTION public.st_asgeojson(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgeojson(text) TO service_role;


--
-- Name: FUNCTION st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer) TO postgres;
GRANT ALL ON FUNCTION public.st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer) TO anon;
GRANT ALL ON FUNCTION public.st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgeojson(geog public.geography, maxdecimaldigits integer, options integer) TO service_role;


--
-- Name: FUNCTION st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer) TO postgres;
GRANT ALL ON FUNCTION public.st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer) TO anon;
GRANT ALL ON FUNCTION public.st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgeojson(geom public.geometry, maxdecimaldigits integer, options integer) TO service_role;


--
-- Name: FUNCTION st_asgeojson(r record, geom_column text, maxdecimaldigits integer, pretty_bool boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgeojson(r record, geom_column text, maxdecimaldigits integer, pretty_bool boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_asgeojson(r record, geom_column text, maxdecimaldigits integer, pretty_bool boolean) TO anon;
GRANT ALL ON FUNCTION public.st_asgeojson(r record, geom_column text, maxdecimaldigits integer, pretty_bool boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgeojson(r record, geom_column text, maxdecimaldigits integer, pretty_bool boolean) TO service_role;


--
-- Name: FUNCTION st_asgml(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgml(text) TO postgres;
GRANT ALL ON FUNCTION public.st_asgml(text) TO anon;
GRANT ALL ON FUNCTION public.st_asgml(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgml(text) TO service_role;


--
-- Name: FUNCTION st_asgml(geom public.geometry, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgml(geom public.geometry, maxdecimaldigits integer, options integer) TO postgres;
GRANT ALL ON FUNCTION public.st_asgml(geom public.geometry, maxdecimaldigits integer, options integer) TO anon;
GRANT ALL ON FUNCTION public.st_asgml(geom public.geometry, maxdecimaldigits integer, options integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgml(geom public.geometry, maxdecimaldigits integer, options integer) TO service_role;


--
-- Name: FUNCTION st_asgml(geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgml(geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) TO postgres;
GRANT ALL ON FUNCTION public.st_asgml(geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) TO anon;
GRANT ALL ON FUNCTION public.st_asgml(geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgml(geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) TO service_role;


--
-- Name: FUNCTION st_asgml(version integer, geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgml(version integer, geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) TO postgres;
GRANT ALL ON FUNCTION public.st_asgml(version integer, geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) TO anon;
GRANT ALL ON FUNCTION public.st_asgml(version integer, geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgml(version integer, geog public.geography, maxdecimaldigits integer, options integer, nprefix text, id text) TO service_role;


--
-- Name: FUNCTION st_asgml(version integer, geom public.geometry, maxdecimaldigits integer, options integer, nprefix text, id text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgml(version integer, geom public.geometry, maxdecimaldigits integer, options integer, nprefix text, id text) TO postgres;
GRANT ALL ON FUNCTION public.st_asgml(version integer, geom public.geometry, maxdecimaldigits integer, options integer, nprefix text, id text) TO anon;
GRANT ALL ON FUNCTION public.st_asgml(version integer, geom public.geometry, maxdecimaldigits integer, options integer, nprefix text, id text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgml(version integer, geom public.geometry, maxdecimaldigits integer, options integer, nprefix text, id text) TO service_role;


--
-- Name: FUNCTION st_ashexewkb(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_ashexewkb(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_ashexewkb(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_ashexewkb(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_ashexewkb(public.geometry) TO service_role;


--
-- Name: FUNCTION st_ashexewkb(public.geometry, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_ashexewkb(public.geometry, text) TO postgres;
GRANT ALL ON FUNCTION public.st_ashexewkb(public.geometry, text) TO anon;
GRANT ALL ON FUNCTION public.st_ashexewkb(public.geometry, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_ashexewkb(public.geometry, text) TO service_role;


--
-- Name: FUNCTION st_askml(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_askml(text) TO postgres;
GRANT ALL ON FUNCTION public.st_askml(text) TO anon;
GRANT ALL ON FUNCTION public.st_askml(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_askml(text) TO service_role;


--
-- Name: FUNCTION st_askml(geog public.geography, maxdecimaldigits integer, nprefix text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_askml(geog public.geography, maxdecimaldigits integer, nprefix text) TO postgres;
GRANT ALL ON FUNCTION public.st_askml(geog public.geography, maxdecimaldigits integer, nprefix text) TO anon;
GRANT ALL ON FUNCTION public.st_askml(geog public.geography, maxdecimaldigits integer, nprefix text) TO authenticated;
GRANT ALL ON FUNCTION public.st_askml(geog public.geography, maxdecimaldigits integer, nprefix text) TO service_role;


--
-- Name: FUNCTION st_askml(geom public.geometry, maxdecimaldigits integer, nprefix text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_askml(geom public.geometry, maxdecimaldigits integer, nprefix text) TO postgres;
GRANT ALL ON FUNCTION public.st_askml(geom public.geometry, maxdecimaldigits integer, nprefix text) TO anon;
GRANT ALL ON FUNCTION public.st_askml(geom public.geometry, maxdecimaldigits integer, nprefix text) TO authenticated;
GRANT ALL ON FUNCTION public.st_askml(geom public.geometry, maxdecimaldigits integer, nprefix text) TO service_role;


--
-- Name: FUNCTION st_aslatlontext(geom public.geometry, tmpl text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_aslatlontext(geom public.geometry, tmpl text) TO postgres;
GRANT ALL ON FUNCTION public.st_aslatlontext(geom public.geometry, tmpl text) TO anon;
GRANT ALL ON FUNCTION public.st_aslatlontext(geom public.geometry, tmpl text) TO authenticated;
GRANT ALL ON FUNCTION public.st_aslatlontext(geom public.geometry, tmpl text) TO service_role;


--
-- Name: FUNCTION st_asmarc21(geom public.geometry, format text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asmarc21(geom public.geometry, format text) TO postgres;
GRANT ALL ON FUNCTION public.st_asmarc21(geom public.geometry, format text) TO anon;
GRANT ALL ON FUNCTION public.st_asmarc21(geom public.geometry, format text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asmarc21(geom public.geometry, format text) TO service_role;


--
-- Name: FUNCTION st_asmvtgeom(geom public.geometry, bounds public.box2d, extent integer, buffer integer, clip_geom boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asmvtgeom(geom public.geometry, bounds public.box2d, extent integer, buffer integer, clip_geom boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_asmvtgeom(geom public.geometry, bounds public.box2d, extent integer, buffer integer, clip_geom boolean) TO anon;
GRANT ALL ON FUNCTION public.st_asmvtgeom(geom public.geometry, bounds public.box2d, extent integer, buffer integer, clip_geom boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_asmvtgeom(geom public.geometry, bounds public.box2d, extent integer, buffer integer, clip_geom boolean) TO service_role;


--
-- Name: FUNCTION st_assvg(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_assvg(text) TO postgres;
GRANT ALL ON FUNCTION public.st_assvg(text) TO anon;
GRANT ALL ON FUNCTION public.st_assvg(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_assvg(text) TO service_role;


--
-- Name: FUNCTION st_assvg(geog public.geography, rel integer, maxdecimaldigits integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_assvg(geog public.geography, rel integer, maxdecimaldigits integer) TO postgres;
GRANT ALL ON FUNCTION public.st_assvg(geog public.geography, rel integer, maxdecimaldigits integer) TO anon;
GRANT ALL ON FUNCTION public.st_assvg(geog public.geography, rel integer, maxdecimaldigits integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_assvg(geog public.geography, rel integer, maxdecimaldigits integer) TO service_role;


--
-- Name: FUNCTION st_assvg(geom public.geometry, rel integer, maxdecimaldigits integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_assvg(geom public.geometry, rel integer, maxdecimaldigits integer) TO postgres;
GRANT ALL ON FUNCTION public.st_assvg(geom public.geometry, rel integer, maxdecimaldigits integer) TO anon;
GRANT ALL ON FUNCTION public.st_assvg(geom public.geometry, rel integer, maxdecimaldigits integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_assvg(geom public.geometry, rel integer, maxdecimaldigits integer) TO service_role;


--
-- Name: FUNCTION st_astext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_astext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_astext(text) TO anon;
GRANT ALL ON FUNCTION public.st_astext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_astext(text) TO service_role;


--
-- Name: FUNCTION st_astext(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_astext(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_astext(public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_astext(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_astext(public.geography) TO service_role;


--
-- Name: FUNCTION st_astext(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_astext(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_astext(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_astext(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_astext(public.geometry) TO service_role;


--
-- Name: FUNCTION st_astext(public.geography, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_astext(public.geography, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_astext(public.geography, integer) TO anon;
GRANT ALL ON FUNCTION public.st_astext(public.geography, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_astext(public.geography, integer) TO service_role;


--
-- Name: FUNCTION st_astext(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_astext(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_astext(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_astext(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_astext(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_astwkb(geom public.geometry, prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_astwkb(geom public.geometry, prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_astwkb(geom public.geometry, prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) TO anon;
GRANT ALL ON FUNCTION public.st_astwkb(geom public.geometry, prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_astwkb(geom public.geometry, prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) TO service_role;


--
-- Name: FUNCTION st_astwkb(geom public.geometry[], ids bigint[], prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_astwkb(geom public.geometry[], ids bigint[], prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_astwkb(geom public.geometry[], ids bigint[], prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) TO anon;
GRANT ALL ON FUNCTION public.st_astwkb(geom public.geometry[], ids bigint[], prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_astwkb(geom public.geometry[], ids bigint[], prec integer, prec_z integer, prec_m integer, with_sizes boolean, with_boxes boolean) TO service_role;


--
-- Name: FUNCTION st_asx3d(geom public.geometry, maxdecimaldigits integer, options integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asx3d(geom public.geometry, maxdecimaldigits integer, options integer) TO postgres;
GRANT ALL ON FUNCTION public.st_asx3d(geom public.geometry, maxdecimaldigits integer, options integer) TO anon;
GRANT ALL ON FUNCTION public.st_asx3d(geom public.geometry, maxdecimaldigits integer, options integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_asx3d(geom public.geometry, maxdecimaldigits integer, options integer) TO service_role;


--
-- Name: FUNCTION st_azimuth(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_azimuth(geog1 public.geography, geog2 public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_azimuth(geog1 public.geography, geog2 public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_azimuth(geog1 public.geography, geog2 public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_azimuth(geog1 public.geography, geog2 public.geography) TO service_role;


--
-- Name: FUNCTION st_azimuth(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_azimuth(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_azimuth(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_azimuth(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_azimuth(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_bdmpolyfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_bdmpolyfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_bdmpolyfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_bdmpolyfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_bdmpolyfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_bdpolyfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_bdpolyfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_bdpolyfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_bdpolyfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_bdpolyfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_boundary(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_boundary(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_boundary(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_boundary(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_boundary(public.geometry) TO service_role;


--
-- Name: FUNCTION st_boundingdiagonal(geom public.geometry, fits boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_boundingdiagonal(geom public.geometry, fits boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_boundingdiagonal(geom public.geometry, fits boolean) TO anon;
GRANT ALL ON FUNCTION public.st_boundingdiagonal(geom public.geometry, fits boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_boundingdiagonal(geom public.geometry, fits boolean) TO service_role;


--
-- Name: FUNCTION st_box2dfromgeohash(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_box2dfromgeohash(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_box2dfromgeohash(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_box2dfromgeohash(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_box2dfromgeohash(text, integer) TO service_role;


--
-- Name: FUNCTION st_buffer(text, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buffer(text, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision) TO service_role;


--
-- Name: FUNCTION st_buffer(public.geography, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision) TO service_role;


--
-- Name: FUNCTION st_buffer(text, double precision, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buffer(text, double precision, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision, integer) TO anon;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision, integer) TO service_role;


--
-- Name: FUNCTION st_buffer(text, double precision, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buffer(text, double precision, text) TO postgres;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision, text) TO anon;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_buffer(text, double precision, text) TO service_role;


--
-- Name: FUNCTION st_buffer(public.geography, double precision, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision, integer) TO anon;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision, integer) TO service_role;


--
-- Name: FUNCTION st_buffer(public.geography, double precision, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision, text) TO postgres;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision, text) TO anon;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_buffer(public.geography, double precision, text) TO service_role;


--
-- Name: FUNCTION st_buffer(geom public.geometry, radius double precision, quadsegs integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, quadsegs integer) TO postgres;
GRANT ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, quadsegs integer) TO anon;
GRANT ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, quadsegs integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, quadsegs integer) TO service_role;


--
-- Name: FUNCTION st_buffer(geom public.geometry, radius double precision, options text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, options text) TO postgres;
GRANT ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, options text) TO anon;
GRANT ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, options text) TO authenticated;
GRANT ALL ON FUNCTION public.st_buffer(geom public.geometry, radius double precision, options text) TO service_role;


--
-- Name: FUNCTION st_buildarea(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_buildarea(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_buildarea(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_buildarea(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_buildarea(public.geometry) TO service_role;


--
-- Name: FUNCTION st_centroid(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_centroid(text) TO postgres;
GRANT ALL ON FUNCTION public.st_centroid(text) TO anon;
GRANT ALL ON FUNCTION public.st_centroid(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_centroid(text) TO service_role;


--
-- Name: FUNCTION st_centroid(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_centroid(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_centroid(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_centroid(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_centroid(public.geometry) TO service_role;


--
-- Name: FUNCTION st_centroid(public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_centroid(public.geography, use_spheroid boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_centroid(public.geography, use_spheroid boolean) TO anon;
GRANT ALL ON FUNCTION public.st_centroid(public.geography, use_spheroid boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_centroid(public.geography, use_spheroid boolean) TO service_role;


--
-- Name: FUNCTION st_chaikinsmoothing(public.geometry, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_chaikinsmoothing(public.geometry, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_chaikinsmoothing(public.geometry, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.st_chaikinsmoothing(public.geometry, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_chaikinsmoothing(public.geometry, integer, boolean) TO service_role;


--
-- Name: FUNCTION st_cleangeometry(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_cleangeometry(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_cleangeometry(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_cleangeometry(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_cleangeometry(public.geometry) TO service_role;


--
-- Name: FUNCTION st_clipbybox2d(geom public.geometry, box public.box2d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_clipbybox2d(geom public.geometry, box public.box2d) TO postgres;
GRANT ALL ON FUNCTION public.st_clipbybox2d(geom public.geometry, box public.box2d) TO anon;
GRANT ALL ON FUNCTION public.st_clipbybox2d(geom public.geometry, box public.box2d) TO authenticated;
GRANT ALL ON FUNCTION public.st_clipbybox2d(geom public.geometry, box public.box2d) TO service_role;


--
-- Name: FUNCTION st_closestpoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_closestpoint(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_closestpoint(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_closestpoint(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_closestpoint(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_closestpointofapproach(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_closestpointofapproach(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_closestpointofapproach(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_closestpointofapproach(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_closestpointofapproach(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION st_clusterdbscan(public.geometry, eps double precision, minpoints integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_clusterdbscan(public.geometry, eps double precision, minpoints integer) TO postgres;
GRANT ALL ON FUNCTION public.st_clusterdbscan(public.geometry, eps double precision, minpoints integer) TO anon;
GRANT ALL ON FUNCTION public.st_clusterdbscan(public.geometry, eps double precision, minpoints integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_clusterdbscan(public.geometry, eps double precision, minpoints integer) TO service_role;


--
-- Name: FUNCTION st_clusterintersecting(public.geometry[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_clusterintersecting(public.geometry[]) TO postgres;
GRANT ALL ON FUNCTION public.st_clusterintersecting(public.geometry[]) TO anon;
GRANT ALL ON FUNCTION public.st_clusterintersecting(public.geometry[]) TO authenticated;
GRANT ALL ON FUNCTION public.st_clusterintersecting(public.geometry[]) TO service_role;


--
-- Name: FUNCTION st_clusterkmeans(geom public.geometry, k integer, max_radius double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_clusterkmeans(geom public.geometry, k integer, max_radius double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_clusterkmeans(geom public.geometry, k integer, max_radius double precision) TO anon;
GRANT ALL ON FUNCTION public.st_clusterkmeans(geom public.geometry, k integer, max_radius double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_clusterkmeans(geom public.geometry, k integer, max_radius double precision) TO service_role;


--
-- Name: FUNCTION st_clusterwithin(public.geometry[], double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_clusterwithin(public.geometry[], double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_clusterwithin(public.geometry[], double precision) TO anon;
GRANT ALL ON FUNCTION public.st_clusterwithin(public.geometry[], double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_clusterwithin(public.geometry[], double precision) TO service_role;


--
-- Name: FUNCTION st_collect(public.geometry[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_collect(public.geometry[]) TO postgres;
GRANT ALL ON FUNCTION public.st_collect(public.geometry[]) TO anon;
GRANT ALL ON FUNCTION public.st_collect(public.geometry[]) TO authenticated;
GRANT ALL ON FUNCTION public.st_collect(public.geometry[]) TO service_role;


--
-- Name: FUNCTION st_collect(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_collect(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_collect(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_collect(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_collect(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_collectionextract(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_collectionextract(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_collectionextract(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_collectionextract(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_collectionextract(public.geometry) TO service_role;


--
-- Name: FUNCTION st_collectionextract(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_collectionextract(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_collectionextract(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_collectionextract(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_collectionextract(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_collectionhomogenize(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_collectionhomogenize(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_collectionhomogenize(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_collectionhomogenize(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_collectionhomogenize(public.geometry) TO service_role;


--
-- Name: FUNCTION st_combinebbox(public.box2d, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_combinebbox(public.box2d, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box2d, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box2d, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box2d, public.geometry) TO service_role;


--
-- Name: FUNCTION st_combinebbox(public.box3d, public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_combinebbox(public.box3d, public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box3d, public.box3d) TO anon;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box3d, public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box3d, public.box3d) TO service_role;


--
-- Name: FUNCTION st_combinebbox(public.box3d, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_combinebbox(public.box3d, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box3d, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box3d, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_combinebbox(public.box3d, public.geometry) TO service_role;


--
-- Name: FUNCTION st_concavehull(param_geom public.geometry, param_pctconvex double precision, param_allow_holes boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_concavehull(param_geom public.geometry, param_pctconvex double precision, param_allow_holes boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_concavehull(param_geom public.geometry, param_pctconvex double precision, param_allow_holes boolean) TO anon;
GRANT ALL ON FUNCTION public.st_concavehull(param_geom public.geometry, param_pctconvex double precision, param_allow_holes boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_concavehull(param_geom public.geometry, param_pctconvex double precision, param_allow_holes boolean) TO service_role;


--
-- Name: FUNCTION st_contains(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_contains(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_contains(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_contains(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_contains(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_containsproperly(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_containsproperly(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_containsproperly(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_containsproperly(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_containsproperly(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_convexhull(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_convexhull(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_convexhull(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_convexhull(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_convexhull(public.geometry) TO service_role;


--
-- Name: FUNCTION st_coorddim(geometry public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_coorddim(geometry public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_coorddim(geometry public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_coorddim(geometry public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_coorddim(geometry public.geometry) TO service_role;


--
-- Name: FUNCTION st_coveredby(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_coveredby(text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_coveredby(text, text) TO anon;
GRANT ALL ON FUNCTION public.st_coveredby(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_coveredby(text, text) TO service_role;


--
-- Name: FUNCTION st_coveredby(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_coveredby(geog1 public.geography, geog2 public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_coveredby(geog1 public.geography, geog2 public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_coveredby(geog1 public.geography, geog2 public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_coveredby(geog1 public.geography, geog2 public.geography) TO service_role;


--
-- Name: FUNCTION st_coveredby(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_coveredby(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_coveredby(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_coveredby(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_coveredby(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_covers(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_covers(text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_covers(text, text) TO anon;
GRANT ALL ON FUNCTION public.st_covers(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_covers(text, text) TO service_role;


--
-- Name: FUNCTION st_covers(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_covers(geog1 public.geography, geog2 public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_covers(geog1 public.geography, geog2 public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_covers(geog1 public.geography, geog2 public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_covers(geog1 public.geography, geog2 public.geography) TO service_role;


--
-- Name: FUNCTION st_covers(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_covers(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_covers(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_covers(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_covers(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_cpawithin(public.geometry, public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_cpawithin(public.geometry, public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_cpawithin(public.geometry, public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_cpawithin(public.geometry, public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_cpawithin(public.geometry, public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_crosses(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_crosses(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_crosses(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_crosses(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_crosses(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_curvetoline(geom public.geometry, tol double precision, toltype integer, flags integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_curvetoline(geom public.geometry, tol double precision, toltype integer, flags integer) TO postgres;
GRANT ALL ON FUNCTION public.st_curvetoline(geom public.geometry, tol double precision, toltype integer, flags integer) TO anon;
GRANT ALL ON FUNCTION public.st_curvetoline(geom public.geometry, tol double precision, toltype integer, flags integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_curvetoline(geom public.geometry, tol double precision, toltype integer, flags integer) TO service_role;


--
-- Name: FUNCTION st_delaunaytriangles(g1 public.geometry, tolerance double precision, flags integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_delaunaytriangles(g1 public.geometry, tolerance double precision, flags integer) TO postgres;
GRANT ALL ON FUNCTION public.st_delaunaytriangles(g1 public.geometry, tolerance double precision, flags integer) TO anon;
GRANT ALL ON FUNCTION public.st_delaunaytriangles(g1 public.geometry, tolerance double precision, flags integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_delaunaytriangles(g1 public.geometry, tolerance double precision, flags integer) TO service_role;


--
-- Name: FUNCTION st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_dfullywithin(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_difference(geom1 public.geometry, geom2 public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_difference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_difference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO anon;
GRANT ALL ON FUNCTION public.st_difference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_difference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO service_role;


--
-- Name: FUNCTION st_dimension(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dimension(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_dimension(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_dimension(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_dimension(public.geometry) TO service_role;


--
-- Name: FUNCTION st_disjoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_disjoint(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_disjoint(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_disjoint(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_disjoint(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_distance(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_distance(text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_distance(text, text) TO anon;
GRANT ALL ON FUNCTION public.st_distance(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_distance(text, text) TO service_role;


--
-- Name: FUNCTION st_distance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_distance(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_distance(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_distance(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_distance(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_distance(geog1 public.geography, geog2 public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_distance(geog1 public.geography, geog2 public.geography, use_spheroid boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_distance(geog1 public.geography, geog2 public.geography, use_spheroid boolean) TO anon;
GRANT ALL ON FUNCTION public.st_distance(geog1 public.geography, geog2 public.geography, use_spheroid boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_distance(geog1 public.geography, geog2 public.geography, use_spheroid boolean) TO service_role;


--
-- Name: FUNCTION st_distancecpa(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_distancecpa(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_distancecpa(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_distancecpa(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_distancecpa(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION st_distancesphere(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_distancesphere(geom1 public.geometry, geom2 public.geometry, radius double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry, radius double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry, radius double precision) TO anon;
GRANT ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry, radius double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_distancesphere(geom1 public.geometry, geom2 public.geometry, radius double precision) TO service_role;


--
-- Name: FUNCTION st_distancespheroid(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_distancespheroid(geom1 public.geometry, geom2 public.geometry, public.spheroid); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry, public.spheroid) TO postgres;
GRANT ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry, public.spheroid) TO anon;
GRANT ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry, public.spheroid) TO authenticated;
GRANT ALL ON FUNCTION public.st_distancespheroid(geom1 public.geometry, geom2 public.geometry, public.spheroid) TO service_role;


--
-- Name: FUNCTION st_dump(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dump(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_dump(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_dump(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_dump(public.geometry) TO service_role;


--
-- Name: FUNCTION st_dumppoints(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dumppoints(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_dumppoints(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_dumppoints(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_dumppoints(public.geometry) TO service_role;


--
-- Name: FUNCTION st_dumprings(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dumprings(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_dumprings(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_dumprings(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_dumprings(public.geometry) TO service_role;


--
-- Name: FUNCTION st_dumpsegments(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dumpsegments(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_dumpsegments(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_dumpsegments(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_dumpsegments(public.geometry) TO service_role;


--
-- Name: FUNCTION st_dwithin(text, text, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dwithin(text, text, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_dwithin(text, text, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_dwithin(text, text, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_dwithin(text, text, double precision) TO service_role;


--
-- Name: FUNCTION st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_dwithin(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) TO anon;
GRANT ALL ON FUNCTION public.st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_dwithin(geog1 public.geography, geog2 public.geography, tolerance double precision, use_spheroid boolean) TO service_role;


--
-- Name: FUNCTION st_endpoint(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_endpoint(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_endpoint(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_endpoint(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_endpoint(public.geometry) TO service_role;


--
-- Name: FUNCTION st_envelope(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_envelope(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_envelope(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_envelope(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_envelope(public.geometry) TO service_role;


--
-- Name: FUNCTION st_equals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_equals(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_equals(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_equals(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_equals(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_estimatedextent(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_estimatedextent(text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text) TO anon;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text) TO service_role;


--
-- Name: FUNCTION st_estimatedextent(text, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_estimatedextent(text, text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text, text) TO anon;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text, text) TO service_role;


--
-- Name: FUNCTION st_estimatedextent(text, text, text, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_estimatedextent(text, text, text, boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text, text, boolean) TO anon;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text, text, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_estimatedextent(text, text, text, boolean) TO service_role;


--
-- Name: FUNCTION st_expand(public.box2d, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_expand(public.box2d, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_expand(public.box2d, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_expand(public.box2d, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_expand(public.box2d, double precision) TO service_role;


--
-- Name: FUNCTION st_expand(public.box3d, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_expand(public.box3d, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_expand(public.box3d, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_expand(public.box3d, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_expand(public.box3d, double precision) TO service_role;


--
-- Name: FUNCTION st_expand(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_expand(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_expand(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_expand(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_expand(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_expand(box public.box2d, dx double precision, dy double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_expand(box public.box2d, dx double precision, dy double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_expand(box public.box2d, dx double precision, dy double precision) TO anon;
GRANT ALL ON FUNCTION public.st_expand(box public.box2d, dx double precision, dy double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_expand(box public.box2d, dx double precision, dy double precision) TO service_role;


--
-- Name: FUNCTION st_expand(box public.box3d, dx double precision, dy double precision, dz double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_expand(box public.box3d, dx double precision, dy double precision, dz double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_expand(box public.box3d, dx double precision, dy double precision, dz double precision) TO anon;
GRANT ALL ON FUNCTION public.st_expand(box public.box3d, dx double precision, dy double precision, dz double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_expand(box public.box3d, dx double precision, dy double precision, dz double precision) TO service_role;


--
-- Name: FUNCTION st_expand(geom public.geometry, dx double precision, dy double precision, dz double precision, dm double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_expand(geom public.geometry, dx double precision, dy double precision, dz double precision, dm double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_expand(geom public.geometry, dx double precision, dy double precision, dz double precision, dm double precision) TO anon;
GRANT ALL ON FUNCTION public.st_expand(geom public.geometry, dx double precision, dy double precision, dz double precision, dm double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_expand(geom public.geometry, dx double precision, dy double precision, dz double precision, dm double precision) TO service_role;


--
-- Name: FUNCTION st_exteriorring(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_exteriorring(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_exteriorring(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_exteriorring(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_exteriorring(public.geometry) TO service_role;


--
-- Name: FUNCTION st_filterbym(public.geometry, double precision, double precision, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_filterbym(public.geometry, double precision, double precision, boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_filterbym(public.geometry, double precision, double precision, boolean) TO anon;
GRANT ALL ON FUNCTION public.st_filterbym(public.geometry, double precision, double precision, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_filterbym(public.geometry, double precision, double precision, boolean) TO service_role;


--
-- Name: FUNCTION st_findextent(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_findextent(text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_findextent(text, text) TO anon;
GRANT ALL ON FUNCTION public.st_findextent(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_findextent(text, text) TO service_role;


--
-- Name: FUNCTION st_findextent(text, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_findextent(text, text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_findextent(text, text, text) TO anon;
GRANT ALL ON FUNCTION public.st_findextent(text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_findextent(text, text, text) TO service_role;


--
-- Name: FUNCTION st_flipcoordinates(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_flipcoordinates(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_flipcoordinates(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_flipcoordinates(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_flipcoordinates(public.geometry) TO service_role;


--
-- Name: FUNCTION st_force2d(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_force2d(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_force2d(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_force2d(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_force2d(public.geometry) TO service_role;


--
-- Name: FUNCTION st_force3d(geom public.geometry, zvalue double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_force3d(geom public.geometry, zvalue double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_force3d(geom public.geometry, zvalue double precision) TO anon;
GRANT ALL ON FUNCTION public.st_force3d(geom public.geometry, zvalue double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_force3d(geom public.geometry, zvalue double precision) TO service_role;


--
-- Name: FUNCTION st_force3dm(geom public.geometry, mvalue double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_force3dm(geom public.geometry, mvalue double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_force3dm(geom public.geometry, mvalue double precision) TO anon;
GRANT ALL ON FUNCTION public.st_force3dm(geom public.geometry, mvalue double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_force3dm(geom public.geometry, mvalue double precision) TO service_role;


--
-- Name: FUNCTION st_force3dz(geom public.geometry, zvalue double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_force3dz(geom public.geometry, zvalue double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_force3dz(geom public.geometry, zvalue double precision) TO anon;
GRANT ALL ON FUNCTION public.st_force3dz(geom public.geometry, zvalue double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_force3dz(geom public.geometry, zvalue double precision) TO service_role;


--
-- Name: FUNCTION st_force4d(geom public.geometry, zvalue double precision, mvalue double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_force4d(geom public.geometry, zvalue double precision, mvalue double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_force4d(geom public.geometry, zvalue double precision, mvalue double precision) TO anon;
GRANT ALL ON FUNCTION public.st_force4d(geom public.geometry, zvalue double precision, mvalue double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_force4d(geom public.geometry, zvalue double precision, mvalue double precision) TO service_role;


--
-- Name: FUNCTION st_forcecollection(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_forcecollection(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_forcecollection(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_forcecollection(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_forcecollection(public.geometry) TO service_role;


--
-- Name: FUNCTION st_forcecurve(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_forcecurve(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_forcecurve(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_forcecurve(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_forcecurve(public.geometry) TO service_role;


--
-- Name: FUNCTION st_forcepolygonccw(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_forcepolygonccw(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_forcepolygonccw(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_forcepolygonccw(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_forcepolygonccw(public.geometry) TO service_role;


--
-- Name: FUNCTION st_forcepolygoncw(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_forcepolygoncw(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_forcepolygoncw(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_forcepolygoncw(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_forcepolygoncw(public.geometry) TO service_role;


--
-- Name: FUNCTION st_forcerhr(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_forcerhr(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_forcerhr(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_forcerhr(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_forcerhr(public.geometry) TO service_role;


--
-- Name: FUNCTION st_forcesfs(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_forcesfs(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_forcesfs(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_forcesfs(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_forcesfs(public.geometry) TO service_role;


--
-- Name: FUNCTION st_forcesfs(public.geometry, version text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_forcesfs(public.geometry, version text) TO postgres;
GRANT ALL ON FUNCTION public.st_forcesfs(public.geometry, version text) TO anon;
GRANT ALL ON FUNCTION public.st_forcesfs(public.geometry, version text) TO authenticated;
GRANT ALL ON FUNCTION public.st_forcesfs(public.geometry, version text) TO service_role;


--
-- Name: FUNCTION st_frechetdistance(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_frechetdistance(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_frechetdistance(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_frechetdistance(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_frechetdistance(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_fromflatgeobuf(anyelement, bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_fromflatgeobuf(anyelement, bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_fromflatgeobuf(anyelement, bytea) TO anon;
GRANT ALL ON FUNCTION public.st_fromflatgeobuf(anyelement, bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_fromflatgeobuf(anyelement, bytea) TO service_role;


--
-- Name: FUNCTION st_fromflatgeobuftotable(text, text, bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_fromflatgeobuftotable(text, text, bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_fromflatgeobuftotable(text, text, bytea) TO anon;
GRANT ALL ON FUNCTION public.st_fromflatgeobuftotable(text, text, bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_fromflatgeobuftotable(text, text, bytea) TO service_role;


--
-- Name: FUNCTION st_generatepoints(area public.geometry, npoints integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer) TO postgres;
GRANT ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer) TO anon;
GRANT ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer) TO service_role;


--
-- Name: FUNCTION st_generatepoints(area public.geometry, npoints integer, seed integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer, seed integer) TO postgres;
GRANT ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer, seed integer) TO anon;
GRANT ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer, seed integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_generatepoints(area public.geometry, npoints integer, seed integer) TO service_role;


--
-- Name: FUNCTION st_geogfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geogfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geogfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_geogfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geogfromtext(text) TO service_role;


--
-- Name: FUNCTION st_geogfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geogfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_geogfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_geogfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_geogfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_geographyfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geographyfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geographyfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_geographyfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geographyfromtext(text) TO service_role;


--
-- Name: FUNCTION st_geohash(geog public.geography, maxchars integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geohash(geog public.geography, maxchars integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geohash(geog public.geography, maxchars integer) TO anon;
GRANT ALL ON FUNCTION public.st_geohash(geog public.geography, maxchars integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geohash(geog public.geography, maxchars integer) TO service_role;


--
-- Name: FUNCTION st_geohash(geom public.geometry, maxchars integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geohash(geom public.geometry, maxchars integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geohash(geom public.geometry, maxchars integer) TO anon;
GRANT ALL ON FUNCTION public.st_geohash(geom public.geometry, maxchars integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geohash(geom public.geometry, maxchars integer) TO service_role;


--
-- Name: FUNCTION st_geomcollfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomcollfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geomcollfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_geomcollfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomcollfromtext(text) TO service_role;


--
-- Name: FUNCTION st_geomcollfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomcollfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geomcollfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_geomcollfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomcollfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_geomcollfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomcollfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_geomcollfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_geomcollfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomcollfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_geomcollfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomcollfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geomcollfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_geomcollfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomcollfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_geometricmedian(g public.geometry, tolerance double precision, max_iter integer, fail_if_not_converged boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geometricmedian(g public.geometry, tolerance double precision, max_iter integer, fail_if_not_converged boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_geometricmedian(g public.geometry, tolerance double precision, max_iter integer, fail_if_not_converged boolean) TO anon;
GRANT ALL ON FUNCTION public.st_geometricmedian(g public.geometry, tolerance double precision, max_iter integer, fail_if_not_converged boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_geometricmedian(g public.geometry, tolerance double precision, max_iter integer, fail_if_not_converged boolean) TO service_role;


--
-- Name: FUNCTION st_geometryfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geometryfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geometryfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_geometryfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geometryfromtext(text) TO service_role;


--
-- Name: FUNCTION st_geometryfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geometryfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geometryfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_geometryfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geometryfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_geometryn(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geometryn(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geometryn(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_geometryn(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geometryn(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_geometrytype(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geometrytype(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_geometrytype(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_geometrytype(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_geometrytype(public.geometry) TO service_role;


--
-- Name: FUNCTION st_geomfromewkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromewkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromewkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromewkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromewkb(bytea) TO service_role;


--
-- Name: FUNCTION st_geomfromewkt(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromewkt(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromewkt(text) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromewkt(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromewkt(text) TO service_role;


--
-- Name: FUNCTION st_geomfromgeohash(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromgeohash(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromgeohash(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromgeohash(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromgeohash(text, integer) TO service_role;


--
-- Name: FUNCTION st_geomfromgeojson(json); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromgeojson(json) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(json) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(json) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(json) TO service_role;


--
-- Name: FUNCTION st_geomfromgeojson(jsonb); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromgeojson(jsonb) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(jsonb) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(jsonb) TO service_role;


--
-- Name: FUNCTION st_geomfromgeojson(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromgeojson(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(text) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromgeojson(text) TO service_role;


--
-- Name: FUNCTION st_geomfromgml(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromgml(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromgml(text) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromgml(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromgml(text) TO service_role;


--
-- Name: FUNCTION st_geomfromgml(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromgml(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromgml(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromgml(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromgml(text, integer) TO service_role;


--
-- Name: FUNCTION st_geomfromkml(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromkml(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromkml(text) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromkml(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromkml(text) TO service_role;


--
-- Name: FUNCTION st_geomfrommarc21(marc21xml text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfrommarc21(marc21xml text) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfrommarc21(marc21xml text) TO anon;
GRANT ALL ON FUNCTION public.st_geomfrommarc21(marc21xml text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfrommarc21(marc21xml text) TO service_role;


--
-- Name: FUNCTION st_geomfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromtext(text) TO service_role;


--
-- Name: FUNCTION st_geomfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_geomfromtwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromtwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromtwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromtwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromtwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_geomfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_geomfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_geomfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_geomfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_geomfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_geomfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_gmltosql(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_gmltosql(text) TO postgres;
GRANT ALL ON FUNCTION public.st_gmltosql(text) TO anon;
GRANT ALL ON FUNCTION public.st_gmltosql(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_gmltosql(text) TO service_role;


--
-- Name: FUNCTION st_gmltosql(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_gmltosql(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_gmltosql(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_gmltosql(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_gmltosql(text, integer) TO service_role;


--
-- Name: FUNCTION st_hasarc(geometry public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_hasarc(geometry public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_hasarc(geometry public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_hasarc(geometry public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_hasarc(geometry public.geometry) TO service_role;


--
-- Name: FUNCTION st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_hausdorffdistance(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_hexagon(size double precision, cell_i integer, cell_j integer, origin public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_hexagon(size double precision, cell_i integer, cell_j integer, origin public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_hexagon(size double precision, cell_i integer, cell_j integer, origin public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_hexagon(size double precision, cell_i integer, cell_j integer, origin public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_hexagon(size double precision, cell_i integer, cell_j integer, origin public.geometry) TO service_role;


--
-- Name: FUNCTION st_hexagongrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_hexagongrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) TO postgres;
GRANT ALL ON FUNCTION public.st_hexagongrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) TO anon;
GRANT ALL ON FUNCTION public.st_hexagongrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_hexagongrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) TO service_role;


--
-- Name: FUNCTION st_interiorringn(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_interiorringn(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_interiorringn(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_interiorringn(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_interiorringn(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_interpolatepoint(line public.geometry, point public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_interpolatepoint(line public.geometry, point public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_interpolatepoint(line public.geometry, point public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_interpolatepoint(line public.geometry, point public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_interpolatepoint(line public.geometry, point public.geometry) TO service_role;


--
-- Name: FUNCTION st_intersection(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_intersection(text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_intersection(text, text) TO anon;
GRANT ALL ON FUNCTION public.st_intersection(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_intersection(text, text) TO service_role;


--
-- Name: FUNCTION st_intersection(public.geography, public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_intersection(public.geography, public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_intersection(public.geography, public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_intersection(public.geography, public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_intersection(public.geography, public.geography) TO service_role;


--
-- Name: FUNCTION st_intersection(geom1 public.geometry, geom2 public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_intersection(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_intersection(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO anon;
GRANT ALL ON FUNCTION public.st_intersection(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_intersection(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO service_role;


--
-- Name: FUNCTION st_intersects(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_intersects(text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_intersects(text, text) TO anon;
GRANT ALL ON FUNCTION public.st_intersects(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_intersects(text, text) TO service_role;


--
-- Name: FUNCTION st_intersects(geog1 public.geography, geog2 public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_intersects(geog1 public.geography, geog2 public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_intersects(geog1 public.geography, geog2 public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_intersects(geog1 public.geography, geog2 public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_intersects(geog1 public.geography, geog2 public.geography) TO service_role;


--
-- Name: FUNCTION st_intersects(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_intersects(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_intersects(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_intersects(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_intersects(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_isclosed(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isclosed(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_isclosed(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_isclosed(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_isclosed(public.geometry) TO service_role;


--
-- Name: FUNCTION st_iscollection(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_iscollection(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_iscollection(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_iscollection(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_iscollection(public.geometry) TO service_role;


--
-- Name: FUNCTION st_isempty(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isempty(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_isempty(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_isempty(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_isempty(public.geometry) TO service_role;


--
-- Name: FUNCTION st_ispolygonccw(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_ispolygonccw(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_ispolygonccw(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_ispolygonccw(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_ispolygonccw(public.geometry) TO service_role;


--
-- Name: FUNCTION st_ispolygoncw(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_ispolygoncw(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_ispolygoncw(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_ispolygoncw(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_ispolygoncw(public.geometry) TO service_role;


--
-- Name: FUNCTION st_isring(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isring(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_isring(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_isring(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_isring(public.geometry) TO service_role;


--
-- Name: FUNCTION st_issimple(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_issimple(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_issimple(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_issimple(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_issimple(public.geometry) TO service_role;


--
-- Name: FUNCTION st_isvalid(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isvalid(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_isvalid(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_isvalid(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_isvalid(public.geometry) TO service_role;


--
-- Name: FUNCTION st_isvalid(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isvalid(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_isvalid(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_isvalid(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_isvalid(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_isvaliddetail(geom public.geometry, flags integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isvaliddetail(geom public.geometry, flags integer) TO postgres;
GRANT ALL ON FUNCTION public.st_isvaliddetail(geom public.geometry, flags integer) TO anon;
GRANT ALL ON FUNCTION public.st_isvaliddetail(geom public.geometry, flags integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_isvaliddetail(geom public.geometry, flags integer) TO service_role;


--
-- Name: FUNCTION st_isvalidreason(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isvalidreason(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_isvalidreason(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_isvalidreason(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_isvalidreason(public.geometry) TO service_role;


--
-- Name: FUNCTION st_isvalidreason(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isvalidreason(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_isvalidreason(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_isvalidreason(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_isvalidreason(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_isvalidtrajectory(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_isvalidtrajectory(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_isvalidtrajectory(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_isvalidtrajectory(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_isvalidtrajectory(public.geometry) TO service_role;


--
-- Name: FUNCTION st_length(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_length(text) TO postgres;
GRANT ALL ON FUNCTION public.st_length(text) TO anon;
GRANT ALL ON FUNCTION public.st_length(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_length(text) TO service_role;


--
-- Name: FUNCTION st_length(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_length(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_length(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_length(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_length(public.geometry) TO service_role;


--
-- Name: FUNCTION st_length(geog public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_length(geog public.geography, use_spheroid boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_length(geog public.geography, use_spheroid boolean) TO anon;
GRANT ALL ON FUNCTION public.st_length(geog public.geography, use_spheroid boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_length(geog public.geography, use_spheroid boolean) TO service_role;


--
-- Name: FUNCTION st_length2d(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_length2d(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_length2d(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_length2d(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_length2d(public.geometry) TO service_role;


--
-- Name: FUNCTION st_length2dspheroid(public.geometry, public.spheroid); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_length2dspheroid(public.geometry, public.spheroid) TO postgres;
GRANT ALL ON FUNCTION public.st_length2dspheroid(public.geometry, public.spheroid) TO anon;
GRANT ALL ON FUNCTION public.st_length2dspheroid(public.geometry, public.spheroid) TO authenticated;
GRANT ALL ON FUNCTION public.st_length2dspheroid(public.geometry, public.spheroid) TO service_role;


--
-- Name: FUNCTION st_lengthspheroid(public.geometry, public.spheroid); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_lengthspheroid(public.geometry, public.spheroid) TO postgres;
GRANT ALL ON FUNCTION public.st_lengthspheroid(public.geometry, public.spheroid) TO anon;
GRANT ALL ON FUNCTION public.st_lengthspheroid(public.geometry, public.spheroid) TO authenticated;
GRANT ALL ON FUNCTION public.st_lengthspheroid(public.geometry, public.spheroid) TO service_role;


--
-- Name: FUNCTION st_letters(letters text, font json); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_letters(letters text, font json) TO postgres;
GRANT ALL ON FUNCTION public.st_letters(letters text, font json) TO anon;
GRANT ALL ON FUNCTION public.st_letters(letters text, font json) TO authenticated;
GRANT ALL ON FUNCTION public.st_letters(letters text, font json) TO service_role;


--
-- Name: FUNCTION st_linecrossingdirection(line1 public.geometry, line2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linecrossingdirection(line1 public.geometry, line2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_linecrossingdirection(line1 public.geometry, line2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_linecrossingdirection(line1 public.geometry, line2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_linecrossingdirection(line1 public.geometry, line2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_linefromencodedpolyline(txtin text, nprecision integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linefromencodedpolyline(txtin text, nprecision integer) TO postgres;
GRANT ALL ON FUNCTION public.st_linefromencodedpolyline(txtin text, nprecision integer) TO anon;
GRANT ALL ON FUNCTION public.st_linefromencodedpolyline(txtin text, nprecision integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_linefromencodedpolyline(txtin text, nprecision integer) TO service_role;


--
-- Name: FUNCTION st_linefrommultipoint(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linefrommultipoint(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_linefrommultipoint(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_linefrommultipoint(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_linefrommultipoint(public.geometry) TO service_role;


--
-- Name: FUNCTION st_linefromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linefromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_linefromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_linefromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_linefromtext(text) TO service_role;


--
-- Name: FUNCTION st_linefromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linefromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_linefromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_linefromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_linefromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_linefromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linefromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_linefromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_linefromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_linefromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_linefromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linefromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_linefromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_linefromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_linefromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_lineinterpolatepoint(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_lineinterpolatepoint(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_lineinterpolatepoint(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_lineinterpolatepoint(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_lineinterpolatepoint(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_lineinterpolatepoints(public.geometry, double precision, repeat boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_lineinterpolatepoints(public.geometry, double precision, repeat boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_lineinterpolatepoints(public.geometry, double precision, repeat boolean) TO anon;
GRANT ALL ON FUNCTION public.st_lineinterpolatepoints(public.geometry, double precision, repeat boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_lineinterpolatepoints(public.geometry, double precision, repeat boolean) TO service_role;


--
-- Name: FUNCTION st_linelocatepoint(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linelocatepoint(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_linelocatepoint(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_linelocatepoint(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_linelocatepoint(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_linemerge(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linemerge(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_linemerge(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_linemerge(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_linemerge(public.geometry) TO service_role;


--
-- Name: FUNCTION st_linemerge(public.geometry, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linemerge(public.geometry, boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_linemerge(public.geometry, boolean) TO anon;
GRANT ALL ON FUNCTION public.st_linemerge(public.geometry, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_linemerge(public.geometry, boolean) TO service_role;


--
-- Name: FUNCTION st_linestringfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linestringfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_linestringfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_linestringfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_linestringfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_linestringfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linestringfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_linestringfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_linestringfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_linestringfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_linesubstring(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linesubstring(public.geometry, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_linesubstring(public.geometry, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_linesubstring(public.geometry, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_linesubstring(public.geometry, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_linetocurve(geometry public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_linetocurve(geometry public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_linetocurve(geometry public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_linetocurve(geometry public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_linetocurve(geometry public.geometry) TO service_role;


--
-- Name: FUNCTION st_locatealong(geometry public.geometry, measure double precision, leftrightoffset double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_locatealong(geometry public.geometry, measure double precision, leftrightoffset double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_locatealong(geometry public.geometry, measure double precision, leftrightoffset double precision) TO anon;
GRANT ALL ON FUNCTION public.st_locatealong(geometry public.geometry, measure double precision, leftrightoffset double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_locatealong(geometry public.geometry, measure double precision, leftrightoffset double precision) TO service_role;


--
-- Name: FUNCTION st_locatebetween(geometry public.geometry, frommeasure double precision, tomeasure double precision, leftrightoffset double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_locatebetween(geometry public.geometry, frommeasure double precision, tomeasure double precision, leftrightoffset double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_locatebetween(geometry public.geometry, frommeasure double precision, tomeasure double precision, leftrightoffset double precision) TO anon;
GRANT ALL ON FUNCTION public.st_locatebetween(geometry public.geometry, frommeasure double precision, tomeasure double precision, leftrightoffset double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_locatebetween(geometry public.geometry, frommeasure double precision, tomeasure double precision, leftrightoffset double precision) TO service_role;


--
-- Name: FUNCTION st_locatebetweenelevations(geometry public.geometry, fromelevation double precision, toelevation double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_locatebetweenelevations(geometry public.geometry, fromelevation double precision, toelevation double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_locatebetweenelevations(geometry public.geometry, fromelevation double precision, toelevation double precision) TO anon;
GRANT ALL ON FUNCTION public.st_locatebetweenelevations(geometry public.geometry, fromelevation double precision, toelevation double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_locatebetweenelevations(geometry public.geometry, fromelevation double precision, toelevation double precision) TO service_role;


--
-- Name: FUNCTION st_longestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_longestline(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_longestline(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_longestline(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_longestline(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_m(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_m(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_m(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_m(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_m(public.geometry) TO service_role;


--
-- Name: FUNCTION st_makebox2d(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makebox2d(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_makebox2d(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_makebox2d(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_makebox2d(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_makeenvelope(double precision, double precision, double precision, double precision, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makeenvelope(double precision, double precision, double precision, double precision, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_makeenvelope(double precision, double precision, double precision, double precision, integer) TO anon;
GRANT ALL ON FUNCTION public.st_makeenvelope(double precision, double precision, double precision, double precision, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_makeenvelope(double precision, double precision, double precision, double precision, integer) TO service_role;


--
-- Name: FUNCTION st_makeline(public.geometry[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makeline(public.geometry[]) TO postgres;
GRANT ALL ON FUNCTION public.st_makeline(public.geometry[]) TO anon;
GRANT ALL ON FUNCTION public.st_makeline(public.geometry[]) TO authenticated;
GRANT ALL ON FUNCTION public.st_makeline(public.geometry[]) TO service_role;


--
-- Name: FUNCTION st_makeline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makeline(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_makeline(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_makeline(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_makeline(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_makepoint(double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_makepoint(double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_makepoint(double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_makepoint(double precision, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_makepointm(double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makepointm(double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_makepointm(double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_makepointm(double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_makepointm(double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_makepolygon(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makepolygon(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_makepolygon(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_makepolygon(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_makepolygon(public.geometry) TO service_role;


--
-- Name: FUNCTION st_makepolygon(public.geometry, public.geometry[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makepolygon(public.geometry, public.geometry[]) TO postgres;
GRANT ALL ON FUNCTION public.st_makepolygon(public.geometry, public.geometry[]) TO anon;
GRANT ALL ON FUNCTION public.st_makepolygon(public.geometry, public.geometry[]) TO authenticated;
GRANT ALL ON FUNCTION public.st_makepolygon(public.geometry, public.geometry[]) TO service_role;


--
-- Name: FUNCTION st_makevalid(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makevalid(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_makevalid(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_makevalid(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_makevalid(public.geometry) TO service_role;


--
-- Name: FUNCTION st_makevalid(geom public.geometry, params text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makevalid(geom public.geometry, params text) TO postgres;
GRANT ALL ON FUNCTION public.st_makevalid(geom public.geometry, params text) TO anon;
GRANT ALL ON FUNCTION public.st_makevalid(geom public.geometry, params text) TO authenticated;
GRANT ALL ON FUNCTION public.st_makevalid(geom public.geometry, params text) TO service_role;


--
-- Name: FUNCTION st_maxdistance(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_maxdistance(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_maxdistance(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_maxdistance(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_maxdistance(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_maximuminscribedcircle(public.geometry, OUT center public.geometry, OUT nearest public.geometry, OUT radius double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_maximuminscribedcircle(public.geometry, OUT center public.geometry, OUT nearest public.geometry, OUT radius double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_maximuminscribedcircle(public.geometry, OUT center public.geometry, OUT nearest public.geometry, OUT radius double precision) TO anon;
GRANT ALL ON FUNCTION public.st_maximuminscribedcircle(public.geometry, OUT center public.geometry, OUT nearest public.geometry, OUT radius double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_maximuminscribedcircle(public.geometry, OUT center public.geometry, OUT nearest public.geometry, OUT radius double precision) TO service_role;


--
-- Name: FUNCTION st_memsize(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_memsize(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_memsize(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_memsize(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_memsize(public.geometry) TO service_role;


--
-- Name: FUNCTION st_minimumboundingcircle(inputgeom public.geometry, segs_per_quarter integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_minimumboundingcircle(inputgeom public.geometry, segs_per_quarter integer) TO postgres;
GRANT ALL ON FUNCTION public.st_minimumboundingcircle(inputgeom public.geometry, segs_per_quarter integer) TO anon;
GRANT ALL ON FUNCTION public.st_minimumboundingcircle(inputgeom public.geometry, segs_per_quarter integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_minimumboundingcircle(inputgeom public.geometry, segs_per_quarter integer) TO service_role;


--
-- Name: FUNCTION st_minimumboundingradius(public.geometry, OUT center public.geometry, OUT radius double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_minimumboundingradius(public.geometry, OUT center public.geometry, OUT radius double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_minimumboundingradius(public.geometry, OUT center public.geometry, OUT radius double precision) TO anon;
GRANT ALL ON FUNCTION public.st_minimumboundingradius(public.geometry, OUT center public.geometry, OUT radius double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_minimumboundingradius(public.geometry, OUT center public.geometry, OUT radius double precision) TO service_role;


--
-- Name: FUNCTION st_minimumclearance(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_minimumclearance(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_minimumclearance(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_minimumclearance(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_minimumclearance(public.geometry) TO service_role;


--
-- Name: FUNCTION st_minimumclearanceline(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_minimumclearanceline(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_minimumclearanceline(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_minimumclearanceline(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_minimumclearanceline(public.geometry) TO service_role;


--
-- Name: FUNCTION st_mlinefromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mlinefromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_mlinefromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_mlinefromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_mlinefromtext(text) TO service_role;


--
-- Name: FUNCTION st_mlinefromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mlinefromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_mlinefromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_mlinefromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_mlinefromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_mlinefromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mlinefromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_mlinefromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_mlinefromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_mlinefromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_mlinefromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mlinefromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_mlinefromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_mlinefromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_mlinefromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_mpointfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mpointfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_mpointfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_mpointfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_mpointfromtext(text) TO service_role;


--
-- Name: FUNCTION st_mpointfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mpointfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_mpointfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_mpointfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_mpointfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_mpointfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mpointfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_mpointfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_mpointfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_mpointfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_mpointfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mpointfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_mpointfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_mpointfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_mpointfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_mpolyfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mpolyfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_mpolyfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_mpolyfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_mpolyfromtext(text) TO service_role;


--
-- Name: FUNCTION st_mpolyfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mpolyfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_mpolyfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_mpolyfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_mpolyfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_mpolyfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mpolyfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_mpolyfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_mpolyfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_mpolyfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_mpolyfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_mpolyfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_mpolyfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_mpolyfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_mpolyfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_multi(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multi(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_multi(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_multi(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_multi(public.geometry) TO service_role;


--
-- Name: FUNCTION st_multilinefromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multilinefromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_multilinefromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_multilinefromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_multilinefromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_multilinestringfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multilinestringfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_multilinestringfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_multilinestringfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_multilinestringfromtext(text) TO service_role;


--
-- Name: FUNCTION st_multilinestringfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multilinestringfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_multilinestringfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_multilinestringfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_multilinestringfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_multipointfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multipointfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_multipointfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_multipointfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_multipointfromtext(text) TO service_role;


--
-- Name: FUNCTION st_multipointfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multipointfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_multipointfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_multipointfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_multipointfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_multipointfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multipointfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_multipointfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_multipointfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_multipointfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_multipolyfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multipolyfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_multipolyfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_multipolyfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_multipolyfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_multipolyfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multipolyfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_multipolyfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_multipolyfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_multipolyfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_multipolygonfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multipolygonfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_multipolygonfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_multipolygonfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_multipolygonfromtext(text) TO service_role;


--
-- Name: FUNCTION st_multipolygonfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_multipolygonfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_multipolygonfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_multipolygonfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_multipolygonfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_ndims(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_ndims(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_ndims(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_ndims(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_ndims(public.geometry) TO service_role;


--
-- Name: FUNCTION st_node(g public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_node(g public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_node(g public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_node(g public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_node(g public.geometry) TO service_role;


--
-- Name: FUNCTION st_normalize(geom public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_normalize(geom public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_normalize(geom public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_normalize(geom public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_normalize(geom public.geometry) TO service_role;


--
-- Name: FUNCTION st_npoints(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_npoints(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_npoints(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_npoints(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_npoints(public.geometry) TO service_role;


--
-- Name: FUNCTION st_nrings(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_nrings(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_nrings(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_nrings(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_nrings(public.geometry) TO service_role;


--
-- Name: FUNCTION st_numgeometries(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_numgeometries(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_numgeometries(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_numgeometries(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_numgeometries(public.geometry) TO service_role;


--
-- Name: FUNCTION st_numinteriorring(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_numinteriorring(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_numinteriorring(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_numinteriorring(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_numinteriorring(public.geometry) TO service_role;


--
-- Name: FUNCTION st_numinteriorrings(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_numinteriorrings(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_numinteriorrings(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_numinteriorrings(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_numinteriorrings(public.geometry) TO service_role;


--
-- Name: FUNCTION st_numpatches(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_numpatches(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_numpatches(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_numpatches(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_numpatches(public.geometry) TO service_role;


--
-- Name: FUNCTION st_numpoints(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_numpoints(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_numpoints(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_numpoints(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_numpoints(public.geometry) TO service_role;


--
-- Name: FUNCTION st_offsetcurve(line public.geometry, distance double precision, params text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_offsetcurve(line public.geometry, distance double precision, params text) TO postgres;
GRANT ALL ON FUNCTION public.st_offsetcurve(line public.geometry, distance double precision, params text) TO anon;
GRANT ALL ON FUNCTION public.st_offsetcurve(line public.geometry, distance double precision, params text) TO authenticated;
GRANT ALL ON FUNCTION public.st_offsetcurve(line public.geometry, distance double precision, params text) TO service_role;


--
-- Name: FUNCTION st_orderingequals(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_orderingequals(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_orderingequals(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_orderingequals(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_orderingequals(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_orientedenvelope(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_orientedenvelope(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_orientedenvelope(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_orientedenvelope(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_orientedenvelope(public.geometry) TO service_role;


--
-- Name: FUNCTION st_overlaps(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_overlaps(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_overlaps(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_overlaps(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_overlaps(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_patchn(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_patchn(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_patchn(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_patchn(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_patchn(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_perimeter(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_perimeter(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_perimeter(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_perimeter(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_perimeter(public.geometry) TO service_role;


--
-- Name: FUNCTION st_perimeter(geog public.geography, use_spheroid boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_perimeter(geog public.geography, use_spheroid boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_perimeter(geog public.geography, use_spheroid boolean) TO anon;
GRANT ALL ON FUNCTION public.st_perimeter(geog public.geography, use_spheroid boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_perimeter(geog public.geography, use_spheroid boolean) TO service_role;


--
-- Name: FUNCTION st_perimeter2d(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_perimeter2d(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_perimeter2d(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_perimeter2d(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_perimeter2d(public.geometry) TO service_role;


--
-- Name: FUNCTION st_point(double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_point(double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_point(double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_point(double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_point(double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_point(double precision, double precision, srid integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_point(double precision, double precision, srid integer) TO postgres;
GRANT ALL ON FUNCTION public.st_point(double precision, double precision, srid integer) TO anon;
GRANT ALL ON FUNCTION public.st_point(double precision, double precision, srid integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_point(double precision, double precision, srid integer) TO service_role;


--
-- Name: FUNCTION st_pointfromgeohash(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointfromgeohash(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_pointfromgeohash(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_pointfromgeohash(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointfromgeohash(text, integer) TO service_role;


--
-- Name: FUNCTION st_pointfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_pointfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_pointfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointfromtext(text) TO service_role;


--
-- Name: FUNCTION st_pointfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_pointfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_pointfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_pointfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_pointfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_pointfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_pointfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_pointfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_pointfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_pointinsidecircle(public.geometry, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointinsidecircle(public.geometry, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_pointinsidecircle(public.geometry, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_pointinsidecircle(public.geometry, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointinsidecircle(public.geometry, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_pointm(xcoordinate double precision, ycoordinate double precision, mcoordinate double precision, srid integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointm(xcoordinate double precision, ycoordinate double precision, mcoordinate double precision, srid integer) TO postgres;
GRANT ALL ON FUNCTION public.st_pointm(xcoordinate double precision, ycoordinate double precision, mcoordinate double precision, srid integer) TO anon;
GRANT ALL ON FUNCTION public.st_pointm(xcoordinate double precision, ycoordinate double precision, mcoordinate double precision, srid integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointm(xcoordinate double precision, ycoordinate double precision, mcoordinate double precision, srid integer) TO service_role;


--
-- Name: FUNCTION st_pointn(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointn(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_pointn(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_pointn(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointn(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_pointonsurface(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointonsurface(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_pointonsurface(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_pointonsurface(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointonsurface(public.geometry) TO service_role;


--
-- Name: FUNCTION st_points(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_points(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_points(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_points(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_points(public.geometry) TO service_role;


--
-- Name: FUNCTION st_pointz(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, srid integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointz(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, srid integer) TO postgres;
GRANT ALL ON FUNCTION public.st_pointz(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, srid integer) TO anon;
GRANT ALL ON FUNCTION public.st_pointz(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, srid integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointz(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, srid integer) TO service_role;


--
-- Name: FUNCTION st_pointzm(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, mcoordinate double precision, srid integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_pointzm(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, mcoordinate double precision, srid integer) TO postgres;
GRANT ALL ON FUNCTION public.st_pointzm(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, mcoordinate double precision, srid integer) TO anon;
GRANT ALL ON FUNCTION public.st_pointzm(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, mcoordinate double precision, srid integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_pointzm(xcoordinate double precision, ycoordinate double precision, zcoordinate double precision, mcoordinate double precision, srid integer) TO service_role;


--
-- Name: FUNCTION st_polyfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polyfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_polyfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_polyfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_polyfromtext(text) TO service_role;


--
-- Name: FUNCTION st_polyfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polyfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_polyfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_polyfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_polyfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_polyfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polyfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_polyfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_polyfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_polyfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_polyfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polyfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_polyfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_polyfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_polyfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_polygon(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polygon(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_polygon(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_polygon(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_polygon(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_polygonfromtext(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polygonfromtext(text) TO postgres;
GRANT ALL ON FUNCTION public.st_polygonfromtext(text) TO anon;
GRANT ALL ON FUNCTION public.st_polygonfromtext(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_polygonfromtext(text) TO service_role;


--
-- Name: FUNCTION st_polygonfromtext(text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polygonfromtext(text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_polygonfromtext(text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_polygonfromtext(text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_polygonfromtext(text, integer) TO service_role;


--
-- Name: FUNCTION st_polygonfromwkb(bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polygonfromwkb(bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_polygonfromwkb(bytea) TO anon;
GRANT ALL ON FUNCTION public.st_polygonfromwkb(bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_polygonfromwkb(bytea) TO service_role;


--
-- Name: FUNCTION st_polygonfromwkb(bytea, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polygonfromwkb(bytea, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_polygonfromwkb(bytea, integer) TO anon;
GRANT ALL ON FUNCTION public.st_polygonfromwkb(bytea, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_polygonfromwkb(bytea, integer) TO service_role;


--
-- Name: FUNCTION st_polygonize(public.geometry[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polygonize(public.geometry[]) TO postgres;
GRANT ALL ON FUNCTION public.st_polygonize(public.geometry[]) TO anon;
GRANT ALL ON FUNCTION public.st_polygonize(public.geometry[]) TO authenticated;
GRANT ALL ON FUNCTION public.st_polygonize(public.geometry[]) TO service_role;


--
-- Name: FUNCTION st_project(geog public.geography, distance double precision, azimuth double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_project(geog public.geography, distance double precision, azimuth double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_project(geog public.geography, distance double precision, azimuth double precision) TO anon;
GRANT ALL ON FUNCTION public.st_project(geog public.geography, distance double precision, azimuth double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_project(geog public.geography, distance double precision, azimuth double precision) TO service_role;


--
-- Name: FUNCTION st_quantizecoordinates(g public.geometry, prec_x integer, prec_y integer, prec_z integer, prec_m integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_quantizecoordinates(g public.geometry, prec_x integer, prec_y integer, prec_z integer, prec_m integer) TO postgres;
GRANT ALL ON FUNCTION public.st_quantizecoordinates(g public.geometry, prec_x integer, prec_y integer, prec_z integer, prec_m integer) TO anon;
GRANT ALL ON FUNCTION public.st_quantizecoordinates(g public.geometry, prec_x integer, prec_y integer, prec_z integer, prec_m integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_quantizecoordinates(g public.geometry, prec_x integer, prec_y integer, prec_z integer, prec_m integer) TO service_role;


--
-- Name: FUNCTION st_reduceprecision(geom public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_reduceprecision(geom public.geometry, gridsize double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_reduceprecision(geom public.geometry, gridsize double precision) TO anon;
GRANT ALL ON FUNCTION public.st_reduceprecision(geom public.geometry, gridsize double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_reduceprecision(geom public.geometry, gridsize double precision) TO service_role;


--
-- Name: FUNCTION st_relate(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_relate(geom1 public.geometry, geom2 public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_relate(geom1 public.geometry, geom2 public.geometry, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, text) TO postgres;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, text) TO anon;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_relate(geom1 public.geometry, geom2 public.geometry, text) TO service_role;


--
-- Name: FUNCTION st_relatematch(text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_relatematch(text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_relatematch(text, text) TO anon;
GRANT ALL ON FUNCTION public.st_relatematch(text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_relatematch(text, text) TO service_role;


--
-- Name: FUNCTION st_removepoint(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_removepoint(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_removepoint(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_removepoint(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_removepoint(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_removerepeatedpoints(geom public.geometry, tolerance double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_removerepeatedpoints(geom public.geometry, tolerance double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_removerepeatedpoints(geom public.geometry, tolerance double precision) TO anon;
GRANT ALL ON FUNCTION public.st_removerepeatedpoints(geom public.geometry, tolerance double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_removerepeatedpoints(geom public.geometry, tolerance double precision) TO service_role;


--
-- Name: FUNCTION st_reverse(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_reverse(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_reverse(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_reverse(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_reverse(public.geometry) TO service_role;


--
-- Name: FUNCTION st_rotate(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_rotate(public.geometry, double precision, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision, public.geometry) TO service_role;


--
-- Name: FUNCTION st_rotate(public.geometry, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_rotate(public.geometry, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_rotatex(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_rotatex(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_rotatex(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_rotatex(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_rotatex(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_rotatey(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_rotatey(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_rotatey(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_rotatey(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_rotatey(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_rotatez(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_rotatez(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_rotatez(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_rotatez(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_rotatez(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_scale(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_scale(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION st_scale(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_scale(public.geometry, public.geometry, origin public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_scale(public.geometry, public.geometry, origin public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, public.geometry, origin public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, public.geometry, origin public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, public.geometry, origin public.geometry) TO service_role;


--
-- Name: FUNCTION st_scale(public.geometry, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_scale(public.geometry, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_scroll(public.geometry, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_scroll(public.geometry, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_scroll(public.geometry, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_scroll(public.geometry, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_scroll(public.geometry, public.geometry) TO service_role;


--
-- Name: FUNCTION st_segmentize(geog public.geography, max_segment_length double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_segmentize(geog public.geography, max_segment_length double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_segmentize(geog public.geography, max_segment_length double precision) TO anon;
GRANT ALL ON FUNCTION public.st_segmentize(geog public.geography, max_segment_length double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_segmentize(geog public.geography, max_segment_length double precision) TO service_role;


--
-- Name: FUNCTION st_segmentize(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_segmentize(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_segmentize(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_segmentize(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_segmentize(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_seteffectivearea(public.geometry, double precision, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_seteffectivearea(public.geometry, double precision, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_seteffectivearea(public.geometry, double precision, integer) TO anon;
GRANT ALL ON FUNCTION public.st_seteffectivearea(public.geometry, double precision, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_seteffectivearea(public.geometry, double precision, integer) TO service_role;


--
-- Name: FUNCTION st_setpoint(public.geometry, integer, public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_setpoint(public.geometry, integer, public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_setpoint(public.geometry, integer, public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_setpoint(public.geometry, integer, public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_setpoint(public.geometry, integer, public.geometry) TO service_role;


--
-- Name: FUNCTION st_setsrid(geog public.geography, srid integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_setsrid(geog public.geography, srid integer) TO postgres;
GRANT ALL ON FUNCTION public.st_setsrid(geog public.geography, srid integer) TO anon;
GRANT ALL ON FUNCTION public.st_setsrid(geog public.geography, srid integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_setsrid(geog public.geography, srid integer) TO service_role;


--
-- Name: FUNCTION st_setsrid(geom public.geometry, srid integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_setsrid(geom public.geometry, srid integer) TO postgres;
GRANT ALL ON FUNCTION public.st_setsrid(geom public.geometry, srid integer) TO anon;
GRANT ALL ON FUNCTION public.st_setsrid(geom public.geometry, srid integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_setsrid(geom public.geometry, srid integer) TO service_role;


--
-- Name: FUNCTION st_sharedpaths(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_sharedpaths(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_sharedpaths(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_sharedpaths(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_sharedpaths(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_shiftlongitude(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_shiftlongitude(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_shiftlongitude(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_shiftlongitude(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_shiftlongitude(public.geometry) TO service_role;


--
-- Name: FUNCTION st_shortestline(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_shortestline(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_shortestline(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_shortestline(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_shortestline(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_simplify(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_simplify(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_simplify(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_simplify(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_simplify(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_simplify(public.geometry, double precision, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_simplify(public.geometry, double precision, boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_simplify(public.geometry, double precision, boolean) TO anon;
GRANT ALL ON FUNCTION public.st_simplify(public.geometry, double precision, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_simplify(public.geometry, double precision, boolean) TO service_role;


--
-- Name: FUNCTION st_simplifypolygonhull(geom public.geometry, vertex_fraction double precision, is_outer boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_simplifypolygonhull(geom public.geometry, vertex_fraction double precision, is_outer boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_simplifypolygonhull(geom public.geometry, vertex_fraction double precision, is_outer boolean) TO anon;
GRANT ALL ON FUNCTION public.st_simplifypolygonhull(geom public.geometry, vertex_fraction double precision, is_outer boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_simplifypolygonhull(geom public.geometry, vertex_fraction double precision, is_outer boolean) TO service_role;


--
-- Name: FUNCTION st_simplifypreservetopology(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_simplifypreservetopology(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_simplifypreservetopology(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_simplifypreservetopology(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_simplifypreservetopology(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_simplifyvw(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_simplifyvw(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_simplifyvw(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_simplifyvw(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_simplifyvw(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_snap(geom1 public.geometry, geom2 public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_snap(geom1 public.geometry, geom2 public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_snap(geom1 public.geometry, geom2 public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_snap(geom1 public.geometry, geom2 public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_snap(geom1 public.geometry, geom2 public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_snaptogrid(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_snaptogrid(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_snaptogrid(public.geometry, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_snaptogrid(public.geometry, double precision, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_snaptogrid(geom1 public.geometry, geom2 public.geometry, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_snaptogrid(geom1 public.geometry, geom2 public.geometry, double precision, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_snaptogrid(geom1 public.geometry, geom2 public.geometry, double precision, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_snaptogrid(geom1 public.geometry, geom2 public.geometry, double precision, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_snaptogrid(geom1 public.geometry, geom2 public.geometry, double precision, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_split(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_split(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_split(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_split(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_split(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_square(size double precision, cell_i integer, cell_j integer, origin public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_square(size double precision, cell_i integer, cell_j integer, origin public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_square(size double precision, cell_i integer, cell_j integer, origin public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_square(size double precision, cell_i integer, cell_j integer, origin public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_square(size double precision, cell_i integer, cell_j integer, origin public.geometry) TO service_role;


--
-- Name: FUNCTION st_squaregrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_squaregrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) TO postgres;
GRANT ALL ON FUNCTION public.st_squaregrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) TO anon;
GRANT ALL ON FUNCTION public.st_squaregrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_squaregrid(size double precision, bounds public.geometry, OUT geom public.geometry, OUT i integer, OUT j integer) TO service_role;


--
-- Name: FUNCTION st_srid(geog public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_srid(geog public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_srid(geog public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_srid(geog public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_srid(geog public.geography) TO service_role;


--
-- Name: FUNCTION st_srid(geom public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_srid(geom public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_srid(geom public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_srid(geom public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_srid(geom public.geometry) TO service_role;


--
-- Name: FUNCTION st_startpoint(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_startpoint(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_startpoint(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_startpoint(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_startpoint(public.geometry) TO service_role;


--
-- Name: FUNCTION st_subdivide(geom public.geometry, maxvertices integer, gridsize double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_subdivide(geom public.geometry, maxvertices integer, gridsize double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_subdivide(geom public.geometry, maxvertices integer, gridsize double precision) TO anon;
GRANT ALL ON FUNCTION public.st_subdivide(geom public.geometry, maxvertices integer, gridsize double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_subdivide(geom public.geometry, maxvertices integer, gridsize double precision) TO service_role;


--
-- Name: FUNCTION st_summary(public.geography); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_summary(public.geography) TO postgres;
GRANT ALL ON FUNCTION public.st_summary(public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_summary(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_summary(public.geography) TO service_role;


--
-- Name: FUNCTION st_summary(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_summary(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_summary(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_summary(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_summary(public.geometry) TO service_role;


--
-- Name: FUNCTION st_swapordinates(geom public.geometry, ords cstring); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_swapordinates(geom public.geometry, ords cstring) TO postgres;
GRANT ALL ON FUNCTION public.st_swapordinates(geom public.geometry, ords cstring) TO anon;
GRANT ALL ON FUNCTION public.st_swapordinates(geom public.geometry, ords cstring) TO authenticated;
GRANT ALL ON FUNCTION public.st_swapordinates(geom public.geometry, ords cstring) TO service_role;


--
-- Name: FUNCTION st_symdifference(geom1 public.geometry, geom2 public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_symdifference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_symdifference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO anon;
GRANT ALL ON FUNCTION public.st_symdifference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_symdifference(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO service_role;


--
-- Name: FUNCTION st_symmetricdifference(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_symmetricdifference(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_symmetricdifference(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_symmetricdifference(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_symmetricdifference(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry, margin double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry, margin double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry, margin double precision) TO anon;
GRANT ALL ON FUNCTION public.st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry, margin double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_tileenvelope(zoom integer, x integer, y integer, bounds public.geometry, margin double precision) TO service_role;


--
-- Name: FUNCTION st_touches(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_touches(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_touches(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_touches(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_touches(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_transform(public.geometry, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_transform(public.geometry, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_transform(public.geometry, integer) TO anon;
GRANT ALL ON FUNCTION public.st_transform(public.geometry, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_transform(public.geometry, integer) TO service_role;


--
-- Name: FUNCTION st_transform(geom public.geometry, to_proj text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, to_proj text) TO postgres;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, to_proj text) TO anon;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, to_proj text) TO authenticated;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, to_proj text) TO service_role;


--
-- Name: FUNCTION st_transform(geom public.geometry, from_proj text, to_srid integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_srid integer) TO postgres;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_srid integer) TO anon;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_srid integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_srid integer) TO service_role;


--
-- Name: FUNCTION st_transform(geom public.geometry, from_proj text, to_proj text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_proj text) TO postgres;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_proj text) TO anon;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_proj text) TO authenticated;
GRANT ALL ON FUNCTION public.st_transform(geom public.geometry, from_proj text, to_proj text) TO service_role;


--
-- Name: FUNCTION st_translate(public.geometry, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_translate(public.geometry, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_translate(public.geometry, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_transscale(public.geometry, double precision, double precision, double precision, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_transscale(public.geometry, double precision, double precision, double precision, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_transscale(public.geometry, double precision, double precision, double precision, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_transscale(public.geometry, double precision, double precision, double precision, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_transscale(public.geometry, double precision, double precision, double precision, double precision) TO service_role;


--
-- Name: FUNCTION st_triangulatepolygon(g1 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_triangulatepolygon(g1 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_triangulatepolygon(g1 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_triangulatepolygon(g1 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_triangulatepolygon(g1 public.geometry) TO service_role;


--
-- Name: FUNCTION st_unaryunion(public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_unaryunion(public.geometry, gridsize double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_unaryunion(public.geometry, gridsize double precision) TO anon;
GRANT ALL ON FUNCTION public.st_unaryunion(public.geometry, gridsize double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_unaryunion(public.geometry, gridsize double precision) TO service_role;


--
-- Name: FUNCTION st_union(public.geometry[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_union(public.geometry[]) TO postgres;
GRANT ALL ON FUNCTION public.st_union(public.geometry[]) TO anon;
GRANT ALL ON FUNCTION public.st_union(public.geometry[]) TO authenticated;
GRANT ALL ON FUNCTION public.st_union(public.geometry[]) TO service_role;


--
-- Name: FUNCTION st_union(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_union(geom1 public.geometry, geom2 public.geometry, gridsize double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO anon;
GRANT ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_union(geom1 public.geometry, geom2 public.geometry, gridsize double precision) TO service_role;


--
-- Name: FUNCTION st_voronoilines(g1 public.geometry, tolerance double precision, extend_to public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_voronoilines(g1 public.geometry, tolerance double precision, extend_to public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_voronoilines(g1 public.geometry, tolerance double precision, extend_to public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_voronoilines(g1 public.geometry, tolerance double precision, extend_to public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_voronoilines(g1 public.geometry, tolerance double precision, extend_to public.geometry) TO service_role;


--
-- Name: FUNCTION st_voronoipolygons(g1 public.geometry, tolerance double precision, extend_to public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_voronoipolygons(g1 public.geometry, tolerance double precision, extend_to public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_voronoipolygons(g1 public.geometry, tolerance double precision, extend_to public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_voronoipolygons(g1 public.geometry, tolerance double precision, extend_to public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_voronoipolygons(g1 public.geometry, tolerance double precision, extend_to public.geometry) TO service_role;


--
-- Name: FUNCTION st_within(geom1 public.geometry, geom2 public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_within(geom1 public.geometry, geom2 public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_within(geom1 public.geometry, geom2 public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_within(geom1 public.geometry, geom2 public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_within(geom1 public.geometry, geom2 public.geometry) TO service_role;


--
-- Name: FUNCTION st_wkbtosql(wkb bytea); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_wkbtosql(wkb bytea) TO postgres;
GRANT ALL ON FUNCTION public.st_wkbtosql(wkb bytea) TO anon;
GRANT ALL ON FUNCTION public.st_wkbtosql(wkb bytea) TO authenticated;
GRANT ALL ON FUNCTION public.st_wkbtosql(wkb bytea) TO service_role;


--
-- Name: FUNCTION st_wkttosql(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_wkttosql(text) TO postgres;
GRANT ALL ON FUNCTION public.st_wkttosql(text) TO anon;
GRANT ALL ON FUNCTION public.st_wkttosql(text) TO authenticated;
GRANT ALL ON FUNCTION public.st_wkttosql(text) TO service_role;


--
-- Name: FUNCTION st_wrapx(geom public.geometry, wrap double precision, move double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_wrapx(geom public.geometry, wrap double precision, move double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_wrapx(geom public.geometry, wrap double precision, move double precision) TO anon;
GRANT ALL ON FUNCTION public.st_wrapx(geom public.geometry, wrap double precision, move double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_wrapx(geom public.geometry, wrap double precision, move double precision) TO service_role;


--
-- Name: FUNCTION st_x(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_x(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_x(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_x(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_x(public.geometry) TO service_role;


--
-- Name: FUNCTION st_x_float8(public.geography); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.st_x_float8(public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_x_float8(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_x_float8(public.geography) TO service_role;


--
-- Name: FUNCTION st_xmax(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_xmax(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.st_xmax(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.st_xmax(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.st_xmax(public.box3d) TO service_role;


--
-- Name: FUNCTION st_xmin(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_xmin(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.st_xmin(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.st_xmin(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.st_xmin(public.box3d) TO service_role;


--
-- Name: FUNCTION st_y(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_y(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_y(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_y(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_y(public.geometry) TO service_role;


--
-- Name: FUNCTION st_y_float8(public.geography); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.st_y_float8(public.geography) TO anon;
GRANT ALL ON FUNCTION public.st_y_float8(public.geography) TO authenticated;
GRANT ALL ON FUNCTION public.st_y_float8(public.geography) TO service_role;


--
-- Name: FUNCTION st_ymax(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_ymax(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.st_ymax(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.st_ymax(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.st_ymax(public.box3d) TO service_role;


--
-- Name: FUNCTION st_ymin(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_ymin(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.st_ymin(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.st_ymin(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.st_ymin(public.box3d) TO service_role;


--
-- Name: FUNCTION st_z(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_z(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_z(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_z(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_z(public.geometry) TO service_role;


--
-- Name: FUNCTION st_zmax(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_zmax(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.st_zmax(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.st_zmax(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.st_zmax(public.box3d) TO service_role;


--
-- Name: FUNCTION st_zmflag(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_zmflag(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_zmflag(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_zmflag(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_zmflag(public.geometry) TO service_role;


--
-- Name: FUNCTION st_zmin(public.box3d); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_zmin(public.box3d) TO postgres;
GRANT ALL ON FUNCTION public.st_zmin(public.box3d) TO anon;
GRANT ALL ON FUNCTION public.st_zmin(public.box3d) TO authenticated;
GRANT ALL ON FUNCTION public.st_zmin(public.box3d) TO service_role;


--
-- Name: FUNCTION unlockrows(text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.unlockrows(text) TO postgres;
GRANT ALL ON FUNCTION public.unlockrows(text) TO anon;
GRANT ALL ON FUNCTION public.unlockrows(text) TO authenticated;
GRANT ALL ON FUNCTION public.unlockrows(text) TO service_role;


--
-- Name: FUNCTION updategeometrysrid(character varying, character varying, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, integer) TO postgres;
GRANT ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, integer) TO anon;
GRANT ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, integer) TO authenticated;
GRANT ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, integer) TO service_role;


--
-- Name: FUNCTION updategeometrysrid(character varying, character varying, character varying, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, character varying, integer) TO postgres;
GRANT ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, character varying, integer) TO anon;
GRANT ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, character varying, integer) TO authenticated;
GRANT ALL ON FUNCTION public.updategeometrysrid(character varying, character varying, character varying, integer) TO service_role;


--
-- Name: FUNCTION updategeometrysrid(catalogn_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.updategeometrysrid(catalogn_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer) TO postgres;
GRANT ALL ON FUNCTION public.updategeometrysrid(catalogn_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer) TO anon;
GRANT ALL ON FUNCTION public.updategeometrysrid(catalogn_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer) TO authenticated;
GRANT ALL ON FUNCTION public.updategeometrysrid(catalogn_name character varying, schema_name character varying, table_name character varying, column_name character varying, new_srid_in integer) TO service_role;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION st_3dextent(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_3dextent(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_3dextent(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_3dextent(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_3dextent(public.geometry) TO service_role;


--
-- Name: FUNCTION st_asflatgeobuf(anyelement); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement) TO postgres;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement) TO anon;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement) TO authenticated;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement) TO service_role;


--
-- Name: FUNCTION st_asflatgeobuf(anyelement, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement, boolean) TO postgres;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement, boolean) TO anon;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement, boolean) TO service_role;


--
-- Name: FUNCTION st_asflatgeobuf(anyelement, boolean, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement, boolean, text) TO postgres;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement, boolean, text) TO anon;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement, boolean, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asflatgeobuf(anyelement, boolean, text) TO service_role;


--
-- Name: FUNCTION st_asgeobuf(anyelement); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgeobuf(anyelement) TO postgres;
GRANT ALL ON FUNCTION public.st_asgeobuf(anyelement) TO anon;
GRANT ALL ON FUNCTION public.st_asgeobuf(anyelement) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgeobuf(anyelement) TO service_role;


--
-- Name: FUNCTION st_asgeobuf(anyelement, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asgeobuf(anyelement, text) TO postgres;
GRANT ALL ON FUNCTION public.st_asgeobuf(anyelement, text) TO anon;
GRANT ALL ON FUNCTION public.st_asgeobuf(anyelement, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asgeobuf(anyelement, text) TO service_role;


--
-- Name: FUNCTION st_asmvt(anyelement); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asmvt(anyelement) TO postgres;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement) TO anon;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement) TO authenticated;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement) TO service_role;


--
-- Name: FUNCTION st_asmvt(anyelement, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text) TO postgres;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text) TO anon;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text) TO service_role;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer) TO postgres;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer) TO anon;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer) TO authenticated;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer) TO service_role;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text) TO postgres;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text) TO anon;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text) TO service_role;


--
-- Name: FUNCTION st_asmvt(anyelement, text, integer, text, text); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text, text) TO postgres;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text, text) TO anon;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.st_asmvt(anyelement, text, integer, text, text) TO service_role;


--
-- Name: FUNCTION st_clusterintersecting(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_clusterintersecting(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_clusterintersecting(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_clusterintersecting(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_clusterintersecting(public.geometry) TO service_role;


--
-- Name: FUNCTION st_clusterwithin(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_clusterwithin(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_clusterwithin(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_clusterwithin(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_clusterwithin(public.geometry, double precision) TO service_role;


--
-- Name: FUNCTION st_collect(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_collect(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_collect(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_collect(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_collect(public.geometry) TO service_role;


--
-- Name: FUNCTION st_extent(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_extent(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_extent(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_extent(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_extent(public.geometry) TO service_role;


--
-- Name: FUNCTION st_makeline(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_makeline(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_makeline(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_makeline(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_makeline(public.geometry) TO service_role;


--
-- Name: FUNCTION st_memcollect(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_memcollect(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_memcollect(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_memcollect(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_memcollect(public.geometry) TO service_role;


--
-- Name: FUNCTION st_memunion(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_memunion(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_memunion(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_memunion(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_memunion(public.geometry) TO service_role;


--
-- Name: FUNCTION st_polygonize(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_polygonize(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_polygonize(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_polygonize(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_polygonize(public.geometry) TO service_role;


--
-- Name: FUNCTION st_union(public.geometry); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_union(public.geometry) TO postgres;
GRANT ALL ON FUNCTION public.st_union(public.geometry) TO anon;
GRANT ALL ON FUNCTION public.st_union(public.geometry) TO authenticated;
GRANT ALL ON FUNCTION public.st_union(public.geometry) TO service_role;


--
-- Name: FUNCTION st_union(public.geometry, double precision); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.st_union(public.geometry, double precision) TO postgres;
GRANT ALL ON FUNCTION public.st_union(public.geometry, double precision) TO anon;
GRANT ALL ON FUNCTION public.st_union(public.geometry, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.st_union(public.geometry, double precision) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- Name: TABLE card_shows; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.card_shows TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.card_shows TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.card_shows TO service_role;


--
-- Name: TABLE dealer_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dealer_profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dealer_profiles TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.dealer_profiles TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO service_role;


--
-- Name: TABLE shared_want_lists; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.shared_want_lists TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.shared_want_lists TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.shared_want_lists TO service_role;


--
-- Name: TABLE show_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.show_participants TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.show_participants TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.show_participants TO service_role;


--
-- Name: TABLE user_cards; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_cards TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_cards TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.user_cards TO service_role;


--
-- Name: TABLE want_lists; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.want_lists TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.want_lists TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.want_lists TO service_role;


--
-- Name: TABLE zip_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.zip_codes TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.zip_codes TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.zip_codes TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE realtime.messages TO postgres;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE realtime.schema_migrations TO postgres;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE realtime.schema_migrations TO dashboard_user;
GRANT SELECT ON TABLE realtime.schema_migrations TO anon;
GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;
GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE realtime.schema_migrations TO supabase_realtime_admin;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE realtime.subscription TO postgres;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE realtime.subscription TO supabase_realtime_admin;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO supabase_realtime_admin;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.buckets TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.buckets TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.buckets TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.buckets TO postgres;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.objects TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.objects TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.objects TO service_role;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.objects TO postgres;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO service_role;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;

--
-- PostgreSQL database dump complete
--

