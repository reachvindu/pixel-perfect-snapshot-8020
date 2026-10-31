alter table public.meetings add column if not exists series_name text not null default '';
alter table public.meetings add column if not exists processed_at timestamptz;
alter table public.boards add column if not exists series_name text not null default '';
alter table public.tasks add column if not exists description text not null default '';
alter table public.tasks add column if not exists ai_added boolean not null default false;

update public.meetings set series_name = title where series_name = '';
update public.boards set series_name = 'Weekly Product Sync' where id = '22222222-0000-0000-0000-000000000001';
update public.board_lists set name = 'Hold' where id = '33333333-0000-0000-0000-000000000003' and name = 'Blocked';
update public.board_lists set name = 'Completed' where id = '33333333-0000-0000-0000-000000000004' and name = 'Done';

create or replace function public.update_task_description(_task_id uuid, _description text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_approved(auth.uid()) then raise exception 'Not allowed'; end if;
  update public.tasks set description = left(trim(coalesce(_description, '')), 2000) where id = _task_id;
end $$;
revoke execute on function public.update_task_description(uuid, text) from anon, public;
grant execute on function public.update_task_description(uuid, text) to authenticated;