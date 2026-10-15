-- Wellness and pain accept 0 (none); effort and performance remain 1–10.
BEGIN;

ALTER TABLE public.wellness_logs
  DROP CONSTRAINT IF EXISTS wellness_logs_sleep_quality_check,
  DROP CONSTRAINT IF EXISTS wellness_logs_energy_check,
  DROP CONSTRAINT IF EXISTS wellness_logs_fatigue_check,
  DROP CONSTRAINT IF EXISTS wellness_logs_stress_check,
  DROP CONSTRAINT IF EXISTS wellness_logs_pain_level_check;

ALTER TABLE public.wellness_logs
  ADD CONSTRAINT wellness_logs_sleep_quality_check CHECK (sleep_quality BETWEEN 0 AND 10),
  ADD CONSTRAINT wellness_logs_energy_check CHECK (energy BETWEEN 0 AND 10),
  ADD CONSTRAINT wellness_logs_fatigue_check CHECK (fatigue BETWEEN 0 AND 10),
  ADD CONSTRAINT wellness_logs_stress_check CHECK (stress BETWEEN 0 AND 10),
  ADD CONSTRAINT wellness_logs_pain_level_check CHECK (pain_level BETWEEN 0 AND 10);

ALTER TABLE public.training_logs DROP CONSTRAINT IF EXISTS training_logs_pain_level_check;
ALTER TABLE public.training_logs ADD CONSTRAINT training_logs_pain_level_check CHECK (pain_level BETWEEN 0 AND 10);

COMMIT;
