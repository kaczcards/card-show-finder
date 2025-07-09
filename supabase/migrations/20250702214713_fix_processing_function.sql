-- Recreate the function with much more robust error handling and parsing
CREATE OR REPLACE FUNCTION public.process_and_load_shows()
RETURNS TABLE(processed_count INT, error_count INT) AS $$
DECLARE
    raw_record RECORD;
    json_text TEXT;
    shows_array jsonb;
    show_item jsonb;
    p_processed_count INT := 0;
    p_error_count INT := 0;
BEGIN
    FOR raw_record IN SELECT * FROM public.raw_ai_responses LOOP
        BEGIN
            -- Find the start and end of the JSON array '[...]'
            json_text := substring(raw_record.ai_response_text from '\[.*\]');

            -- If a JSON array is found, process it
            IF json_text IS NOT NULL THEN
                shows_array := json_text::jsonb;

                FOR show_item IN SELECT * FROM jsonb_array_elements(shows_array) LOOP
                    BEGIN
                        -- Insert into the shows table, handling potential nulls
                        -- The COALESCE function provides a default value if a field is null
                        -- The NULLIF function converts empty strings '' to NULL
                        INSERT INTO public.shows (name, start_date, end_date, venue_name, city, state, url)
                        SELECT
                            NULLIF(trim(show_item->>'name'), ''),
                            (show_item->>'startDate')::DATE,
                            (show_item->>'endDate')::DATE,
                            NULLIF(trim(show_item->>'venueName'), ''),
                            NULLIF(trim(show_item->>'city'), ''),
                            NULLIF(upper(trim(show_item->>'state')), ''),
                            NULLIF(trim(show_item->>'url'), '')
                        -- This is the key: only process if the row has a name and a valid start date
                        WHERE NULLIF(trim(show_item->>'name'), '') IS NOT NULL
                          AND (show_item->>'startDate') IS NOT NULL
                          AND (show_item->>'startDate')::text ~ '^\d{4}-\d{2}-\d{2}$'
                        ON CONFLICT (name, start_date, city)
                        DO UPDATE SET
                          end_date = EXCLUDED.end_date,
                          venue_name = EXCLUDED.venue_name,
                          state = EXCLUDED.state,
                          url = EXCLUDED.url;

                        -- If the insert was successful, increment the counter
                        IF FOUND THEN
                            p_processed_count := p_processed_count + 1;
                        ELSE
                            p_error_count := p_error_count + 1;
                        END IF;
                    EXCEPTION
                        -- Catch errors for individual show items (e.g., bad date format)
                        WHEN others THEN
                            p_error_count := p_error_count + 1;
                    END;
                END LOOP;
            ELSE
                -- Could not find a JSON array in the text
                p_error_count := p_error_count + 1;
            END IF;
        EXCEPTION
            -- Catch errors for the entire raw record (e.g., malformed JSON)
            WHEN others THEN
                p_error_count := p_error_count + 1;
        END;
    END LOOP;

    -- Now, we can safely delete the processed records from the holding table
    DELETE FROM public.raw_ai_responses;

    RETURN QUERY SELECT p_processed_count, p_error_count;
END;
$$ LANGUAGE plpgsql;