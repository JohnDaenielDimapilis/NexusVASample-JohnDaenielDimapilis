-- Additive privacy controls for the existing workspace. Apply after 202611050001.
-- The service_role is used only by the attachment-signing Edge Function.

create table public.privacy_permissions (
  user_id uuid not null references public.profiles(id),
  permission text not null check (permission in ('case_read','case_approve','case_metadata','audit_read','emergency_access')),
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default clock_timestamp(),
  primary key (user_id, permission)
);
alter table public.privacy_permissions enable row level security;
revoke all on public.privacy_permissions from anon, authenticated;

create function public.has_permission_for(subject_id uuid, needed text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.privacy_permissions pp
    join public.profiles p on p.id = pp.user_id
    where pp.user_id = subject_id and pp.permission = needed and p.status = 'Active'
  );
$$;
create function public.has_privacy_permission(needed text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission_for((select auth.uid()), needed);
$$;
revoke execute on function public.has_permission_for(uuid,text), public.has_privacy_permission(text) from public, anon;
grant execute on function public.has_privacy_permission(text) to authenticated;
create function public.visible_case_reviewers()
returns table(id uuid,name text,role public.account_role,can_read boolean,can_approve boolean)
language sql stable security definer set search_path = '' as $$
  select p.id,p.name,p.role,
    public.has_permission_for(p.id,'case_read'),
    public.has_permission_for(p.id,'case_approve')
  from public.profiles p
  where public.current_role() in ('admin','privacy_officer')
    and p.status='Active' and p.role in ('support_reviewer','privacy_officer')
    and (public.has_permission_for(p.id,'case_read')
      or public.has_permission_for(p.id,'case_approve'));
$$;
revoke execute on function public.visible_case_reviewers() from public, anon;
grant execute on function public.visible_case_reviewers() to authenticated;

-- Operational ticket access does not imply access to conversation contents.
create function public.is_conversation_participant(ticket_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tickets t
    where t.id = ticket_id and public.current_role() is not null
      and ((public.current_role() = 'client' and t."clientId" = (select auth.uid()))
        or (public.current_role() = 'staff' and t."assigneeId" = (select auth.uid())))
  );
$$;
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

create or replace function public.can_review_document(document_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    join public.tickets t on t.id = d."ticketId"
    where d.id = document_id and public.current_role() = 'staff'
      and t."assigneeId" = (select auth.uid())
  );
$$;

drop policy messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (public.is_conversation_participant("ticketId"));
drop policy appointments_read on public.appointments;
create policy appointments_read on public.appointments for select to authenticated
  using (public.current_role() in ('client','staff')
    and ("clientId" = (select auth.uid()) or "staffId" = (select auth.uid())));
drop policy documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using (public.current_role() is not null and
    (("ticketId" is null and "ownerId" = (select auth.uid()))
      or public.is_conversation_participant("ticketId")
      or public.can_review_document(id)));
drop policy document_storage_select on storage.objects;
create policy document_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.current_role() is not null and
    (((storage.foldername(name))[1] = (select auth.uid())::text and not exists (
      select 1 from public.documents existing where existing.path = name)) or exists (
      select 1 from public.documents d where d.path = name and
        ((d."ticketId" is null and d."ownerId" = (select auth.uid()))
          or public.is_conversation_participant(d."ticketId")
          or public.can_review_document(d.id))
    )));

-- Availability and automatic assignment are not readable through a direct
-- profiles SELECT. The function returns availability only where booking needs it.
revoke select on public.profiles from authenticated;
grant select (id,name,email,role,company,bio,status,"skillLevel",skills) on public.profiles to authenticated;
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (public.current_role() is not null and
    (id=(select auth.uid()) or (role='staff' and public.current_role()='client')
      or public.current_role() in ('admin','super_admin')
      or (public.current_role()='privacy_officer' and public.has_privacy_permission('case_metadata'))
      or (public.current_role()='staff' and exists (
        select 1 from public.tickets t where t."clientId"=profiles.id
          and t."assigneeId"=(select auth.uid())
      ))));
