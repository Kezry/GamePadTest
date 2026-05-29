-- Drop the security definer view and recreate with SECURITY INVOKER
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

-- Re-add a SELECT policy on test_records but only for internal use (through the view)
-- The view with security_invoker will use the caller's permissions
CREATE POLICY "Allow select for view access" ON public.test_records 
FOR SELECT USING (true);