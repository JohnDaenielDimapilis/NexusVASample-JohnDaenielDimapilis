-- Admin-controlled request-to-payment workflow. Apply after the notification migration.
-- Existing assigned services and financial history are preserved; no signatures are inferred.
alter table public.tickets add column workflow jsonb;
alter table public.documents add column purpose text check (purpose in ('agreement','signed-agreement'));
drop index public.one_outstanding_payment;
alter table public.payments alter column status drop default;
alter table public.payments alter column status type text using status::text;
alter table public.payments alter column status set default 'Pending';
alter table public.payments add constraint payment_status_values check (status in ('Pending','Verified','Awaiting confirmation','Paid','Failed','Refunded','Cancelled'));
alter table public.payments drop constraint payments_simulated_check;
alter table public.payments add column "billingId" uuid, add column reference text,
  add column "confirmedBy" uuid references public.profiles,
  add column "confirmationReference" text,
  add column "receiptNumber" text unique,
  add column "periodStart" timestamptz,
  add column "periodEnd" timestamptz,
  add column "submittedAt" timestamptz,
  add column "resolutionReason" text;
create unique index one_outstanding_payment on public.payments ("ticketId") where status in ('Pending','Verified','Awaiting confirmation');
create unique index unique_confirmed_transaction on public.payments (lower(trim("confirmationReference"))) where "confirmationReference" is not null;

drop policy tickets_read on public.tickets;
create policy tickets_read on public.tickets for select to authenticated using (public.can_access_ticket(id));
drop policy documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated using (
  public.current_role() is not null and (
    (purpose is not null and public.can_access_ticket("ticketId")) or
    ("ticketId" is null and "ownerId"=auth.uid()) or
    public.is_conversation_participant("ticketId") or public.can_review_document(id)
  )
);
drop policy document_storage_select on storage.objects;
create policy document_storage_select on storage.objects for select to authenticated using (
  bucket_id='documents' and public.current_role() is not null and (
    ((storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.documents d where d.path=storage.objects.name)) or
    exists(select 1 from public.documents d where d.path=storage.objects.name and (
      (d.purpose is not null and public.can_access_ticket(d."ticketId")) or
      (d."ticketId" is null and d."ownerId"=auth.uid()) or
      public.is_conversation_participant(d."ticketId") or public.can_review_document(d.id)
    ))
  )
);
drop policy document_storage_cleanup on storage.objects;
create policy document_storage_cleanup on storage.objects for delete to authenticated using (
  bucket_id='documents' and (storage.foldername(name))[1]=auth.uid()::text
  and not exists(select 1 from public.documents d where d.path=storage.objects.name)
);

create function public.has_paid_service(tid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.tickets t join public.payments p on p."ticketId"=t.id
    where t.id=tid and t.workflow->'agreement'->>'status'='Approved' and p.status='Paid' and p."billingId"=(t.workflow->'billing'->>'id')::uuid
    and (t.workflow->'billing'->>'kind'='One-time' or
      (t.workflow->'billing'->>'kind'='Subscription' and p."periodEnd">now()
       and p."periodEnd"=(t.workflow->'billing'->>'periodEnd')::timestamptz)));
$$;
-- Use UTC calendar arithmetic, matching the browser, including month-end clamping.
create function public.billing_period_end(start_at timestamptz, frequency text) returns timestamptz
language sql immutable set search_path='' as $$
  select ((start_at at time zone 'UTC') + case frequency when 'Weekly' then interval '7 days'
    when 'Monthly' then interval '1 month' when 'Quarterly' then interval '3 months'
    when 'Yearly' then interval '1 year' end) at time zone 'UTC';
$$;
revoke execute on function public.has_paid_service(uuid),public.billing_period_end(timestamptz,text) from public,anon,authenticated;

