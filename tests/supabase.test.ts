import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFile } from "node:fs/promises";
const ids = {
  client: "11111111-1111-4111-8111-111111111111",
  staff: "22222222-2222-4222-8222-222222222222",
  admin: "33333333-3333-4333-8333-333333333333",
  other: "44444444-4444-4444-8444-444444444444",
  reviewer: "55555555-5555-4555-8555-555555555555",
  officer: "66666666-6666-4666-8666-666666666666",
  superAdmin: "77777777-7777-4777-8777-777777777777",
};
let db: PGlite;
let ticketId: string;
let paymentId: string;
async function as(who: keyof typeof ids) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[who],
  ]);
  await db.exec("set role authenticated");
}
async function command(who: keyof typeof ids, command: object) {
  await as(who);
  return db.query("select public.workspace_command($1::jsonb)", [
    JSON.stringify(command),
  ]);
}
async function rows<T = Record<string, unknown>>(sql: string) {
  await db.exec("reset role");
  return (await db.query<T>(sql)).rows;
}
async function agreementPdf(who: "admin" | "client", ticketId: string) {
  const id = crypto.randomUUID();
  const path = `${ids[who]}/${id}/agreement.pdf`;
  await db.exec("reset role");
  await db.query(
    `insert into storage.objects(bucket_id,name,owner_id) values('documents',$1,$2)`,
    [path, ids[who]],
  );
  return {
    id,
    ownerId: ids[who],
    ticketId,
    name: "agreement.pdf",
    size: 100,
    type: "application/pdf",
    path,
    isOutput: false,
  };
}
async function approveAndPrice(ticketId: string, subscription = false) {
  await command("admin", { type: "reviewRequest", ticketId });
  await command("admin", {
    type: "sendAgreement",
    ticketId,
    document: await agreementPdf("admin", ticketId),
  });
  await command("client", {
    type: "returnAgreement",
    ticketId,
    document: await agreementPdf("client", ticketId),
    acknowledged: true,
  });
  await command("admin", { type: "approveAgreement", ticketId });
  await command("admin", {
    type: "setServicePrice",
    ticketId,
    amount: 220,
    kind: subscription ? "Subscription" : "One-time",
    frequency: "Monthly",
    instructions: "Configured manual payment instructions",
  });
  return (
    await rows<{ id: string }>(
      `select id from public.payments where "ticketId"='${ticketId}' and status='Pending'`,
    )
  )[0].id;
}
async function confirmInvoice(
  paymentId: string,
  reference = crypto.randomUUID(),
) {
  await command("client", {
    type: "submitPayment",
    paymentId,
    reference: "client-reference",
    accepted: true,
  });
  await command("admin", { type: "confirmPayment", paymentId, reference });
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  // Minimal Supabase-owned schemas only; the application migration runs unmodified.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    grant usage on schema auth,storage,public to authenticated,anon,service_role;
    grant execute on function auth.uid(),storage.foldername(text) to authenticated,anon;
    grant select,insert,delete on storage.objects to authenticated;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610270001_workspace.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const migration of [
    "202611050001_privacy_roles.sql",
    "202611050002_private_review.sql",
    "202611150001_notification_actions.sql",
    "202611180001_request_agreement_billing.sql",
  ]) {
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  }
  for (const [name, id] of Object.entries(ids))
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${name}@test.example`,
      JSON.stringify({ name: `Test ${name}`, role: "admin" }),
    ]);
  await db.query(
    `update public.profiles set role='staff',"skillLevel"='Hard',"autoAssign"=true,skills=array['Content & marketing'] where id=$1`,
    [ids.staff],
  );
  await db.query(`update public.profiles set role='admin' where id=$1`, [
    ids.admin,
  ]);
  await db.query(
    `update public.profiles set role='support_reviewer' where id=$1`,
    [ids.reviewer],
  );
  await db.query(
    `update public.profiles set role='privacy_officer' where id=$1`,
    [ids.officer],
  );
  await db.query(`update public.profiles set role='super_admin' where id=$1`, [
    ids.superAdmin,
  ]);
  await db.query(
    `insert into public.privacy_permissions(user_id,permission) values
    ($1,'case_read'),($2,'case_approve'),($2,'case_metadata'),($2,'audit_read')`,
    [ids.reviewer, ids.officer],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Supabase migration and real PostgreSQL workflow", () => {
  it("does not grant privileged roles from signup metadata", async () => {
    const p = await rows<{ role: string }>(
      `select role from public.profiles where id='${ids.other}'`,
    );
    expect(p[0].role).toBe("client");
  });
  it("creates a submitted request for Admin without a payment or VA assignment", async () => {
    await command("client", {
      type: "createTicket",
      title: "Create our content calendar",
      description: "Prepare a content calendar for our next product launch.",
      category: "Content & marketing",
      budget: 220,
      difficulty: "Medium",
      dueDate: "2099-01-01",
    });
    const t = await rows<{ id: string }>("select id from public.tickets");
    ticketId = t[0].id;
    expect(await rows("select * from public.payments")).toHaveLength(0);
    await as("staff");
    expect((await db.query("select * from public.tickets")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from public.notifications")).rows,
    ).toHaveLength(0);
  });
  it("enforces RLS for unrelated clients and prevents direct role or payment updates", async () => {
    await as("other");
    expect((await db.query("select * from public.tickets")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from public.payments")).rows).toHaveLength(
      0,
    );
    await expect(
      db.exec(`update public.profiles set role='admin'`),
    ).rejects.toThrow("permission denied");
    await expect(command("other", { type: "pay", paymentId })).rejects.toThrow(
      "Admin",
    );
    await as("client");
    await expect(
      db.exec(`update public.payments set status='Paid'`),
    ).rejects.toThrow("permission denied");
  });
  it("requires signed agreement approval, explicit confirmation and Admin-only assignment", async () => {
    await expect(
      command("staff", { type: "acceptTicket", ticketId }),
    ).rejects.toThrow("Only Admin");
    await expect(
      command("admin", { type: "assignTicket", ticketId, staffId: ids.staff }),
    ).rejects.toThrow("Assignment requires");
    await expect(
      command("admin", {
        type: "setServicePrice",
        ticketId,
        amount: 220,
        kind: "One-time",
        instructions: "Test payment instructions",
      }),
    ).rejects.toThrow("approve");
    paymentId = await approveAndPrice(ticketId);
    await expect(
      command("client", {
        type: "confirmPayment",
        paymentId,
        reference: "forged",
      }),
    ).rejects.toThrow("Admin");
    await command("client", {
      type: "submitPayment",
      paymentId,
      reference: "client-ref",
      accepted: true,
    });
    await expect(
      command("admin", { type: "assignTicket", ticketId, staffId: ids.staff }),
    ).rejects.toThrow("Assignment requires");
    await command("admin", {
      type: "confirmPayment",
      paymentId,
      reference: "txn-main-123",
    });
    expect(
      (
        await rows<{ assigneeId: null }>(
          'select "assigneeId" from public.tickets',
        )
      )[0].assigneeId,
    ).toBeNull();
    await expect(
      command("admin", {
        type: "confirmPayment",
        paymentId,
        reference: "txn-main-123",
      }),
    ).rejects.toThrow("submitted");
    await command("admin", {
      type: "assignTicket",
      ticketId,
      staffId: ids.staff,
    });
    await command("staff", { type: "startWork", ticketId });
    const t = await rows<{ assigneeId: string }>(
      `select "assigneeId" from public.tickets where id='${ticketId}'`,
    );
    expect(t[0].assigneeId).toBe(ids.staff);
  });
  it("allows participant messaging and blocks old VA billing paths", async () => {
    await command("staff", {
      type: "sendMessage",
      ticketId,
      text: "I’m starting your calendar now.",
    });
    await expect(
      command("other", {
        type: "sendMessage",
        ticketId,
        text: "Unrelated account",
      }),
    ).rejects.toThrow("Messages require");
    await expect(
      command("staff", {
        type: "createPayment",
        ticketId,
        amount: 30,
        description: "Additional work",
      }),
    ).rejects.toThrow("Admin");
    await expect(
      command("staff", { type: "verifyPayment", paymentId }),
    ).rejects.toThrow("Admin");
    await expect(
      command("staff", { type: "deliver", ticketId }),
    ).rejects.toThrow("Upload");
  });
  it("checks private upload ownership, delivers output, and records client satisfaction", async () => {
    const fileId = crypto.randomUUID();
    const path = `${ids.staff}/${fileId}/calendar.txt`;
    await db.exec("reset role");
    await db.query(
      `insert into storage.objects(bucket_id,name,owner_id) values('documents',$1,$2)`,
      [path, ids.staff],
    );
    await command("staff", {
      type: "addDocument",
      document: {
        id: fileId,
        ownerId: ids.staff,
        ticketId,
        name: "calendar.txt",
        size: 100,
        type: "text/plain",
        path,
        isOutput: true,
      },
    });
    await as("other");
    expect(
      (await db.query("select * from public.documents")).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await command("staff", { type: "deliver", ticketId });
    await expect(
      command("staff", {
        type: "closeTicket",
        ticketId,
        rating: 5,
        feedback: "",
      }),
    ).rejects.toThrow("Only the client");
    await command("client", {
      type: "closeTicket",
      ticketId,
      rating: 5,
      feedback: "Exactly what we needed.",
    });
    const t = await rows<{ status: string; rating: number }>(
      "select status,rating from public.tickets",
    );
    expect(t[0]).toEqual({ status: "Completed", rating: 5 });
  });
  it("prevents calendar conflicts at the database level", async () => {
    const a = {
      type: "createAppointment",
      title: "Project catch-up",
      staffId: ids.staff,
      start: "2099-01-01T10:00:00Z",
      end: "2099-01-01T10:30:00Z",
      notes: "",
    };
    await command("client", a);
    await expect(command("other", a)).rejects.toThrow("overlaps");
  });
  it("exposes the audit trail to admins only", async () => {
    await as("client");
    expect((await db.query("select * from public.audit")).rows).toHaveLength(0);
    await as("admin");
    const entries = (
      await db.query<{ text: string }>("select text from public.audit")
    ).rows;
    expect(entries.length).toBeGreaterThan(5);
    expect(
      entries.some((entry) =>
        /appointment|uploaded|reviewed/i.test(entry.text),
      ),
    ).toBe(false);
  });
  it("keeps messages, calendars, availability, and attachments out of Admin APIs", async () => {
    await as("admin");
    expect((await db.query("select * from public.messages")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from public.appointments")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.documents where purpose is null"))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select * from storage.objects where name not in (select path from public.documents where purpose is not null)",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.visible_staff_settings()")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select available from public.profiles"),
    ).rejects.toThrow("permission denied");
    await expect(
      command("admin", {
        type: "sendMessage",
        ticketId,
        text: "Admin message",
      }),
    ).rejects.toThrow("assigned participant");
    const appointment = (
      await rows<{ id: string }>("select id from public.appointments limit 1")
    )[0];
    await expect(
      command("admin", {
        type: "cancelAppointment",
        appointmentId: appointment.id,
      }),
    ).rejects.toThrow("Appointment not found");
    const document = (
      await rows<{ id: string }>(
        "select id from public.documents where purpose is null limit 1",
      )
    )[0];
    await expect(
      command("admin", { type: "reviewDocument", documentId: document.id }),
    ).rejects.toThrow("cannot review");
    await as("staff");
    expect(
      (await db.query("select * from public.messages")).rows.length,
    ).toBeGreaterThan(0);
    expect(
      (await db.query("select * from public.appointments")).rows.length,
    ).toBeGreaterThan(0);
    await as("other");
    expect((await db.query("select * from public.messages")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from public.appointments")).rows,
    ).toHaveLength(0);
  });
  it("requires a distinct approver and limits message review to approved, live scope", async () => {
    await as("admin");
    const created = await db.query<{ request_review_case: string }>(
      `select public.request_review_case('conversation','Investigate reported dispute',
        'Client reported a disputed message.', $1, null, $2,
        clock_timestamp()-interval '1 day', clock_timestamp())`,
      [ticketId, ids.reviewer],
    );
    const caseId = created.rows[0].request_review_case;
    expect(caseId).toBeTruthy();
    await as("reviewer");
    expect(
      (await db.query("select * from public.read_case_messages($1)", [caseId]))
        .rows,
    ).toHaveLength(0);
    const scope = (
      await rows<{ requested_start: string; requested_end: string }>(
        `select requested_start,requested_end from public.review_cases where id='${caseId}'`,
      )
    )[0];
    await as("reviewer");
    const selfApproval = await db.query<{ approve_review_case: boolean }>(
      `select public.approve_review_case($1,$2,$3,clock_timestamp()+interval '5 minutes',$4)`,
      [
        caseId,
        scope.requested_start,
        scope.requested_end,
        "Independent review approved",
      ],
    );
    expect(selfApproval.rows[0].approve_review_case).toBe(false);
    await as("officer");
    const approval = await db.query<{ approve_review_case: boolean }>(
      `select public.approve_review_case($1,$2,$3,clock_timestamp()+interval '5 minutes',$4)`,
      [
        caseId,
        scope.requested_start,
        scope.requested_end,
        "Independent review approved",
      ],
    );
    expect(approval.rows[0].approve_review_case).toBe(true);
    await as("admin");
    expect(
      (await db.query("select * from public.read_case_messages($1)", [caseId]))
        .rows,
    ).toHaveLength(0);
    await as("reviewer");
    const reviewed = await db.query<{ text: string }>(
      "select * from public.read_case_messages($1)",
      [caseId],
    );
    expect(
      reviewed.rows.some((message) =>
        message.text.includes("starting your calendar"),
      ),
    ).toBe(true);
    await as("admin");
    expect((await db.query("select * from public.messages")).rows).toHaveLength(
      0,
    );
    await as("officer");
    expect(
      (await db.query("select * from public.read_case_messages($1)", [caseId]))
        .rows,
    ).toHaveLength(0);
    await rows(
      `update public.review_cases set access_expires_at=clock_timestamp()-interval '1 second' where id='${caseId}'`,
    );
    await as("reviewer");
    expect(
      (await db.query("select * from public.read_case_messages($1)", [caseId]))
        .rows,
    ).toHaveLength(0);
    const audits = await rows<{ action: string; outcome: string }>(
      `select action,outcome from public.administrative_audit where case_id='${caseId}'`,
    );
    expect(
      audits.some(
        (entry) =>
          entry.action === "read_case_messages" && entry.outcome === "granted",
      ),
    ).toBe(true);
    expect(
      audits.some(
        (entry) =>
          entry.action === "read_case_messages" && entry.outcome === "denied",
      ),
    ).toBe(true);
  });
  it("returns historical slots only and never a future reschedule or cancellation", async () => {
    await rows(`insert into public.appointments("clientId","staffId",title,start,"end",status)
      values('${ids.client}','${ids.staff}','Past missed call',clock_timestamp()-interval '3 days',
        clock_timestamp()-interval '3 days'+interval '30 minutes','No-show')`);
    await rows(`insert into public.appointment_history(appointment_id,client_id,staff_id,title,original_start,original_end,outcome)
      values(gen_random_uuid(),'${ids.client}','${ids.staff}','Old meeting slot',
        clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days'+interval '30 minutes','Rescheduled'),
        (gen_random_uuid(),'${ids.client}','${ids.staff}','Future cancelled slot',
        clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days'+interval '30 minutes','Cancelled')`);
    await as("admin");
    const created = await db.query<{ request_review_case: string }>(
      `select public.request_review_case('schedule','Investigate missed session',
        'Review previous meeting outcomes.',null,$1,$2,
        clock_timestamp()-interval '10 days',clock_timestamp())`,
      [ids.client, ids.reviewer],
    );
    const caseId = created.rows[0].request_review_case;
    const scope = (
      await rows<{ requested_start: string; requested_end: string }>(
        `select requested_start,requested_end from public.review_cases where id='${caseId}'`,
      )
    )[0];
    await as("officer");
    const approved = await db.query<{ approve_review_case: boolean }>(
      `select public.approve_review_case($1,$2,$3,clock_timestamp()+interval '5 minutes',$4)`,
      [
        caseId,
        scope.requested_start,
        scope.requested_end,
        "Historical review is justified",
      ],
    );
    expect(approved.rows[0].approve_review_case).toBe(true);
    await as("reviewer");
    const history = (
      await db.query<{ title: string; outcome: string }>(
        "select * from public.read_schedule_history($1)",
        [caseId],
      )
    ).rows;
    expect(history.some((row) => row.outcome === "No-show")).toBe(true);
    expect(history.some((row) => row.outcome === "Rescheduled")).toBe(true);
    expect(history.some((row) => row.title === "Future cancelled slot")).toBe(
      false,
    );
    await as("admin");
    expect(
      (
        await db.query("select * from public.read_schedule_history($1)", [
          caseId,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select * from public.appointment_history"),
    ).rejects.toThrow("permission denied");
  });
  it("requires separate attachment approval and a service-side scoped lookup", async () => {
    const documentId = crypto.randomUUID();
    const path = `${ids.client}/${documentId}/case-note.txt`;
    await rows(`insert into public.documents(id,"ownerId","ticketId",name,size,type,path,"isOutput")
      values('${documentId}','${ids.client}','${ticketId}','case-note.txt',40,'text/plain','${path}',false)`);
    await as("admin");
    const created = await db.query<{ request_review_case: string }>(
      `select public.request_review_case('conversation','Review reported document',
        'Document is relevant to the reported dispute.',$1,null,$2,
        clock_timestamp()-interval '1 day',clock_timestamp())`,
      [ticketId, ids.reviewer],
    );
    const caseId = created.rows[0].request_review_case;
    const scope = (
      await rows<{ requested_start: string; requested_end: string }>(
        `select requested_start,requested_end from public.review_cases where id='${caseId}'`,
      )
    )[0];
    await as("officer");
    await db.query(
      `select public.approve_review_case($1,$2,$3,clock_timestamp()+interval '10 minutes',
      'Independent document review approved')`,
      [caseId, scope.requested_start, scope.requested_end],
    );
    await as("reviewer");
    await expect(
      db.query("select public.authorize_case_attachment($1,$2,$3)", [
        caseId,
        documentId,
        ids.reviewer,
      ]),
    ).rejects.toThrow("permission denied");
    await as("officer");
    const grant = await db.query<{ approve_case_attachment: boolean }>(
      `select public.approve_case_attachment($1,$2,'Attachment is necessary to resolve the dispute.',clock_timestamp()+interval '5 minutes')`,
      [caseId, documentId],
    );
    expect(grant.rows[0].approve_case_attachment).toBe(true);
    await db.exec("reset role; set role service_role");
    const authorized = await db.query<{ authorize_case_attachment: string }>(
      "select public.authorize_case_attachment($1,$2,$3)",
      [caseId, documentId, ids.reviewer],
    );
    expect(authorized.rows[0].authorize_case_attachment).toBe(path);
    const denied = await db.query<{ authorize_case_attachment: string | null }>(
      "select public.authorize_case_attachment($1,$2,$3)",
      [caseId, documentId, ids.admin],
    );
    expect(denied.rows[0].authorize_case_attachment).toBeNull();
    await as("admin");
    await db.query(
      "select public.close_review_case($1,'The review is complete')",
      [caseId],
    );
    await db.exec("reset role; set role service_role");
    const closed = await db.query<{ authorize_case_attachment: string | null }>(
      "select public.authorize_case_attachment($1,$2,$3)",
      [caseId, documentId, ids.reviewer],
    );
    expect(closed.rows[0].authorize_case_attachment).toBeNull();
  });
  it("records emergency access and revokes it after independent rejection", async () => {
    await rows(
      `insert into public.privacy_permissions(user_id,permission) values('${ids.reviewer}','emergency_access')`,
    );
    await as("admin");
    const created = await db.query<{ request_review_case: string }>(
      `select public.request_review_case('conversation','Investigate urgent report',
        'A documented urgent issue requires review.',$1,null,$2,
        clock_timestamp()-interval '1 day',clock_timestamp())`,
      [ticketId, ids.reviewer],
    );
    const caseId = created.rows[0].request_review_case;
    await as("reviewer");
    const emergency = await db.query<{ request_emergency_access: boolean }>(
      "select public.request_emergency_access($1,'Urgent account safety report requires immediate review')",
      [caseId],
    );
    expect(emergency.rows[0].request_emergency_access).toBe(true);
    expect(
      (await db.query("select * from public.read_case_messages($1)", [caseId]))
        .rows.length,
    ).toBeGreaterThan(0);
    await as("officer");
    const review = await db.query<{ review_emergency_access: boolean }>(
      "select public.review_emergency_access($1,false,'Emergency scope was not justified')",
      [caseId],
    );
    expect(review.rows[0].review_emergency_access).toBe(true);
    await as("reviewer");
    expect(
      (await db.query("select * from public.read_case_messages($1)", [caseId]))
        .rows,
    ).toHaveLength(0);
    const audit = await rows<{ action: string; outcome: string }>(
      `select action,outcome from public.administrative_audit where case_id='${caseId}'`,
    );
    expect(
      audit.some(
        (row) =>
          row.action === "request_emergency_access" &&
          row.outcome === "granted",
      ),
    ).toBe(true);
    expect(
      audit.some(
        (row) =>
          row.action === "review_emergency_access" && row.outcome === "denied",
      ),
    ).toBe(true);
  });
  it("keeps appointment edits and reschedules participant-only and historical", async () => {
    const future = (
      await rows<{
        id: string;
      }>(`insert into public.appointments("clientId","staffId",title,start,"end",notes)
      values('${ids.client}','${ids.staff}','Review notes','2099-03-01T09:00:00Z','2099-03-01T09:30:00Z','Original') returning id`)
    )[0].id;
    await expect(
      command("admin", {
        type: "editAppointment",
        appointmentId: future,
        title: "Admin edit",
        notes: "Not authorized",
      }),
    ).rejects.toThrow("Appointment not found");
    await command("staff", {
      type: "editAppointment",
      appointmentId: future,
      title: "Updated review notes",
      notes: "Bring the latest draft",
    });
    const edited = (
      await rows<{ title: string; notes: string }>(
        `select title,notes from public.appointments where id='${future}'`,
      )
    )[0];
    expect(edited).toEqual({
      title: "Updated review notes",
      notes: "Bring the latest draft",
    });
    await command("client", {
      type: "rescheduleAppointment",
      appointmentId: future,
      start: "2099-03-02T10:00:00Z",
      end: "2099-03-02T10:30:00Z",
    });
    const previous = (
      await rows<{ outcome: string; original_start: string }>(
        `select outcome,original_start from public.appointment_history where appointment_id='${future}'`,
      )
    )[0];
    expect(previous.outcome).toBe("Rescheduled");
    expect(new Date(previous.original_start).toISOString()).toBe(
      "2099-03-01T09:00:00.000Z",
    );
    const past = (
      await rows<{
        id: string;
      }>(`insert into public.appointments("clientId","staffId",title,start,"end")
      values('${ids.client}','${ids.staff}','Past session',clock_timestamp()-interval '1 day',
        clock_timestamp()-interval '1 day'+interval '30 minutes') returning id`)
    )[0].id;
    await command("staff", { type: "markNoShow", appointmentId: past });
    const marked = (
      await rows<{ status: string }>(
        `select status from public.appointments where id='${past}'`,
      )
    )[0];
    expect(marked.status).toBe("No-show");
    await as("admin");
    const adminAudit = (
      await db.query<{ text: string }>("select text from public.audit")
    ).rows;
    expect(adminAudit.some((entry) => /appointment/i.test(entry.text))).toBe(
      false,
    );
  });
  it("binds second-reviewer approval to the assigned case", async () => {
    await rows(
      `update public.profiles set role='support_reviewer' where id='${ids.other}'`,
    );
    await rows(`insert into public.privacy_permissions(user_id,permission)
      values('${ids.other}','case_approve')`);
    await as("admin");
    const available = (
      await db.query<{ id: string; can_approve: boolean }>(
        "select id,can_approve from public.visible_case_reviewers()",
      )
    ).rows;
    expect(
      available.some((row) => row.id === ids.other && row.can_approve),
    ).toBe(true);
    const assigned = await db.query<{ request_review_case: string }>(
      `select public.request_review_case('conversation','Independent scope check',
        'A second reviewer will approve the scope.',$1,null,$2,
        clock_timestamp()-interval '1 day',clock_timestamp(),$3)`,
      [ticketId, ids.reviewer, ids.other],
    );
    const assignedId = assigned.rows[0].request_review_case;
    const unassigned = await db.query<{ request_review_case: string }>(
      `select public.request_review_case('conversation','Other scope check',
        'Only an authorized approver may approve.',$1,null,$2,
        clock_timestamp()-interval '1 day',clock_timestamp())`,
      [ticketId, ids.reviewer],
    );
    const unassignedId = unassigned.rows[0].request_review_case;
    const scopes = await rows<{
      id: string;
      requested_start: string;
      requested_end: string;
    }>(
      `select id,requested_start,requested_end from public.review_cases
       where id in ('${assignedId}','${unassignedId}')`,
    );
    await as("other");
    const target = scopes.find((item) => item.id === assignedId)!;
    const approved = await db.query<{ approve_review_case: boolean }>(
      `select public.approve_review_case($1,$2,$3,clock_timestamp()+interval '5 minutes',
        'Authorized independent scope approval')`,
      [assignedId, target.requested_start, target.requested_end],
    );
    expect(approved.rows[0].approve_review_case).toBe(true);
    const other = scopes.find((item) => item.id === unassignedId)!;
    const denied = await db.query<{ approve_review_case: boolean }>(
      `select public.approve_review_case($1,$2,$3,clock_timestamp()+interval '5 minutes',
        'This case was not assigned to me')`,
      [unassignedId, other.requested_start, other.requested_end],
    );
    expect(denied.rows[0].approve_review_case).toBe(false);
    expect(
      (
        await db.query("select id from public.review_cases where id=$1", [
          unassignedId,
        ])
      ).rows,
    ).toHaveLength(0);
    await as("officer");
    const rejection = await db.query<{ deny_review_case: boolean }>(
      "select public.deny_review_case($1,'The reported issue does not justify this scope')",
      [unassignedId],
    );
    expect(rejection.rows[0].deny_review_case).toBe(true);
    const status = (
      await rows<{ status: string }>(
        `select status from public.review_cases where id='${unassignedId}'`,
      )
    )[0];
    expect(status.status).toBe("denied");
    await as("client");
    expect(
      (await db.query("select * from public.visible_case_reviewers()")).rows,
    ).toHaveLength(0);
  });
  it("keeps permission changes exclusive to Super Admin and prevents role bypass", async () => {
    await as("admin");
    const denied = await db.query<{ set_privacy_permission: boolean }>(
      "select public.set_privacy_permission($1,'case_read',true,'This change needs approval')",
      [ids.admin],
    );
    expect(denied.rows[0].set_privacy_permission).toBe(false);
    await as("superAdmin");
    const granted = await db.query<{ set_privacy_permission: boolean }>(
      "select public.set_privacy_permission($1,'case_read',true,'Testing restricted assignment')",
      [ids.admin],
    );
    expect(granted.rows[0].set_privacy_permission).toBe(true);
    await as("admin");
    const roleBypass = await db.query<{ request_review_case: string | null }>(
      `select public.request_review_case('conversation','Restricted role check',
        'Admin should not become a reviewer.',$1,null,$2,
        clock_timestamp()-interval '1 day',clock_timestamp())`,
      [ticketId, ids.admin],
    );
    expect(roleBypass.rows[0].request_review_case).toBeNull();
    await as("superAdmin");
    const changed = await db.query<{ set_account_role: boolean }>(
      "select public.set_account_role($1,'support_reviewer','Authorized test role transition')",
      [ids.other],
    );
    expect(changed.rows[0].set_account_role).toBe(true);
    const role = await rows<{ role: string }>(
      `select role from public.profiles where id='${ids.other}'`,
    );
    expect(role[0].role).toBe("support_reviewer");
    await as("admin");
    await expect(
      db.query("delete from public.administrative_audit"),
    ).rejects.toThrow("permission denied");
  });
});
describe("Connected notification actions through the existing RPC", () => {
  it("persists own read/unread and dismiss/restore, with ownership checks and no direct-write bypass", async () => {
    await db.exec("reset role");
    const inserted = (
      await db.query<{ id: string; userId: string }>(
        "insert into public.notifications(\"userId\",text) values ($1,'Notification ownership test'),($2,'Other owner notification') returning id,\"userId\"",
        [ids.client, ids.staff],
      )
    ).rows;
    const own = inserted.find((n) => n.userId === ids.client)!.id;
    const foreign = inserted.find((n) => n.userId === ids.staff)!.id;
    await command("client", {
      type: "setNotificationRead",
      notificationId: own,
      read: true,
    });
    await command("client", {
      type: "setNotificationRead",
      notificationId: own,
      read: true,
    });
    expect(
      (
        await rows<{ read: boolean }>(
          `select read from public.notifications where id='${own}'`,
        )
      )[0].read,
    ).toBe(true);
    await command("client", {
      type: "setNotificationRead",
      notificationId: own,
      read: false,
    });
    await command("client", {
      type: "dismissNotification",
      notificationId: own,
      dismissed: true,
    });
    expect(
      (
        await rows<{ dismissed: boolean }>(
          `select dismissed from public.notifications where id='${own}'`,
        )
      )[0].dismissed,
    ).toBe(true);
    await command("client", {
      type: "dismissNotification",
      notificationId: own,
      dismissed: false,
    });
    await expect(
      command("client", {
        type: "setNotificationRead",
        notificationId: foreign,
        read: true,
      }),
    ).rejects.toThrow("Notification not found");
    await expect(
      command("admin", {
        type: "dismissNotification",
        notificationId: own,
        dismissed: true,
      }),
    ).rejects.toThrow("Notification not found");
    await expect(
      command("client", {
        type: "setNotificationRead",
        notificationId: own,
        read: "false",
      }),
    ).rejects.toThrow("valid notification status");
    await expect(
      command("client", {
        type: "readNotifications",
        notificationIds: [own, foreign],
      }),
    ).rejects.toThrow("Notification not found");
    expect(
      (
        await rows<{ read: boolean }>(
          `select read from public.notifications where id='${own}'`,
        )
      )[0].read,
    ).toBe(false);
    await as("client");
    await expect(
      db.exec("update public.notifications set read=true"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select public.workspace_command_v1347($1::jsonb)", [
        JSON.stringify({ type: "readNotifications" }),
      ]),
    ).rejects.toThrow("permission denied");
    expect(
      (
        await db.query<{ userId: string }>(
          'select "userId" from public.notifications',
        )
      ).rows.every((n) => n.userId === ids.client),
    ).toBe(true);
  });
  it("bulk read uses a bounded snapshot and keeps dismissed or later notices unread", async () => {
    await db.exec("reset role");
    const notes = (
      await db.query<{ id: string }>(
        `insert into public.notifications("userId",text) values ($1,'Snapshot one'),($1,'Snapshot later'),($1,'Snapshot dismissed') returning id`,
        [ids.client],
      )
    ).rows;
    await command("client", {
      type: "dismissNotification",
      notificationId: notes[2].id,
      dismissed: true,
    });
    await command("client", {
      type: "readNotifications",
      notificationIds: [notes[0].id],
    });
    const statuses = await rows<{ id: string; read: boolean }>(
      `select id,read from public.notifications where id in ('${notes.map((n) => n.id).join("','")}')`,
    );
    expect(statuses.find((n) => n.id === notes[0].id)!.read).toBe(true);
    expect(statuses.find((n) => n.id === notes[1].id)!.read).toBe(false);
    expect(statuses.find((n) => n.id === notes[2].id)!.read).toBe(false);
    await command("client", { type: "readNotifications", notificationIds: [] });
    await command("client", { type: "readNotifications" });
    expect(
      (
        await rows<{ read: boolean }>(
          `select read from public.notifications where id='${notes[2].id}'`,
        )
      )[0].read,
    ).toBe(false);
  });
  it("attaches actual IDs to request, conversation and payment notifications without changing the workflows", async () => {
    await command("client", {
      type: "createTicket",
      title: "Connected notification record links",
      description:
        "Exercise the actual command path and notification metadata.",
      category: "Content & marketing",
      budget: 120,
      difficulty: "Easy",
      dueDate: "2099-01-01",
      target: { kind: "ticket", id: ticketId },
    });
    const t = (
      await rows<{ id: string }>(
        "select id from public.tickets where title='Connected notification record links'",
      )
    )[0];
    const created = await rows<{ target: { kind: string; id: string } }>(
      "select target from public.notifications where text='New request: Connected notification record links'",
    );
    expect(created.length).toBeGreaterThan(0);
    expect(
      created.every((n) => n.target?.kind === "ticket" && n.target.id === t.id),
    ).toBe(true);
    const approvedPayment = await approveAndPrice(t.id);
    await confirmInvoice(approvedPayment);
    await command("admin", {
      type: "assignTicket",
      ticketId: t.id,
      staffId: ids.staff,
    });
    await command("client", {
      type: "sendMessage",
      ticketId: t.id,
      text: "Actual notification integration test",
    });
    const message = (
      await rows<{ target: { kind: string; id: string } }>(
        "select target from public.notifications where text='New message on Connected notification record links'",
      )
    )[0];
    expect(message.target).toEqual({ kind: "conversation", id: t.id });
    const confirmed = await rows<{ target: { kind: string; id: string } }>(
      `select target from public.notifications where text='Connected notification record links: Admin confirmed receipt of payment'`,
    );
    expect(
      confirmed.some((n) => n.target.kind === "ticket" && n.target.id === t.id),
    ).toBe(true);
    await db.exec("reset role");
    const unlinked = (
      await db.query<{ target: unknown }>(
        "insert into public.notifications(\"userId\",text) values ($1,'Outside command event') returning target",
        [ids.client],
      )
    ).rows[0];
    expect(unlinked.target).toBeNull();
  });
  it("captures distinct generated appointment IDs even when appointment titles are identical", async () => {
    await db.exec("reset role");
    await db.query("update public.profiles set available=true where id=$1", [
      ids.staff,
    ]);
    for (const hour of [10, 11])
      await command("client", {
        type: "createAppointment",
        title: "Same appointment title",
        staffId: ids.staff,
        start: `2099-03-01T${hour}:00:00Z`,
        end: `2099-03-01T${hour}:30:00Z`,
        notes: "",
      });
    const appointments = await rows<{ id: string }>(
      "select id from public.appointments where title='Same appointment title'",
    );
    const notes = await rows<{ target: { kind: string; id: string } }>(
      "select target from public.notifications where text='New appointment: Same appointment title'",
    );
    expect(notes.map((n) => n.target.id).sort()).toEqual(
      appointments.map((a) => a.id).sort(),
    );
    expect(notes.every((n) => n.target.kind === "appointment")).toBe(true);
  });
});
describe("Request agreement and billing security", () => {
  async function createRequest() {
    await command("client", {
      type: "createTicket",
      title: `Approval test ${crypto.randomUUID()}`,
      description: "A complete request awaiting Admin agreement and pricing.",
      category: "Content & marketing",
      budget: 220,
      difficulty: "Medium",
      dueDate: "2099-01-01",
    });
    return (
      await rows<{ id: string }>(
        "select id from public.tickets order by number desc limit 1",
      )
    )[0].id;
  }
  it("keeps submitted requests, agreements and invoices away from unrelated roles", async () => {
    const tid = await createRequest();
    const pid = await approveAndPrice(tid);
    await as("staff");
    expect(
      (await db.query("select id from public.tickets where id=$1", [tid])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select id from public.payments where id=$1", [pid]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query('select id from public.documents where "ticketId"=$1', [
          tid,
        ])
      ).rows,
    ).toHaveLength(0);
    await as("admin");
    expect(
      (
        await db.query('select id from public.documents where "ticketId"=$1', [
          tid,
        ])
      ).rows,
    ).toHaveLength(2);
    expect(
      (
        await db.query(
          'select name from storage.objects where name in (select path from public.documents where "ticketId"=$1)',
          [tid],
        )
      ).rows,
    ).toHaveLength(2);
    await as("reviewer");
    expect(
      (await db.query("select id from public.payments where id=$1", [pid]))
        .rows,
    ).toHaveLength(0);
    await as("client");
    await expect(
      db.query("select public.workspace_command_v1349($1::jsonb)", [
        JSON.stringify({ type: "pay", paymentId: pid }),
      ]),
    ).rejects.toThrow("permission denied");
  });
  it("requires a real uploaded PDF object and explicit signature return, and preserves corrections", async () => {
    const ticketId = await createRequest();
    await command("admin", { type: "reviewRequest", ticketId });
    const document = await agreementPdf("admin", ticketId);
    await expect(
      command("client", { type: "sendAgreement", ticketId, document }),
    ).rejects.toThrow("Admin");
    await expect(
      command("admin", {
        type: "sendAgreement",
        ticketId,
        document: {
          ...document,
          path: `${ids.admin}/${document.id}/missing.pdf`,
        },
      }),
    ).rejects.toThrow("PDF");
    await command("admin", { type: "sendAgreement", ticketId, document });
    await command("client", { type: "readAgreement", ticketId });
    const signed = await agreementPdf("client", ticketId);
    await expect(
      command("client", {
        type: "returnAgreement",
        ticketId,
        document: signed,
        acknowledged: false,
      }),
    ).rejects.toThrow("acknowledge");
    await command("client", {
      type: "returnAgreement",
      ticketId,
      document: signed,
      acknowledged: true,
    });
    await command("admin", {
      type: "correctAgreement",
      ticketId,
      reason: "Please sign on the final page.",
    });
    await expect(
      command("admin", { type: "approveAgreement", ticketId }),
    ).rejects.toThrow("returned");
    await command("client", {
      type: "returnAgreement",
      ticketId,
      document: await agreementPdf("client", ticketId),
      acknowledged: true,
    });
    await command("admin", { type: "approveAgreement", ticketId });
    const f = (
      await rows<{ workflow: { agreement: { status: string } } }>(
        `select workflow from public.tickets where id='${ticketId}'`,
      )
    )[0].workflow;
    expect(f.agreement.status).toBe("Approved");
    expect(
      await rows(
        `select id from public.documents where "ticketId"='${ticketId}'`,
      ),
    ).toHaveLength(3);
  });
  it("rejects reused transaction references, double confirmations and duplicate price setup", async () => {
    const tid = await createRequest();
    const pid = await approveAndPrice(tid);
    await command("client", {
      type: "submitPayment",
      paymentId: pid,
      reference: "client-ref",
      accepted: true,
    });
    await expect(
      command("admin", {
        type: "confirmPayment",
        paymentId: pid,
        reference: " TXN-MAIN-123 ",
      }),
    ).rejects.toThrow("already");
    await command("admin", {
      type: "confirmPayment",
      paymentId: pid,
      reference: crypto.randomUUID(),
    });
    await expect(
      command("admin", {
        type: "confirmPayment",
        paymentId: pid,
        reference: crypto.randomUUID(),
      }),
    ).rejects.toThrow("submitted");
    await expect(
      command("admin", {
        type: "setServicePrice",
        ticketId: tid,
        amount: 220,
        kind: "One-time",
        instructions: "Configured instructions",
      }),
    ).rejects.toThrow("locked");
    expect(
      await rows(`select id from public.payments where "ticketId"='${tid}'`),
    ).toHaveLength(1);
  });
  it("handles failure and retry on one invoice, and refunds revoke assignment eligibility", async () => {
    const tid = await createRequest();
    const pid = await approveAndPrice(tid);
    await command("admin", {
      type: "resolvePayment",
      paymentId: pid,
      status: "Failed",
      reason: "External payment declined",
    });
    await expect(
      command("admin", {
        type: "assignTicket",
        ticketId: tid,
        staffId: ids.staff,
      }),
    ).rejects.toThrow("Assignment requires");
    await command("client", { type: "retryPayment", paymentId: pid });
    await confirmInvoice(pid);
    await command("admin", {
      type: "resolvePayment",
      paymentId: pid,
      status: "Refunded",
      reason: "Refund transaction REF-123 confirmed",
    });
    await expect(
      command("admin", {
        type: "assignTicket",
        ticketId: tid,
        staffId: ids.staff,
      }),
    ).rejects.toThrow("Assignment requires");
    expect(
      (
        await rows<{ status: string }>(
          `select status from public.payments where id='${pid}'`,
        )
      )[0].status,
    ).toBe("Refunded");
  });
  it("cancels subscription renewals while retaining access through the paid period", async () => {
    const tid = await createRequest();
    const pid = await approveAndPrice(tid, true);
    await confirmInvoice(pid);
    await command("client", { type: "unsubscribe", ticketId: tid });
    const b = (
      await rows<{
        workflow: {
          billing: {
            cancelAtPeriodEnd: boolean;
            nextBillingDate?: string;
            periodEnd: string;
          };
        };
      }>(`select workflow from public.tickets where id='${tid}'`)
    )[0].workflow.billing;
    expect(b.cancelAtPeriodEnd).toBe(true);
    expect(b.nextBillingDate).toBeUndefined();
    expect(+new Date(b.periodEnd)).toBeGreaterThan(Date.now());
    expect(
      (
        await rows<{ paid: boolean }>(
          `select public.has_paid_service('${tid}') as paid`,
        )
      )[0].paid,
    ).toBe(true);
    await expect(
      command("admin", { type: "issueRenewal", ticketId: tid }),
    ).rejects.toThrow("renewal");
    // Advance the owning records to an expired period without changing a production clock.
    await rows(
      `update public.tickets set workflow=jsonb_set(workflow,'{billing,periodEnd}',to_jsonb(now()-interval '1 second')) where id='${tid}'`,
    );
    expect(
      (
        await rows<{ paid: boolean }>(
          `select public.has_paid_service('${tid}') as paid`,
        )
      )[0].paid,
    ).toBe(false);
  });
  it("cancels a subscription before first payment and rejects a late confirmation", async () => {
    const tid = await createRequest();
    const pid = await approveAndPrice(tid, true);
    await command("client", {
      type: "submitPayment",
      paymentId: pid,
      reference: "client-ref",
      accepted: true,
    });
    await command("client", { type: "unsubscribe", ticketId: tid });
    await expect(
      command("admin", {
        type: "confirmPayment",
        paymentId: pid,
        reference: crypto.randomUUID(),
      }),
    ).rejects.toThrow("submitted");
    await expect(
      command("client", { type: "retryPayment", paymentId: pid }),
    ).rejects.toThrow("cannot");
    expect(
      (
        await rows<{ status: string }>(
          `select status from public.payments where id='${pid}'`,
        )
      )[0].status,
    ).toBe("Cancelled");
  });
  it("creates one unpaid renewal only after expiry and grants a new period after confirmation", async () => {
    const tid = await createRequest();
    const pid = await approveAndPrice(tid, true);
    await confirmInvoice(pid);
    await expect(
      command("admin", { type: "issueRenewal", ticketId: tid }),
    ).rejects.toThrow("renewal");
    await rows(
      `update public.tickets set workflow=jsonb_set(workflow,'{billing,periodEnd}',to_jsonb(now()-interval '1 second')) where id='${tid}'`,
    );
    await command("admin", { type: "issueRenewal", ticketId: tid });
    await expect(
      command("admin", { type: "issueRenewal", ticketId: tid }),
    ).rejects.toThrow("renewal");
    const next = (
      await rows<{ id: string }>(
        `select id from public.payments where "ticketId"='${tid}' and status='Pending'`,
      )
    )[0].id;
    expect(
      (
        await rows<{ paid: boolean }>(
          `select public.has_paid_service('${tid}') as paid`,
        )
      )[0].paid,
    ).toBe(false);
    await confirmInvoice(next);
    expect(
      (
        await rows<{ paid: boolean }>(
          `select public.has_paid_service('${tid}') as paid`,
        )
      )[0].paid,
    ).toBe(true);
    expect(
      await rows(`select id from public.payments where "ticketId"='${tid}'`),
    ).toHaveLength(2);
    const clamped = (
      await rows<{ ends: string }>(
        "select public.billing_period_end('2028-01-31T10:00:00Z','Monthly') as ends",
      )
    )[0].ends;
    expect(new Date(clamped).toISOString()).toBe("2028-02-29T10:00:00.000Z");
  });
  it("does not treat legacy paid estimates as payment of a new agreement", async () => {
    const tid = await createRequest();
    await rows(
      `insert into public.payments("ticketId",amount,description,status,"paidAt") values('${tid}',20,'Legacy estimate','Paid',now())`,
    );
    await approveAndPrice(tid);
    await expect(
      command("admin", {
        type: "assignTicket",
        ticketId: tid,
        staffId: ids.staff,
      }),
    ).rejects.toThrow("Assignment requires");
  });
});
describe("Existing connected service transition", () => {
  it("retains a legacy assignment and messages through agreement review and creates a separately scoped invoice", async () => {
    const tid = (
      await rows<{ id: string }>(
        `insert into public.tickets("clientId","assigneeId",title,description,category,budget,difficulty,status,"dueDate") values('${ids.client}','${ids.staff}','Existing assigned service','This was assigned before the agreement workflow.','Content & marketing',220,'Medium','In progress','2099-01-01') returning id`,
      )
    )[0].id;
    await rows(
      `insert into public.payments("ticketId",amount,description,status,"paidAt") values('${tid}',220,'Legacy paid estimate','Paid',now())`,
    );
    const pid = await approveAndPrice(tid);
    expect(
      (
        await rows<{ assigneeId: string }>(
          `select "assigneeId" from public.tickets where id='${tid}'`,
        )
      )[0].assigneeId,
    ).toBe(ids.staff);
    expect(
      (
        await rows<{ paid: boolean }>(
          `select public.has_paid_service('${tid}') as paid`,
        )
      )[0].paid,
    ).toBe(false);
    await confirmInvoice(pid);
    expect(
      (
        await rows<{ paid: boolean }>(
          `select public.has_paid_service('${tid}') as paid`,
        )
      )[0].paid,
    ).toBe(true);
  });
});
