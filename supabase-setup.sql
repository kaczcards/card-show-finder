-- supabase-setup.sql
-- SQL commands to set up the Supabase database for the Card Show Finder app

-- 1. Enable PostGIS Extension for geographic queries
-- This extension is crucial for handling geospatial data and queries (e.g., finding shows by location).
create extension if not exists postgis with schema public;

-- 2. Create the Profiles Table
-- This table stores user-specific data and is linked to Supabase's auth.users table.
-- It holds additional profile information not directly managed by Supabase Auth.
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text not null,
  first_name text,
  last_name text,
  home_zip_code text,
  role text default 'ATTENDEE', -- e.g., 'ATTENDEE', 'DEALER', 'MVP_DEALER', 'SHOW_ORGANIZER'
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  favorite_shows text[] default '{}'::text[], -- Array of show IDs favorited by the user
  attended_shows text[] default '{}'::text[], -- Array of show IDs attended by the user
  phone_number text,
  profile_image_url text
);

-- Enable Row Level Security (RLS) for the profiles table
-- RLS ensures that users can only access or modify data they are authorized to.
alter table public.profiles enable row level security;

-- RLS Policy: Allow users to read all profiles (e.g., for displaying vendor info, etc.)
create policy "Allow users to read all profiles"
  on public.profiles for select
  to authenticated, anon -- Accessible by authenticated users and anonymous users
  using (true); -- No specific conditions, all rows are readable

-- RLS Policy: Allow users to update only their own profile
create policy "Allow users to update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id); -- User ID from auth session must match the profile ID

-- RLS Policy: Allow users to insert their own profile upon registration
-- Note: Uses WITH CHECK for INSERT policies to validate the new row before insertion.
create policy "Allow users to insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id); -- User ID from auth session must match the profile ID of the new row

-- 3. Create the Shows Table
-- This table stores information about card shows, including location, dates, and features.
create table public.shows (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  location text not null, -- e.g., "Boston Convention Center"
  address text not null,  -- e.g., "415 Summer St, Boston, MA 02210"
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  entry_fee numeric(10,2),
  description text,
  image_url text,
  rating numeric(2,1), -- Average rating from 1-5
  coordinates geography(point), -- Stores geographic coordinates for spatial queries (PostGIS)
  status text default 'ACTIVE', -- e.g., 'ACTIVE', 'UPCOMING', 'COMPLETED', 'CANCELLED'
  organizer_id uuid references auth.users(id), -- Link to the organizer's user ID
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  features jsonb default '{}', -- Stores features as a JSON object (e.g., {"On-site Grading": true})
  categories text[] default '{}'::text[] -- Stores categories as an array of text (e.g., {"Sports Cards", "Pokemon"})
);

-- Add a spatial index for location queries (improves performance for ST_DWithin and other PostGIS functions)
create index show_coordinates_idx on public.shows using gist (coordinates);

-- Enable Row Level Security (RLS) on the shows table
alter table public.shows enable row level security;

-- RLS Policy: Allow anyone to read shows
create policy "Allow anyone to read shows"
  on public.shows for select
  to authenticated, anon
  using (true);

-- RLS Policy: Allow authenticated users to create shows
-- Note: Uses WITH CHECK for INSERT policies.
create policy "Allow authenticated users to create shows"
  on public.shows for insert
  to authenticated
  with check (true); -- For now, any authenticated user can create a show. Can be tightened later.

-- RLS Policy: Allow organizers to update their own shows
create policy "Allow organizers to update their own shows"
  on public.shows for update
  to authenticated
  using (organizer_id = auth.uid());

-- RLS Policy: Allow organizers to delete their own shows
create policy "Allow organizers to delete their own shows"
  on public.shows for delete
  to authenticated
  using (organizer_id = auth.uid());

