-- Create a public view that excludes sensitive fingerprinting data
CREATE VIEW public.test_records_public AS
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

-- Drop the public SELECT policy on test_records
DROP POLICY IF EXISTS "Anyone can view test records" ON public.test_records;

-- Add explicit deny policies for UPDATE and DELETE
CREATE POLICY "Prevent updates" ON public.test_records 
FOR UPDATE USING (false);

CREATE POLICY "Prevent deletes" ON public.test_records 
FOR DELETE USING (false);