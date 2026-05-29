-- Remove sensitive fingerprinting columns from test_records table
ALTER TABLE public.test_records DROP COLUMN IF EXISTS browser_info;
ALTER TABLE public.test_records DROP COLUMN IF EXISTS user_agent;

-- Drop and recreate the public view without these columns (they're already excluded but table changed)
DROP VIEW IF EXISTS public.test_records_public;

CREATE VIEW public.test_records_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  controller_name,
  controller_type,
  overall_score,
  button_count,
  axes_count,
  buttons_tested,
  buttons_passed,
  joystick_drift_left,
  joystick_drift_right,
  vibration_supported,
  vibration_tested,
  latency_avg_ms,
  latency_max_ms,
  deadzone_left,
  deadzone_right,
  tested_at,
  created_at
FROM public.test_records;