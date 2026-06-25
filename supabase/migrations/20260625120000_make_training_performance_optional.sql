-- Allow users to omit personal performance when it was not relevant to a session.
ALTER TABLE public.training_logs
  ALTER COLUMN performance DROP NOT NULL;
