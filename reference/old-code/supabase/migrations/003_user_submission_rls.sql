-- Sprint 2.2 — allow authenticated users to submit events for review

do $$ begin
  create policy "Users submit events for review"
    on public.events for insert to authenticated
    with check (
      created_by = auth.uid()
      and lifecycle_status = 'pending_review'
      and source_type = 'user_submission'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users read own submitted events"
    on public.events for select to authenticated
    using (
      created_by = auth.uid()
      and source_type = 'user_submission'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users update own pending submissions"
    on public.events for update to authenticated
    using (
      created_by = auth.uid()
      and source_type = 'user_submission'
      and lifecycle_status = 'pending_review'
    )
    with check (
      created_by = auth.uid()
      and source_type = 'user_submission'
      and lifecycle_status = 'pending_review'
    );
exception when duplicate_object then null; end $$;
