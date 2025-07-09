-- Create a type that matches the JSON structure from our AI
CREATE TYPE public.show_details AS (
  name TEXT,
  start_date DATE,
  end_date DATE,
  venue_name TEXT,
  city TEXT,
  state VARCHAR(2),
  url TEXT
);

-- Create the function to upsert a batch of shows
CREATE OR REPLACE FUNCTION public.upsert_shows(
  shows_data public.show_details[]
)
RETURNS void AS $$
DECLARE
  show public.show_details; -- This is the line we added
BEGIN
  FOREACH show IN ARRAY shows_data
  LOOP
    INSERT INTO public.shows (name, start_date, end_date, venue_name, city, state, url)
    VALUES (
      show.name,
      show.start_date,
      show.end_date,
      show.venue_name,
      show.city,
      show.state,
      show.url
    )
    ON CONFLICT (name, start_date, city) -- Make sure this matches your unique constraint
    DO UPDATE SET
      end_date = EXCLUDED.end_date,
      venue_name = EXCLUDED.venue_name,
      state = EXCLUDED.state,
      url = EXCLUDED.url;
  END LOOP;
END;
$$ LANGUAGE plpgsql;