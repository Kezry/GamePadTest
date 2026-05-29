-- Create table for controller test records
CREATE TABLE public.test_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  controller_name TEXT NOT NULL,
  controller_type TEXT NOT NULL,
  controller_id TEXT NOT NULL,
  
  -- Test metrics
  button_count INTEGER DEFAULT 0,
  axes_count INTEGER DEFAULT 0,
  buttons_tested INTEGER DEFAULT 0,
  buttons_passed INTEGER DEFAULT 0,
  joystick_drift_left DECIMAL(10,6) DEFAULT 0,
  joystick_drift_right DECIMAL(10,6) DEFAULT 0,
  vibration_supported BOOLEAN DEFAULT false,
  vibration_tested BOOLEAN DEFAULT false,
  
  -- Performance metrics (for future industrial testing)
  latency_avg_ms DECIMAL(10,2),
  latency_max_ms DECIMAL(10,2),
  deadzone_left DECIMAL(10,4),
  deadzone_right DECIMAL(10,4),
  
  -- Overall score (0-100)
  overall_score INTEGER DEFAULT 0,
  
  -- Browser and system info
  browser_info TEXT,
  user_agent TEXT,
  
  -- Timestamps
  tested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public read for rankings, anyone can insert)
ALTER TABLE public.test_records ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view test records (for tier rankings)
CREATE POLICY "Anyone can view test records" 
ON public.test_records 
FOR SELECT 
USING (true);

-- Allow anyone to insert test records (no auth required for testing)
CREATE POLICY "Anyone can insert test records" 
ON public.test_records 
FOR INSERT 
WITH CHECK (true);

-- Create index for controller type queries (for tier rankings)
CREATE INDEX idx_test_records_controller_type ON public.test_records(controller_type);
CREATE INDEX idx_test_records_controller_name ON public.test_records(controller_name);
CREATE INDEX idx_test_records_overall_score ON public.test_records(overall_score DESC);
CREATE INDEX idx_test_records_tested_at ON public.test_records(tested_at DESC);