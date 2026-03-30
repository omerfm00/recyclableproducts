CREATE TABLE public.detection_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  product_name text NOT NULL,
  brand text,
  category text,
  confidence numeric NOT NULL,
  position jsonb
);

ALTER TABLE public.detection_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert detections"
ON public.detection_history
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anyone can read detections"
ON public.detection_history
FOR SELECT
TO anon
USING (true);