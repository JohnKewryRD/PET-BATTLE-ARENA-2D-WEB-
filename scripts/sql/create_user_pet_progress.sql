create table if not exists public.user_pet_progress (
  room_id text not null,
  username text not null,
  level integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint user_pet_progress_level_check check (level >= 1),
  constraint user_pet_progress_pkey primary key (room_id, username)
);

create index if not exists idx_user_pet_progress_room_updated
  on public.user_pet_progress (room_id, updated_at desc);

alter table public.user_pet_progress enable row level security;

-- Service role bypasses RLS, but keep explicit policies for flexibility.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_pet_progress'
      and policyname = 'Allow service_role all on user_pet_progress'
  ) then
    create policy "Allow service_role all on user_pet_progress"
      on public.user_pet_progress
      as permissive
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;
