CREATE OR REPLACE FUNCTION public.process_and_load_shows()
RETURNS TABLE(processed_count INT, error_count INT) AS $$
DECLARE
    raw_record RECORD;
    json_text TEXT;
    show_data jsonb;
    shows_array jsonb;
    show_item jsonb;
    clean_name TEXT;
    clean_start_date DATE;
    clean_end_date DATE;
    clean_venue TEXT;
    clean_city TEXT;
    clean_state VARCHAR(2);
    clean_url TEXT;
    p_processed_count INT := 0;
    p_error_count INT := 0;
BEGIN
    FOR raw_record IN SELECT * FROM public.raw_ai_responses LOOP
        BEGIN
            -- Extract the JSON array from the raw text
            json_text := regexp_replace(raw_record.ai_response_text, E'\\s*`{3}json\\s*|\\s*`{3}\\s*', '', 'g');

            -- Check if the extracted text is a valid JSON array
            IF json_text ~ '^\s*\[.*\]\s*$' THEN
                shows_array := json_text::jsonb;

                -- Loop through each show object in the JSON array
                FOR show_item IN SELECT * FROM jsonb_array_elements(shows_array) LOOP
                    BEGIN
                        -- Safely extract and clean each field
                        clean_name := trim(show_item->>'name');
                        clean_venue := trim(show_item->>'venueName');
                        clean_city := trim(show_item->>'city');
                        clean_state := upper(trim(substring(show_item->>'state' for 2)));
                        clean_url := trim(show_item->>'url');

                        -- Attempt to cast dates, handling various formats gracefully
                        BEGIN
                            clean_start_date := (show_item->>'startDate')::DATE;
                        EXCEPTION WHEN others THEN
                            clean_start_date := NULL;
                        END;

                        BEGIN
                            clean_end_date := (show_item->>'endDate')::DATE;
                        EXCEPTION WHEN others THEN
                            clean_end_date := NULL;
                        END;

                        -- Only insert if we have a name and a valid start date
                        IF clean_name IS NOT NULL AND clean_start_date IS NOT NULL THEN
                            INSERT INTO public.shows (name, start_date, end_date, venue_name, city, state, url)
                            VALUES (
                              clean_name,
                              clean_start_date,
                              clean_end_date,
                              clean_venue,
                              clean_city,
                              clean_state,
                              clean_url
                            )
                            ON CONFLICT (name, start_date, city) -- Your unique constraint
                            DO UPDATE SET
                              end_date = EXCLUDED.end_date,
                              venue_name = EXCLUDED.venue_name,
                              state = EXCLUDED.state,
                              url = EXCLUDED.url;

                            p_processed_count := p_processed_count + 1;
                        ELSE
                            p_error_count := p_error_count + 1;
                        END IF;
                    EXCEPTION WHEN others THEN
                        p_error_count := p_error_count + 1;
                    END;
                END LOOP;
            ELSE
                p_error_count := p_error_count + 1;
            END IF;
        EXCEPTION WHEN others THEN
            p_error_count := p_error_count + 1;
        END;
    END LOOP;

    -- Return the summary
    RETURN QUERY SELECT p_processed_count, p_error_count;
END;
$$ LANGUAGE plpgsql;