create function public.visible_staff_settings()
returns table (id uuid, available boolean, "autoAssign" boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.available,
    case when p.id = (select auth.uid()) then p."autoAssign" else false end
  from public.profiles p
  where p.role = 'staff' and p.status = 'Active' and
    ((public.current_role() = 'client') or
      (public.current_role() = 'staff' and p.id = (select auth.uid())));
$$;
revoke execute on function public.visible_staff_settings() from public, anon;
grant execute on function public.visible_staff_settings() to authenticated;

-- The old workspace audit is operational. Exclude entries that reveal private
-- schedule activity or attachment names from Admin's general activity view.
drop policy audit_read on public.audit;
create policy audit_read on public.audit for select to authenticated
  using (public.current_role() = 'admin' and
    text !~* '^(Scheduled an appointment|Cancelled an appointment|Rescheduled an appointment|Marked an appointment|Updated appointment details|Uploaded |Reviewed )');

create table public.review_cases (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('conversation','schedule')),
  purpose text not null check (length(trim(purpose)) between 8 and 200),
  reason text not null check (length(trim(reason)) between 15 and 2000),
  ticket_id uuid references public.tickets(id),
  subject_id uuid references public.profiles(id),
  requester_id uuid not null references public.profiles(id),
  reviewer_id uuid not null references public.profiles(id),
  approval_reviewer_id uuid references public.profiles(id),
  requested_start timestamptz not null,
  requested_end timestamptz not null,
  approved_start timestamptz,
  approved_end timestamptz,
  status text not null default 'requested' check (status in ('requested','approved','denied','emergency','closed')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  access_expires_at timestamptz,
  emergency_reviewed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  check (requested_end > requested_start),
  check ((kind = 'conversation' and ticket_id is not null and subject_id is null)
      or (kind = 'schedule' and subject_id is not null and ticket_id is null))
);
create index review_cases_reviewer_idx on public.review_cases (reviewer_id,status,access_expires_at);
alter table public.review_cases enable row level security;
create policy review_cases_metadata on public.review_cases for select to authenticated
  using (public.current_role() = 'admin' or requester_id = (select auth.uid())
    or reviewer_id = (select auth.uid()) or approval_reviewer_id = (select auth.uid())
    or approved_by = (select auth.uid())
    or public.has_privacy_permission('case_metadata'));
revoke all on public.review_cases from anon, authenticated;
grant select on public.review_cases to authenticated;

create table public.case_attachment_grants (
  case_id uuid not null references public.review_cases(id),
  document_id uuid not null references public.documents(id),
  justification text not null check (length(trim(justification)) between 15 and 1000),
  approved_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (case_id, document_id)
);
alter table public.case_attachment_grants enable row level security;
revoke all on public.case_attachment_grants from anon, authenticated;

-- Previous slots are isolated from the live calendar table. Direct reads are
-- denied; only the case-scoped, server-time-filtered function below can return them.
alter table public.appointments add column status text not null default 'Scheduled'
  check (status in ('Scheduled','No-show'));
create table public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null,
  client_id uuid not null references public.profiles(id),
  staff_id uuid not null references public.profiles(id),
  title text not null,
  original_start timestamptz not null,
  original_end timestamptz not null,
  outcome text not null check (outcome in ('Cancelled','Rescheduled')),
  changed_at timestamptz not null default clock_timestamp()
);
create index appointment_history_subject_idx on public.appointment_history (client_id,staff_id,original_end);
alter table public.appointment_history enable row level security;
revoke all on public.appointment_history from anon, authenticated;
create function public.archive_cancelled_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.appointment_history
    (appointment_id,client_id,staff_id,title,original_start,original_end,outcome)
  values (old.id,old."clientId",old."staffId",old.title,old.start,old."end",'Cancelled');
  return old;
end;
$$;
create trigger appointment_cancel_history before delete on public.appointments
  for each row execute function public.archive_cancelled_appointment();