-- 4. Create a ZIP Codes Table for Location Caching
-- This table stores ZIP code data to avoid repeated geocoding API calls.
create table public.zip_codes (
  zip_code text primary key,
  city text not null,
  state text not null,
  latitude numeric not null,
  longitude numeric not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS for the zip_codes table
alter table public.zip_codes enable row level security;

-- RLS Policy: Allow anyone to read zip codes (publicly accessible for location lookups)
create policy "Allow anyone to read zip codes"
  on public.zip_codes for select
  to authenticated, anon
  using (true);

-- RLS Policy: Allow authenticated users to insert new zip codes (when geocoded)
create policy "Allow authenticated users to insert zip codes"
  on public.zip_codes for insert
  to authenticated
  with check (true); -- Any authenticated user can insert new zip codes (e.g., from location service)

-- 5. Create a Function for Finding Nearby ZIP Codes
-- This function uses PostGIS to find ZIP codes within a specified radius from a center point.
create or replace function public.nearby_zip_codes(
  center_lat numeric,
  center_lng numeric,
  radius_miles numeric
)
returns table (zip_code text, distance_miles numeric)
language sql
as $$
  select
    zip_code,
    ST_Distance(
      ST_Point(longitude, latitude)::geography,
      ST_Point(center_lng, center_lat)::geography
    ) / 1609.34 as distance_miles -- Convert meters to miles
  from
    public.zip_codes
  where
    ST_DWithin(
      ST_Point(longitude, latitude)::geography,
      ST_Point(center_lng, center_lat)::geography,
      radius_miles * 1609.34 -- Convert miles to meters for ST_DWithin
    )
  order by
    distance_miles asc;
$$;

-- 6. Set Up Database Triggers
-- Function to automatically create a user profile in the 'profiles' table
-- when a new user signs up via Supabase Auth. This ensures every auth.users entry
-- has a corresponding public.profiles entry for additional data.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    -- Extract first_name and last_name from user metadata if provided during sign-up
    coalesce(new.raw_user_meta_data->>'firstName', ''),
    coalesce(new.raw_user_meta_data->>'lastName', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to fire the 'handle_new_user' function after a new user is created in auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Add Sample Show Data (Optional, for testing purposes)
-- These sample shows will populate your app's home screen for initial testing.
insert into public.shows (
  title,
  location,
  address,
  start_date,
  end_date,
  entry_fee,
  description,
  status,
  coordinates,
  features,
  categories
) values 
(
  'East Coast Card Show',
  'Boston Convention Center',
  '415 Summer St, Boston, MA 02210',
  '2025-07-15 10:00:00+00',
  '2025-07-15 18:00:00+00',
  5.00,
  'The largest card show in New England featuring over 200 vendors. Door prizes and autograph guests.',
  'ACTIVE',
  ST_Point(-71.0466, 42.3453)::geography,
  '{"On-site Grading": true, "Autograph Guests": true, "Food Vendors": true}',
  '{"Sports Cards", "Trading Cards", "Memorabilia"}'
),
(
  'Midwest Collectors Convention',
  'Chicago Exhibition Hall',
  '2301 S Lake Shore Dr, Chicago, IL 60616',
  '2025-08-10 09:00:00+00',
  '2025-08-11 17:00:00+00',
  10.00,
  'Two-day event with special guests and the largest selection of vintage sports cards in the Midwest.',
  'ACTIVE',
  ST_Point(-87.6167, 41.8518)::geography,
  '{"On-site Grading": true, "Autograph Guests": true, "Food Vendors": true}',
  '{"Sports Cards", "Vintage", "Memorabilia"}'
),
(
  'West Coast Card Expo',
  'LA Convention Center',
  '1201 S Figueroa St, Los Angeles, CA 90015',
  '2025-09-05 10:00:00+00',
  '2025-09-07 19:00:00+00',
  15.00,
  'The premier West Coast trading card event featuring exclusive releases and athlete appearances.',
  'ACTIVE',
  ST_Point(-118.2673, 34.0403)::geography,
  '{"On-site Grading": true, "Autograph Guests": true, "Card Breaks": true}',
  '{"Sports Cards", "Trading Cards", "Collectibles"}'
);