alter function public.workspace_command(jsonb) rename to workspace_command_v1349;
revoke execute on function public.workspace_command_v1349(jsonb) from public,anon,authenticated;
create function public.workspace_command(command jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare
  action text := command->>'type'; actor public.profiles; t public.tickets; p public.payments;
  f jsonb; a jsonb; b jsonb; d jsonb; doc_id uuid; tid uuid; payment_id uuid;
  event_text text; ref text; amount numeric; period_start timestamptz; period_end timestamptz;
  assistant public.profiles; now_at timestamptz := now(); target_role text;
begin
  select * into actor from public.profiles where id=auth.uid() and status='Active';
  if actor.id is null then raise exception 'An active account is required.'; end if;
  if action='acceptTicket' then raise exception 'Only Admin can assign requests after agreement approval and payment.'; end if;
  if action in ('pay','verifyPayment','createPayment') then raise exception 'Use Admin agreement approval, service pricing and payment confirmation.'; end if;
  if action='addDocument' and command->'document'->>'purpose' is not null then raise exception 'Use the agreement upload action.'; end if;

  if action='createTicket' then
    if actor.role<>'client' then raise exception 'Only clients can create requests.'; end if;
    if length(trim(command->>'title')) not between 5 and 150 or length(trim(command->>'description')) not between 15 and 5000 then raise exception 'Enter a valid request title and description.'; end if;
    if command->>'category' not in ('Administrative support','Content & marketing','Design & creative','Customer support','Research & data','Web & technology') then raise exception 'Select a valid service.'; end if;
    if (command->>'dueDate')::date<current_date or command->>'dueDate' is null then raise exception 'Choose today or a future due date.'; end if;
    f:=jsonb_build_object('version',1,'agreement',jsonb_build_object('status','Not sent','revision',0),'events','[]'::jsonb);
    insert into public.tickets("clientId",title,description,category,budget,difficulty,"dueDate",workflow)
    values(actor.id,trim(command->>'title'),trim(command->>'description'),command->>'category',(command->>'budget')::numeric,(command->>'difficulty')::public.difficulty,(command->>'dueDate')::date,f) returning * into t;
    insert into public.audit("actorId","ticketId",text) values(actor.id,t.id,'Created a service request');
    insert into public.notifications("userId",text,target) select id,'New request: '||t.title,jsonb_build_object('kind','ticket','id',t.id) from public.profiles where role='admin' and status='Active';
    return;
  end if;

  if action not in ('reviewRequest','sendAgreement','returnAgreement','readAgreement','approveAgreement','correctAgreement',
    'setServicePrice','submitPayment','confirmPayment','resolvePayment','retryPayment','unsubscribe','issueRenewal','startWork',
    'assignTicket','deliver','closeTicket') then
    perform public.workspace_command_v1349(command); return;
  end if;
  tid:=(command->>'ticketId')::uuid;
  if command ? 'paymentId' then
    payment_id:=(command->>'paymentId')::uuid;
    select "ticketId" into tid from public.payments where id=payment_id;
  end if;
  -- Serialize all state changes for a request before reading its payment or agreement.
  select * into t from public.tickets where id=tid for update;
  if t.id is null or not (actor.role='admin' or (actor.role='client' and t."clientId"=actor.id) or (actor.role='staff' and t."assigneeId"=actor.id)) then raise exception 'Request not found.'; end if;
  if payment_id is not null then select * into p from public.payments where id=payment_id for update; end if;
  f:=coalesce(t.workflow,jsonb_build_object('version',1,'agreement',jsonb_build_object('status','Not sent','revision',0),'events','[]'::jsonb));
  a:=f->'agreement'; b:=f->'billing';
  if action in ('reviewRequest','sendAgreement','approveAgreement','correctAgreement','setServicePrice','confirmPayment','resolvePayment','issueRenewal','assignTicket') and actor.role<>'admin' then raise exception 'Only Admin can perform this action.'; end if;
  if action in ('readAgreement','returnAgreement','submitPayment','retryPayment','unsubscribe') and (actor.role<>'client' or actor.id<>t."clientId") then raise exception 'Only the request client can perform this action.'; end if;
  if action in ('setServicePrice','submitPayment','confirmPayment','retryPayment','unsubscribe','issueRenewal') and a->>'status'<>'Approved' then raise exception 'Admin must approve the signed agreement first.'; end if;
  if action in ('submitPayment','confirmPayment','retryPayment','unsubscribe','issueRenewal') and b is null then raise exception 'Admin must configure pricing first.'; end if;
  if action in ('reviewRequest','sendAgreement','returnAgreement','approveAgreement','correctAgreement','setServicePrice','assignTicket','startWork') and t.status='Completed' then raise exception 'This service is completed.'; end if;

  if action in ('submitPayment','confirmPayment','retryPayment') and p."billingId" is distinct from (b->>'id')::uuid then raise exception 'Payment not found for this billing arrangement.'; end if;

  case action
  when 'reviewRequest' then
    if f ? 'reviewedAt' or (t."assigneeId" is not null and t.workflow is not null) then raise exception 'This request is already under review or assigned.'; end if;
    if t."assigneeId" is not null then f:=f||jsonb_build_object('existingAssignment',true); end if;
    f:=f||jsonb_build_object('reviewedAt',now_at);
    update public.payments set status='Cancelled',"resolutionReason"='Replaced by Admin agreement and pricing workflow.' where "ticketId"=tid and status in ('Pending','Verified','Awaiting confirmation');
    event_text:='Admin started reviewing the request';
  when 'sendAgreement', 'returnAgreement' then
    if action='sendAgreement' then
      if not(f ? 'reviewedAt') or b is not null or (t."assigneeId" is not null and not coalesce((f->>'existingAssignment')::boolean,false)) or a->>'status'='Approved' then raise exception 'Review the request before sending an agreement. Approved terms are locked.'; end if;
    else
      if a->>'status' not in ('Sent','Awaiting signature','Corrections requested') or command->'acknowledged' is distinct from 'true'::jsonb then raise exception 'Review and sign the agreement, then acknowledge your signed copy.'; end if;
    end if;
    d:=command->'document'; doc_id:=(d->>'id')::uuid;
    if d->>'ownerId' is distinct from actor.id::text or d->>'ticketId' is distinct from tid::text or (d->>'isOutput')::boolean is distinct from false
      or d->>'name' !~* '\.pdf$' or d->>'type' is distinct from 'application/pdf'
      or (d->>'size')::bigint not between 1 and 10485760
      or d->>'path' not like actor.id::text||'/'||doc_id::text||'/%'
      or not exists(select 1 from storage.objects o where o.bucket_id='documents' and o.name=d->>'path' and o.owner_id=actor.id::text)
      then raise exception 'Upload a new PDF up to 10 MB for this request.'; end if;
    insert into public.documents(id,"ownerId","ticketId",name,size,type,path,purpose)
      values(doc_id,actor.id,tid,d->>'name',(d->>'size')::bigint,'application/pdf',d->>'path',case when action='sendAgreement' then 'agreement' else 'signed-agreement' end);
    if action='sendAgreement' then
      a:=jsonb_build_object('status','Sent','revision',(a->>'revision')::int+1,'originalId',doc_id);
      event_text:='Agreement revision '||(a->>'revision')||' sent to client';
    else
      a:=(a-'correction')||jsonb_build_object('status','Returned','signedId',doc_id);
      event_text:='Client returned a signed copy for Admin review';
    end if;
  when 'readAgreement' then
    if a->>'status'<>'Sent' then raise exception 'Agreement is not awaiting review.'; end if;
    a:=a||jsonb_build_object('status','Awaiting signature'); event_text:='Client opened the agreement for signature';
  when 'approveAgreement' then
    if a->>'status'<>'Returned' or not(a ? 'signedId') then raise exception 'A returned signed copy is required.'; end if;
    a:=a||jsonb_build_object('status','Approved','approvedAt',now_at,'approvedBy',actor.id); event_text:='Admin approved the returned agreement';
  when 'correctAgreement' then
    if a->>'status'<>'Returned' or length(trim(command->>'reason')) not between 5 and 2000 or command->>'reason' is null then raise exception 'Review a returned copy and explain the requested corrections.'; end if;
    a:=a||jsonb_build_object('status','Corrections requested','correction',trim(command->>'reason')); event_text:='Agreement corrections requested: '||trim(command->>'reason');
  when 'setServicePrice' then
    amount:=(command->>'amount')::numeric;
    if b is not null then raise exception 'The agreed price is locked. It cannot be charged twice.'; end if;
    if amount is null or amount<=0 or amount>1000000 or amount<>round(amount,2) or command->>'kind' not in ('One-time','Subscription') or command->>'kind' is null
      or (command->>'kind'='Subscription' and coalesce(command->>'frequency','') not in ('Weekly','Monthly','Quarterly','Yearly'))
      or coalesce(length(trim(command->>'instructions')),0) not between 10 and 2000 then raise exception 'Enter a valid price, arrangement and payment instructions.'; end if;
    b:=jsonb_build_object('id',gen_random_uuid(),'kind',command->>'kind','amount',amount,'method','Admin-confirmed payment','instructions',trim(command->>'instructions'),'configuredAt',now_at);
    if command->>'kind'='Subscription' then b:=b||jsonb_build_object('frequency',command->>'frequency'); end if;
    insert into public.payments("ticketId",amount,description,simulated,"billingId") values(tid,amount,(b->>'kind')||' service — '||t.title,false,(b->>'id')::uuid);
    event_text:='Admin set the service price and sent the invoice';
  when 'submitPayment' then
    if b ? 'cancelledAt' or p.status not in ('Pending','Verified') or command->'accepted' is distinct from 'true'::jsonb or coalesce(length(trim(command->>'reference')),0) not between 3 and 200 then raise exception 'Review the terms and submit an outstanding invoice with your payment reference.'; end if;
    update public.payments set status='Awaiting confirmation',reference=trim(command->>'reference'),"submittedAt"=now_at where id=payment_id;
    event_text:='Client submitted a payment reference; confirmation is pending';
  when 'confirmPayment' then
    ref:=trim(command->>'reference');
    if b ? 'cancelledAt' or p.status<>'Awaiting confirmation' or coalesce(length(ref),0) not between 3 and 200 then raise exception 'Only a submitted payment can be confirmed, with an independent transaction reference.'; end if;
    if b->>'kind'='Subscription' then
      period_start:=greatest(coalesce(p."periodStart",now_at),now_at);
      period_end:=public.billing_period_end(period_start,b->>'frequency');
      b:=b||jsonb_build_object('periodStart',period_start,'periodEnd',period_end,'nextBillingDate',period_end);
    end if;
    update public.payments set status='Paid',"paidAt"=now_at,"confirmedBy"=actor.id,"confirmationReference"=ref,"receiptNumber"='NX-'||id::text,"periodStart"=period_start,"periodEnd"=period_end where id=payment_id;
    event_text:='Admin confirmed receipt of payment';
  when 'resolvePayment' then
    target_role:=command->>'status';
    if coalesce(length(trim(command->>'reason')),0) not between 5 and 2000 or target_role not in ('Failed','Cancelled','Refunded') or target_role is null
      or (target_role='Refunded' and p.status<>'Paid') or (target_role<>'Refunded' and p.status not in ('Pending','Verified','Awaiting confirmation')) then raise exception 'Choose a valid payment transition and provide a reason.'; end if;
    update public.payments set status=target_role,"resolutionReason"=trim(command->>'reason') where id=payment_id;
    if target_role='Refunded' and b->>'kind'='Subscription' and (b->>'periodEnd')::timestamptz=p."periodEnd" then
      b:=(b-'nextBillingDate')||jsonb_build_object('periodEnd',now_at,'cancelledAt',now_at,'cancelAtPeriodEnd',true);
    end if;
    event_text:='Admin recorded payment '||lower(target_role)||': '||trim(command->>'reason');
  when 'retryPayment' then
    if b ? 'cancelledAt' or p.status not in ('Failed','Cancelled') or exists(select 1 from public.payments x where x."ticketId"=tid and x.id<>p.id and (x.status in ('Pending','Verified','Awaiting confirmation') or (x.status='Paid' and x."periodEnd" is not distinct from p."periodEnd"))) then raise exception 'This invoice cannot be retried.'; end if;
    update public.payments set status='Pending',reference=null,"submittedAt"=null where id=payment_id; event_text:='Client reopened the invoice for another payment attempt';
  when 'unsubscribe' then
    if b->>'kind'<>'Subscription' or b ? 'cancelledAt' then raise exception 'There is no renewing subscription to cancel.'; end if;
    b:=(b-'nextBillingDate')||jsonb_build_object('cancelledAt',now_at,'cancelAtPeriodEnd',true);
    update public.payments set status='Cancelled',"resolutionReason"='Client cancelled future renewals.' where "ticketId"=tid and status in ('Pending','Verified','Awaiting confirmation');
    event_text:=case when (b->>'periodEnd')::timestamptz>now_at then 'Client cancelled renewals; paid access ends '||(b->>'periodEnd') else 'Client cancelled the subscription; no future renewals' end;
  when 'issueRenewal' then
    period_start:=(b->>'periodEnd')::timestamptz;
    if b->>'kind'<>'Subscription' or b ? 'cancelledAt' or period_start is null or period_start>now_at or exists(select 1 from public.payments x where x."ticketId"=tid and (x.status in ('Pending','Verified','Awaiting confirmation') or (x.status not in ('Paid','Refunded') and x."periodStart"=period_start))) then raise exception 'A renewal is available only after the period ends with no existing renewal invoice.'; end if;
    insert into public.payments("ticketId",amount,description,simulated,"billingId","periodStart","periodEnd") values(tid,(b->>'amount')::numeric,'Subscription service — '||t.title,false,(b->>'id')::uuid,period_start,public.billing_period_end(period_start,b->>'frequency'));
    event_text:='Admin issued the next subscription invoice';
  when 'assignTicket' then
    if not public.has_paid_service(tid) or t."assigneeId" is not null or t."deliveredAt" is not null or t.status='Completed' then raise exception 'Assignment requires an approved agreement and confirmed, current payment; a service can only be assigned once.'; end if;
    select * into assistant from public.profiles where id=(command->>'staffId')::uuid and role='staff' and status='Active';
    if assistant.id is null then raise exception 'Choose an active assistant.'; end if;
    update public.tickets set "assigneeId"=assistant.id,status='In progress' where id=tid;
    f:=f||jsonb_build_object('assignedAt',now_at);
    insert into public.messages("ticketId","senderId",text,system) values(tid,actor.id,assistant.name||' joined the private request conversation.',true);
    insert into public.notifications("userId",text,target) values(assistant.id,'You were assigned to '||t.title,jsonb_build_object('kind','ticket','id',tid));
    event_text:='Admin assigned '||assistant.name||'; private conversation created';
  when 'startWork' then
    if actor.role<>'staff' or t."assigneeId"<>actor.id or f ? 'startedAt' or not public.has_paid_service(tid) or t."deliveredAt" is not null or t.status='Completed' then raise exception 'Only the assigned VA can start approved, paid work.'; end if;
    f:=f||jsonb_build_object('startedAt',now_at); event_text:='Assigned VA started work';
  when 'deliver', 'closeTicket' then
    if t.workflow is null then perform public.workspace_command_v1349(command); return; end if;
    if not public.has_paid_service(tid) then raise exception 'Delivery and completion require the approved agreement and a current paid service period.'; end if;
    if action='deliver' then
      if not(actor.role='admin' or (actor.role='staff' and t."assigneeId"=actor.id)) or t.status='Completed' then raise exception 'Only the assigned assistant can deliver this work.'; end if;
      if not exists(select 1 from public.documents where "ticketId"=tid and "isOutput") then raise exception 'Upload an output file before marking the work delivered.'; end if;
      update public.tickets set status='In review',"deliveredAt"=now_at where id=tid; event_text:='Delivered the output';
    else
      if actor.role<>'client' or actor.id<>t."clientId" or t.status<>'In review' or t."deliveredAt" is null then raise exception 'Only the client can close delivered, paid work.'; end if;
      if coalesce((command->>'rating')::numeric,0) not between 1 and 5 or (command->>'rating')::numeric<>trunc((command->>'rating')::numeric) then raise exception 'Choose a rating from 1 to 5 stars.'; end if;
      update public.tickets set status='Completed',rating=(command->>'rating')::int,feedback=trim(coalesce(command->>'feedback','')) where id=tid; event_text:='Closed the ticket and left feedback';
    end if;
    insert into public.messages("ticketId","senderId",text,system) values(tid,actor.id,event_text,true);
  else raise exception 'Unsupported workflow action.';
  end case;
  f:=f||jsonb_build_object('agreement',a);
  if b is not null then f:=f||jsonb_build_object('billing',b); end if;
  f:=jsonb_set(f,'{events}',coalesce(f->'events','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'at',now_at,'actorId',actor.id,'text',event_text)));
  update public.tickets set workflow=f where id=tid;
  insert into public.audit("actorId","ticketId",text) values(actor.id,tid,event_text);
  insert into public.notifications("userId",text,target)
    select id,t.title||': '||event_text,jsonb_build_object('kind','ticket','id',tid) from public.profiles
    where id<>actor.id and status='Active' and (
      (actor.role='admin' and id=t."clientId") or (actor.role<>'admin' and role='admin') or id=t."assigneeId");
exception when unique_violation then raise exception 'This invoice, file, or transaction reference has already been recorded.';
end;
$$;
revoke execute on function public.workspace_command(jsonb) from public,anon;
grant execute on function public.workspace_command(jsonb) to authenticated;