-- No message content is ever written to this append-only audit table.
create table public.administrative_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid references public.profiles(id),
  action text not null,
  case_id uuid references public.review_cases(id),
  approval_id uuid references public.profiles(id),
  reason text not null default '',
  scope jsonb not null default '{}'::jsonb,
  outcome text not null check (outcome in ('granted','denied','recorded'))
);
alter table public.administrative_audit enable row level security;
create policy administrative_audit_read on public.administrative_audit for select to authenticated
  using (public.current_role() = 'admin' or public.has_privacy_permission('audit_read')
    or exists (select 1 from public.review_cases c where c.id = case_id
      and (c.reviewer_id = (select auth.uid())
        or c.approval_reviewer_id = (select auth.uid()))));
revoke all on public.administrative_audit from anon, authenticated;
grant select on public.administrative_audit to authenticated;
create function public.reject_administrative_audit_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Administrative audit records are append-only.';
end;
$$;
create trigger administrative_audit_immutable before update or delete on public.administrative_audit
  for each row execute function public.reject_administrative_audit_change();

-- Preserve the tested business command function behind a guarded entry point.
-- Direct execute permission on the legacy implementation is removed.
alter function public.workspace_command(jsonb) rename to workspace_command_legacy;
revoke execute on function public.workspace_command_legacy(jsonb) from public, anon, authenticated;
create function public.workspace_command(command jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  action text := command->>'type'; a public.appointments; t public.tickets;
  actor_role public.account_role := public.current_role();
  v_start timestamptz; v_end timestamptz;
begin
  if actor_role is null then raise exception 'An active account is required.'; end if;
  if action = 'sendMessage' then
    if not public.is_conversation_participant((command->>'ticketId')::uuid) then
      raise exception 'Messages require an assigned participant.';
    end if;
  elsif action = 'cancelAppointment' then
    select * into a from public.appointments where id = (command->>'appointmentId')::uuid;
    if a.id is null or not (actor_role in ('client','staff') and
      (a."clientId" = auth.uid() or a."staffId" = auth.uid())) then
      raise exception 'Appointment not found.';
    end if;
  elsif action = 'addDocument' and command->'document'->>'ticketId' is not null then
    if not public.is_conversation_participant((command->'document'->>'ticketId')::uuid) then
      raise exception 'You cannot upload to this request.';
    end if;
  elsif action = 'reviewDocument' then
    if not public.can_review_document((command->>'documentId')::uuid) then
      raise exception 'You cannot review this document.';
    end if;
  elsif action = 'rescheduleAppointment' then
    select * into a from public.appointments where id = (command->>'appointmentId')::uuid for update;
    if a.id is null or not (actor_role in ('client','staff') and
      (a."clientId" = auth.uid() or a."staffId" = auth.uid())) then
      raise exception 'Appointment not found.';
    end if;
    v_start := (command->>'start')::timestamptz;
    v_end := (command->>'end')::timestamptz;
    if a.start <= clock_timestamp() or v_start <= clock_timestamp() or v_end <= v_start
      or v_end - v_start > interval '4 hours' then
      raise exception 'Choose a future appointment lasting up to four hours.';
    end if;
    insert into public.appointment_history
      (appointment_id,client_id,staff_id,title,original_start,original_end,outcome)
    values (a.id,a."clientId",a."staffId",a.title,a.start,a."end",'Rescheduled');
    update public.appointments set start=v_start,"end"=v_end where id=a.id;
    insert into public.notifications("userId",text)
      values (case when auth.uid()=a."clientId" then a."staffId" else a."clientId" end,
        'An appointment was rescheduled.');
    insert into public.audit("actorId",text) values (auth.uid(),'Rescheduled an appointment');
    return;
  elsif action = 'editAppointment' then
    select * into a from public.appointments where id = (command->>'appointmentId')::uuid for update;
    if a.id is null or not (actor_role in ('client','staff') and
      (a."clientId" = auth.uid() or a."staffId" = auth.uid())) then
      raise exception 'Appointment not found.';
    end if;
    if a.start <= clock_timestamp() then raise exception 'Only future appointments can be edited.'; end if;
    if length(trim(command->>'title')) not between 1 and 150
      or length(coalesce(command->>'notes','')) > 2000 then
      raise exception 'Add a title up to 150 characters and notes up to 2000 characters.';
    end if;
    update public.appointments set title=trim(command->>'title'),
      notes=trim(coalesce(command->>'notes','')) where id=a.id;
    insert into public.notifications("userId",text)
      values (case when auth.uid()=a."clientId" then a."staffId" else a."clientId" end,
        'Appointment details were updated.');
    insert into public.audit("actorId",text) values (auth.uid(),'Updated appointment details');
    return;
  elsif action = 'markNoShow' then
    select * into a from public.appointments where id = (command->>'appointmentId')::uuid for update;
    if a.id is null or not (actor_role in ('client','staff') and
      (a."clientId" = auth.uid() or a."staffId" = auth.uid())) then
      raise exception 'Appointment not found.';
    end if;
    if a."end" > clock_timestamp() then raise exception 'Wait until the appointment has ended.'; end if;
    update public.appointments set status='No-show' where id=a.id;
    insert into public.audit("actorId",text) values (auth.uid(),'Marked an appointment no-show');
    return;
  end if;
  perform public.workspace_command_legacy(command);
end;
$$;
revoke execute on function public.workspace_command(jsonb) from public, anon;
grant execute on function public.workspace_command(jsonb) to authenticated;

create function public.request_review_case(
  case_kind text, case_purpose text, case_reason text, conversation_id uuid,
  schedule_subject uuid, assigned_reviewer uuid, range_start timestamptz, range_end timestamptz,
  second_reviewer uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; actor_role public.account_role := public.current_role(); allowed boolean;
  chosen_reviewer uuid := assigned_reviewer;
begin
  if chosen_reviewer is null then
    select pp.user_id into chosen_reviewer from public.privacy_permissions pp
    join public.profiles p on p.id=pp.user_id
    where pp.permission='case_read' and p.status='Active'
      and p.role in ('support_reviewer','privacy_officer') and p.id<>auth.uid()
    order by case when p.role='support_reviewer' then 0 else 1 end,pp.granted_at,p.id limit 1;
  end if;
  allowed := actor_role in ('client','staff','admin','privacy_officer')
    and public.has_permission_for(chosen_reviewer,'case_read')
    and exists (select 1 from public.profiles reviewer where reviewer.id=chosen_reviewer
      and reviewer.role in ('support_reviewer','privacy_officer'))
    and chosen_reviewer <> auth.uid()
    and (second_reviewer is null or (second_reviewer <> chosen_reviewer
      and second_reviewer <> auth.uid()
      and public.has_permission_for(second_reviewer,'case_approve')
      and exists (select 1 from public.profiles approver where approver.id=second_reviewer
        and approver.role='support_reviewer')))
    and range_start < range_end and range_end <= clock_timestamp()
    and length(trim(case_purpose)) between 8 and 200
    and length(trim(case_reason)) between 15 and 2000
    and ((case_kind='conversation' and conversation_id is not null and schedule_subject is null
      and (actor_role in ('admin','privacy_officer') or public.is_conversation_participant(conversation_id)))
      or (case_kind='schedule' and schedule_subject is not null and conversation_id is null
        and (actor_role in ('admin','privacy_officer') or schedule_subject=auth.uid())));
  if not coalesce(allowed,false) then
    insert into public.administrative_audit(actor_id,action,reason,outcome)
      values(auth.uid(),'request_review_case','Request denied','denied');
    return null;
  end if;
  insert into public.review_cases
    (kind,purpose,reason,ticket_id,subject_id,requester_id,reviewer_id,
      approval_reviewer_id,requested_start,requested_end)
  values(case_kind,trim(case_purpose),trim(case_reason),conversation_id,schedule_subject,
    auth.uid(),chosen_reviewer,second_reviewer,range_start,range_end) returning id into new_id;
  insert into public.administrative_audit(actor_id,action,case_id,reason,scope,outcome)
    values(auth.uid(),'request_review_case',new_id,'Documented case request',
      jsonb_build_object('kind',case_kind,'start',range_start,'end',range_end),'recorded');
  return new_id;
end;
$$;

create function public.approve_review_case(
  target_case uuid, range_start timestamptz, range_end timestamptz,
  expires_at timestamptz, approval_reason text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare c public.review_cases; allowed boolean;
begin
  select * into c from public.review_cases where id=target_case for update;
  allowed := c.id is not null and c.status='requested'
    and public.has_privacy_permission('case_approve')
    and (public.current_role()='privacy_officer' or
      (public.current_role()='support_reviewer' and c.approval_reviewer_id=auth.uid()))
    and auth.uid() <> c.reviewer_id and auth.uid() <> c.requester_id
    and range_start >= c.requested_start and range_end <= c.requested_end
    and range_end > range_start and range_end <= clock_timestamp()
    and expires_at > clock_timestamp() and expires_at <= clock_timestamp() + interval '24 hours'
    and length(trim(approval_reason)) >= 15;
  if not coalesce(allowed,false) then
    insert into public.administrative_audit(actor_id,action,case_id,reason,outcome)
      values(auth.uid(),'approve_review_case',c.id,'Approval denied','denied');
    return false;
  end if;
  update public.review_cases set status='approved',approved_start=range_start,
    approved_end=range_end,approved_by=auth.uid(),approved_at=clock_timestamp(),
    access_expires_at=expires_at where id=c.id;
  insert into public.administrative_audit(actor_id,action,case_id,approval_id,reason,scope,outcome)
    values(auth.uid(),'approve_review_case',c.id,auth.uid(),trim(approval_reason),
      jsonb_build_object('start',range_start,'end',range_end,'expires',expires_at),'granted');
  return true;
end;
$$;

create function public.deny_review_case(target_case uuid, denial_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c public.review_cases;
begin
  select * into c from public.review_cases where id=target_case for update;
  if c.id is null or c.status <> 'requested' or auth.uid()=c.requester_id
    or auth.uid()=c.reviewer_id or length(trim(denial_reason)) < 15
    or not public.has_privacy_permission('case_approve')
    or not (public.current_role()='privacy_officer' or
      (public.current_role()='support_reviewer' and c.approval_reviewer_id=auth.uid())) then
    insert into public.administrative_audit(actor_id,action,case_id,reason,outcome)
      values(auth.uid(),'deny_review_case',c.id,'Denial action not authorized','denied');
    return false;
  end if;
  update public.review_cases set status='denied',closed_at=clock_timestamp(),
    access_expires_at=clock_timestamp() where id=c.id;
  insert into public.administrative_audit(actor_id,action,case_id,approval_id,reason,outcome)
    values(auth.uid(),'deny_review_case',c.id,auth.uid(),trim(denial_reason),'recorded');
  return true;
end;
$$;

create function public.close_review_case(target_case uuid, close_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c public.review_cases;
begin
  select * into c from public.review_cases where id=target_case for update;
  if c.id is null or length(trim(close_reason)) < 8 or not
    (auth.uid()=c.requester_id or public.current_role()='admin'
      or (public.has_privacy_permission('case_approve') and
        (public.current_role()='privacy_officer' or
          (public.current_role()='support_reviewer' and c.approval_reviewer_id=auth.uid())))) then
    insert into public.administrative_audit(actor_id,action,case_id,reason,outcome)
      values(auth.uid(),'close_review_case',c.id,'Close denied','denied');
    return false;
  end if;
  update public.review_cases set status='closed',closed_at=clock_timestamp(),
    access_expires_at=clock_timestamp() where id=c.id;
  insert into public.administrative_audit(actor_id,action,case_id,reason,outcome)
    values(auth.uid(),'close_review_case',c.id,trim(close_reason),'recorded');
  return true;
end;
$$;

create function public.read_case_messages(target_case uuid)
returns table(id uuid,"ticketId" uuid,"senderId" uuid,text text,"createdAt" timestamptz,system boolean)
language plpgsql security definer set search_path = '' as $$
declare c public.review_cases; allowed boolean;
begin
  select * into c from public.review_cases where review_cases.id=target_case;
  allowed := c.id is not null and c.kind='conversation'
    and c.reviewer_id=auth.uid() and public.has_privacy_permission('case_read')
    and public.current_role() in ('support_reviewer','privacy_officer')
    and c.status in ('approved','emergency') and c.access_expires_at > clock_timestamp()
    and c.closed_at is null;
  insert into public.administrative_audit(actor_id,action,case_id,approval_id,reason,scope,outcome)
    values(auth.uid(),'read_case_messages',c.id,c.approved_by,
      case when allowed then 'Approved case scope' else 'Access denied or expired' end,
      case when allowed then jsonb_build_object('start',c.approved_start,'end',c.approved_end)
        else '{}'::jsonb end,
      case when allowed then 'granted' else 'denied' end);
  if not coalesce(allowed,false) then return; end if;
  return query select m.id,m."ticketId",m."senderId",m.text,m."createdAt",m.system
    from public.messages m where m."ticketId"=c.ticket_id
      and m."createdAt" >= c.approved_start and m."createdAt" < c.approved_end
    order by m."createdAt";
end;
$$;

create function public.read_schedule_history(target_case uuid)
returns table(id uuid,title text,start timestamptz,"end" timestamptz,outcome text,changed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare c public.review_cases; allowed boolean;
begin
  select * into c from public.review_cases where review_cases.id=target_case;
  allowed := c.id is not null and c.kind='schedule'
    and c.reviewer_id=auth.uid() and public.has_privacy_permission('case_read')
    and public.current_role() in ('support_reviewer','privacy_officer')
    and c.status in ('approved','emergency') and c.access_expires_at > clock_timestamp()
    and c.closed_at is null;
  insert into public.administrative_audit(actor_id,action,case_id,approval_id,reason,scope,outcome)
    values(auth.uid(),'read_schedule_history',c.id,c.approved_by,
      case when allowed then 'Approved historical scope' else 'Access denied or expired' end,
      case when allowed then jsonb_build_object('start',c.approved_start,'end',c.approved_end)
        else '{}'::jsonb end,
      case when allowed then 'granted' else 'denied' end);
  if not coalesce(allowed,false) then return; end if;
  return query
    select a.id,a.title,a.start,a."end",
      case when a.status='No-show' then 'No-show' else 'Completed' end,
      a."end"
    from public.appointments a
    where (a."clientId"=c.subject_id or a."staffId"=c.subject_id)
      and a."end" <= clock_timestamp() and a.start >= c.approved_start
      and a.start < c.approved_end
    union all
    select h.id,h.title,h.original_start,h.original_end,h.outcome,h.changed_at
    from public.appointment_history h
    where (h.client_id=c.subject_id or h.staff_id=c.subject_id)
      and h.original_end <= clock_timestamp() and h.original_start >= c.approved_start
      and h.original_start < c.approved_end
    order by start desc;
end;
$$;

create function public.approve_case_attachment(
  target_case uuid, target_document uuid, justification text, expires_at timestamptz
) returns boolean language plpgsql security definer set search_path = '' as $$
declare c public.review_cases; d public.documents; allowed boolean;
begin
  select * into c from public.review_cases where id=target_case for update;
  select * into d from public.documents where id=target_document;
  allowed := c.id is not null and c.kind='conversation' and d.id is not null
    and d."ticketId"=c.ticket_id and c.status in ('approved','emergency')
    and c.access_expires_at > clock_timestamp()
    and public.has_privacy_permission('case_approve')
    and (public.current_role()='privacy_officer' or
      (public.current_role()='support_reviewer' and c.approval_reviewer_id=auth.uid()))
    and auth.uid() <> c.reviewer_id
    and expires_at > clock_timestamp() and expires_at <= c.access_expires_at
    and length(trim(justification)) between 15 and 1000;
  if not coalesce(allowed,false) then
    insert into public.administrative_audit(actor_id,action,case_id,reason,outcome)
      values(auth.uid(),'approve_case_attachment',c.id,'Attachment approval denied','denied');
    return false;
  end if;
  insert into public.case_attachment_grants(case_id,document_id,justification,approved_by,expires_at)
    values(c.id,d.id,trim(justification),auth.uid(),expires_at)
    on conflict(case_id,document_id) do update set justification=excluded.justification,
      approved_by=excluded.approved_by,expires_at=excluded.expires_at;
  insert into public.administrative_audit(actor_id,action,case_id,approval_id,reason,scope,outcome)
    values(auth.uid(),'approve_case_attachment',c.id,auth.uid(),trim(justification),
      jsonb_build_object('document_id',d.id,'expires',expires_at),'granted');
  return true;
end;
$$;

-- Called only by the server-side Edge Function after verifying the caller JWT.
create function public.authorize_case_attachment(target_case uuid,target_document uuid,viewer_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare c public.review_cases; d public.documents; g public.case_attachment_grants; allowed boolean;
begin
  select * into c from public.review_cases where id=target_case;
  select * into d from public.documents where id=target_document;
  select * into g from public.case_attachment_grants where case_id=target_case and document_id=target_document;
  allowed := c.id is not null and d.id is not null and g.case_id is not null
    and c.kind='conversation' and d."ticketId"=c.ticket_id
    and c.reviewer_id=viewer_id and public.has_permission_for(viewer_id,'case_read')
    and exists (select 1 from public.profiles reviewer where reviewer.id=viewer_id
      and reviewer.role in ('support_reviewer','privacy_officer'))
    and c.status in ('approved','emergency') and c.closed_at is null
    and c.access_expires_at > clock_timestamp() and g.expires_at > clock_timestamp();
  insert into public.administrative_audit(actor_id,action,case_id,approval_id,reason,scope,outcome)
    values(viewer_id,'view_case_attachment',c.id,g.approved_by,
      case when allowed then g.justification else 'Access denied or expired' end,
      jsonb_build_object('document_id',target_document),
      case when allowed then 'granted' else 'denied' end);
  if not coalesce(allowed,false) then return null; end if;
  return d.path;
end;
$$;

create function public.request_emergency_access(target_case uuid, emergency_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c public.review_cases;
begin
  select * into c from public.review_cases where id=target_case for update;
  if c.id is null or c.status <> 'requested' or c.reviewer_id <> auth.uid()
    or not public.has_privacy_permission('case_read')
    or public.current_role() not in ('support_reviewer','privacy_officer')
    or not public.has_privacy_permission('emergency_access')
    or length(trim(emergency_reason)) < 20 then
    insert into public.administrative_audit(actor_id,action,case_id,reason,outcome)
      values(auth.uid(),'request_emergency_access',c.id,'Emergency access denied','denied');
    return false;
  end if;
  update public.review_cases set status='emergency',approved_start=requested_start,
    approved_end=requested_end,approved_at=clock_timestamp(),
    access_expires_at=clock_timestamp()+interval '15 minutes' where id=c.id;
  insert into public.administrative_audit(actor_id,action,case_id,reason,scope,outcome)
    values(auth.uid(),'request_emergency_access',c.id,trim(emergency_reason),
      jsonb_build_object('start',c.requested_start,'end',c.requested_end,'expires_in_minutes',15),'granted');
  return true;
end;
$$;
create function public.review_emergency_access(target_case uuid, accepted boolean, review_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c public.review_cases;
begin
  select * into c from public.review_cases where id=target_case for update;
  if c.id is null or c.status <> 'emergency' or c.emergency_reviewed_at is not null
    or auth.uid()=c.reviewer_id or not public.has_privacy_permission('case_approve')
    or not (public.current_role()='privacy_officer' or
      (public.current_role()='support_reviewer' and c.approval_reviewer_id=auth.uid()))
    or length(trim(review_reason)) < 15 then
    insert into public.administrative_audit(actor_id,action,case_id,reason,outcome)
      values(auth.uid(),'review_emergency_access',c.id,'Emergency review denied','denied');
    return false;
  end if;
  update public.review_cases set emergency_reviewed_at=clock_timestamp(),
    status=case when accepted then status else 'closed' end,
    closed_at=case when accepted then closed_at else clock_timestamp() end,
    access_expires_at=case when accepted then access_expires_at else clock_timestamp() end
    where id=c.id;
  insert into public.administrative_audit(actor_id,action,case_id,approval_id,reason,outcome)
    values(auth.uid(),'review_emergency_access',c.id,auth.uid(),trim(review_reason),
      case when accepted then 'granted' else 'denied' end);
  return true;
end;
$$;

create function public.set_privacy_permission(target_user uuid, needed text, enabled boolean, change_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role() <> 'super_admin' or target_user=auth.uid()
    or needed not in ('case_read','case_approve','case_metadata','audit_read','emergency_access')
    or length(trim(change_reason)) < 15 then return false; end if;
  if enabled then
    insert into public.privacy_permissions(user_id,permission,granted_by)
      values(target_user,needed,auth.uid()) on conflict(user_id,permission)
      do update set granted_by=excluded.granted_by,granted_at=clock_timestamp();
  else
    delete from public.privacy_permissions where user_id=target_user and permission=needed;
  end if;
  insert into public.administrative_audit(actor_id,action,reason,scope,outcome)
    values(auth.uid(),'set_privacy_permission',trim(change_reason),
      jsonb_build_object('target_user',target_user,'permission',needed,'enabled',enabled),'recorded');
  return true;
end;
$$;

-- No Supabase user is promoted by this migration. A trusted database operator
-- must bootstrap the first Super Admin after identity verification.
create function public.set_account_role(target_user uuid,new_role public.account_role,change_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role() <> 'super_admin' or target_user=auth.uid()
    or length(trim(change_reason)) < 15 then return false; end if;
  update public.profiles set role=new_role where id=target_user;
  if not found then return false; end if;
  insert into public.administrative_audit(actor_id,action,reason,scope,outcome)
    values(auth.uid(),'set_account_role',trim(change_reason),
      jsonb_build_object('target_user',target_user,'new_role',new_role),'recorded');
  return true;
end;
$$;

revoke execute on function public.request_review_case(text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,uuid),
  public.approve_review_case(uuid,timestamptz,timestamptz,timestamptz,text),
  public.deny_review_case(uuid,text),public.close_review_case(uuid,text),public.read_case_messages(uuid),
  public.read_schedule_history(uuid),public.approve_case_attachment(uuid,uuid,text,timestamptz),
  public.request_emergency_access(uuid,text),public.review_emergency_access(uuid,boolean,text),
  public.set_privacy_permission(uuid,text,boolean,text),public.set_account_role(uuid,public.account_role,text)
  from public, anon;
grant execute on function public.request_review_case(text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,uuid),
  public.approve_review_case(uuid,timestamptz,timestamptz,timestamptz,text),
  public.deny_review_case(uuid,text),public.close_review_case(uuid,text),public.read_case_messages(uuid),
  public.read_schedule_history(uuid),public.approve_case_attachment(uuid,uuid,text,timestamptz),
  public.request_emergency_access(uuid,text),public.review_emergency_access(uuid,boolean,text),
  public.set_privacy_permission(uuid,text,boolean,text),public.set_account_role(uuid,public.account_role,text)
  to authenticated;
revoke execute on function public.authorize_case_attachment(uuid,uuid,uuid),
  public.has_permission_for(uuid,text) from public, anon, authenticated;
grant execute on function public.authorize_case_attachment(uuid,uuid,uuid) to service_role;
