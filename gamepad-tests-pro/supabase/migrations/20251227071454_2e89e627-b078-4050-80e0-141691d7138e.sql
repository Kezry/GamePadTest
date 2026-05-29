-- Enable RLS on the view by recreating it as a security definer view
-- Since views inherit RLS from base tables, we need to ensure proper access

-- First, let's enable RLS on the base table if not already enabled
ALTER TABLE public.test_records ENABLE ROW LEVEL SECURITY;

-- Create a policy for public read access on test_records (the view selects from this)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'test_records' 
    AND policyname = 'Allow public read access to test records'
  ) THEN
    CREATE POLICY "Allow public read access to test records"
    ON public.test_records
    FOR SELECT
    USING (true);
  END IF;
END $$;