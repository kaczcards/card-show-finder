CREATE TABLE public.raw_ai_responses (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  source_url TEXT,
  ai_response_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);