-- Eternal Rave — Sprint 26: Source platform consolidation (title transforms for Bootshaus)
-- Moves site-specific title cleanup from framework code into source_config.

update public.sources
set source_config = jsonb_set(
  coalesce(source_config, '{}'::jsonb),
  '{website,transforms}',
  '[
    {"type":"regex_replace","value":"\\\\s*\\\\|\\\\s*Bootshaus Club\\\\s*$","replacement":""},
    {"type":"trim"}
  ]'::jsonb,
  true
),
updated_at = now()
where id = 'source-bootshaus-koeln';
