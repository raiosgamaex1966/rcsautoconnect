CREATE POLICY "Members can delete messages"
ON public.messages
FOR DELETE
USING (is_tenant_member(auth.uid(), tenant_id));