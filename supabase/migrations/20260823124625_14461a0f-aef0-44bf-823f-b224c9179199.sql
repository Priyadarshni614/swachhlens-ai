ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS reporter_name text,
  ADD COLUMN IF NOT EXISTS feedback jsonb;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_visibility_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_visibility_check
  CHECK (visibility IN ('public','anonymous','private'));

DROP POLICY IF EXISTS "Signed-in users can view all reports" ON public.reports;
CREATE POLICY "Signed-in users can view shared reports"
  ON public.reports FOR SELECT TO authenticated
  USING (visibility <> 'private' OR user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text NOT NULL DEFAULT '',
  actor_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.report_events TO authenticated;
GRANT ALL ON public.report_events TO service_role;
ALTER TABLE public.report_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view events of visible reports"
  ON public.report_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_events.report_id
      AND (r.visibility <> 'private' OR r.user_id = auth.uid())
  ));

CREATE POLICY "Signed-in users can add events to visible reports"
  ON public.report_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_events.report_id
        AND (r.visibility <> 'private' OR r.user_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS report_events_report_id_idx ON public.report_events (report_id, created_at);