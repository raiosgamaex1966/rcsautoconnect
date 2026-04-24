
-- Votes table for roadmap items
CREATE TABLE public.roadmap_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_item_id uuid NOT NULL REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roadmap_item_id, user_id)
);

ALTER TABLE public.roadmap_votes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all votes
CREATE POLICY "Anyone can view votes"
ON public.roadmap_votes
FOR SELECT
USING (true);

-- Authenticated users can insert their own vote
CREATE POLICY "Users can insert own vote"
ON public.roadmap_votes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own vote (unvote)
CREATE POLICY "Users can delete own vote"
ON public.roadmap_votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
