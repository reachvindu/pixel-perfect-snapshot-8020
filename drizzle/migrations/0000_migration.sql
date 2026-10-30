create type public.app_role as enum ('admin', 'editor', 'viewer');
create type public.member_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  status public.member_status not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_approved(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and status = 'approved')
$$;

create or replace function public.can_edit(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved(_user_id)
    and (public.has_role(_user_id, 'admin') or public.has_role(_user_id, 'editor'))
$$;

create policy "Read own profile or admin reads all" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.is_approved(auth.uid()));
-- profile updates go through security definer functions only
create policy "No direct profile updates" on public.profiles for update to authenticated using (false);

create policy "Read own role or admin reads all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Signup: first user becomes approved admin, everyone else pending viewer
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, full_name, status)
  values (new.id, coalesce(new.email, ''),
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          case when first_user then 'approved'::public.member_status else 'pending'::public.member_status end);
  insert into public.user_roles (user_id, role)
  values (new.id, case when first_user then 'admin'::public.app_role else 'viewer'::public.app_role end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin actions
create or replace function public.admin_set_role(_user_id uuid, _role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin') and public.is_approved(auth.uid())) then
    raise exception 'Only admins can change roles';
  end if;
  if public.has_role(_user_id, 'admin') and _role <> 'admin'
     and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'There must be at least one admin';
  end if;
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end $$;

create or replace function public.admin_set_status(_user_id uuid, _status public.member_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin') and public.is_approved(auth.uid())) then
    raise exception 'Only admins can approve members';
  end if;
  if _user_id = auth.uid() and _status <> 'approved' then
    raise exception 'You cannot remove your own access';
  end if;
  update public.profiles set status = _status where id = _user_id;
end $$;

create or replace function public.update_my_name(_name text)
returns void language sql security definer set search_path = public as $$
  update public.profiles set full_name = left(trim(_name), 100) where id = auth.uid();
$$;

revoke execute on function public.admin_set_role(uuid, public.app_role) from anon, public;
revoke execute on function public.admin_set_status(uuid, public.member_status) from anon, public;
revoke execute on function public.update_my_name(text) from anon, public;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_set_status(uuid, public.member_status) to authenticated;
grant execute on function public.update_my_name(text) to authenticated;

-- App data (shared across the whole team)
create type public.meeting_platform as enum ('zoom', 'google_meet', 'teams');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done');
create type public.proposal_decision as enum ('pending', 'approved', 'rejected');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  link text not null,
  platform public.meeting_platform not null,
  transcript text not null default '',
  is_sample boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.board_lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.board_lists(id) on delete cascade,
  title text not null,
  owner text not null default '',
  deadline date,
  status public.task_status not null default 'todo',
  position int not null default 0,
  source_meeting_id uuid references public.meetings(id) on delete set null,
  last_mentioned_meeting_id uuid references public.meetings(id) on delete set null,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  current_status public.task_status not null,
  proposed_status public.task_status not null,
  evidence text not null,
  confidence real not null default 0.5,
  decision public.proposal_decision not null default 'pending',
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['meetings','boards','board_lists','tasks','ai_proposals'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Approved members read" on public.%I for select to authenticated using (public.is_approved(auth.uid()))', t);
    execute format('create policy "Editors insert" on public.%I for insert to authenticated with check (public.can_edit(auth.uid()))', t);
    execute format('create policy "Editors update" on public.%I for update to authenticated using (public.can_edit(auth.uid())) with check (public.can_edit(auth.uid()))', t);
    execute format('create policy "Editors delete" on public.%I for delete to authenticated using (public.can_edit(auth.uid()))', t);
  end loop;
end $$;

-- SAMPLE DATA
insert into public.meetings (id, title, date, link, platform, transcript, is_sample) values
('11111111-0000-0000-0000-000000000001','Weekly Product Sync','2026-10-05','https://meet.google.com/abc-defg-hij','google_meet',E'Priya: I''ll finish the onboarding redesign mockups by Friday.\nMarcus: I''ll draft the Q4 pricing proposal.\nLena: I''ll set up the analytics dashboard for activation metrics.',true),
('11111111-0000-0000-0000-000000000002','Engineering Standup','2026-10-12','https://zoom.us/j/1234567890','zoom',E'Daniel: The billing migration is blocked on the Stripe webhook review.\nPriya: Onboarding mockups are in progress, about 70% done.\nDaniel: I''ll write the API rate-limit docs this week.',true),
('11111111-0000-0000-0000-000000000003','Weekly Product Sync','2026-10-19','https://meet.google.com/abc-defg-hij','google_meet',E'Priya: Onboarding mockups are done and shared in Figma.\nLena: Activation dashboard is live, still adding the funnel view.\nSam: I''ll prepare the customer interview summary for next week.',true),
('11111111-0000-0000-0000-000000000004','Customer Success Review','2026-10-26','https://teams.microsoft.com/l/meetup-join/sample','teams',E'Sam: Interview summary is half written, I''m working on it now.\nDaniel: Webhook review got approved, billing migration is unblocked and moving again.',true);

insert into public.boards (id, name, is_sample) values ('22222222-0000-0000-0000-000000000001','Product Team',true);
insert into public.board_lists (id, board_id, name, position) values
('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','To Do',0),
('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','In Progress',1),
('33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','Blocked',2),
('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','Done',3);

insert into public.tasks (id, list_id, title, owner, deadline, status, position, source_meeting_id, last_mentioned_meeting_id, is_sample) values
('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000002','Finish onboarding redesign mockups','Priya Shah','2026-10-16','in_progress',0,'11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003',true),
('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','Draft Q4 pricing proposal','Marcus Lee','2026-10-20','todo',0,'11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001',true),
('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000002','Set up activation analytics dashboard','Lena Fischer','2026-10-18','in_progress',1,'11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003',true),
('44444444-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000003','Complete billing migration','Daniel Okafor','2026-11-02','blocked',0,'11111111-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000004',true),
('44444444-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000001','Write API rate-limit documentation','Daniel Okafor','2026-10-23','todo',1,'11111111-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002',true),
('44444444-0000-0000-0000-000000000006','33333333-0000-0000-0000-000000000001','Prepare customer interview summary','Sam Rivera','2026-10-30','todo',2,'11111111-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004',true),
('44444444-0000-0000-0000-000000000007','33333333-0000-0000-0000-000000000004','Publish release notes for v2.4','Lena Fischer','2026-10-10','done',0,'11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002',true);

insert into public.ai_proposals (task_id, meeting_id, current_status, proposed_status, evidence, confidence, is_sample) values
('44444444-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003','in_progress','done','Priya: Onboarding mockups are done and shared in Figma.',0.94,true),
('44444444-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004','blocked','in_progress','Daniel: Webhook review got approved, billing migration is unblocked and moving again.',0.88,true),
('44444444-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000004','todo','in_progress','Sam: Interview summary is half written, I''m working on it now.',0.81,true);