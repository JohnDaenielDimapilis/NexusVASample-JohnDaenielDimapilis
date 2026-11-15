import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const bearer = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return json({ error: "Sign in to view this attachment." }, 401);
  const endpoint = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!endpoint || !anonKey || !serviceKey) return json({ error: "Review service is unavailable." }, 503);

  let caseId: string;
  let documentId: string;
  try {
    const input = await request.json();
    caseId = String(input.caseId || "");
    documentId = String(input.documentId || "");
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!uuid.test(caseId) || !uuid.test(documentId)) return json({ error: "Invalid request." }, 400);

  const publicClient = createClient(endpoint, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await publicClient.auth.getUser(bearer);
  if (authError || !authData.user) return json({ error: "Session expired." }, 401);

  const admin = createClient(endpoint, serviceKey, { auth: { persistSession: false } });
  const { data: path, error: permissionError } = await admin.rpc("authorize_case_attachment", {
    target_case: caseId,
    target_document: documentId,
    viewer_id: authData.user.id,
  });
  if (permissionError) return json({ error: "Attachment authorization failed." }, 500);
  if (!path) return json({ error: "Attachment access is restricted or expired." }, 403);
  const { data: signed, error: signError } = await admin.storage.from("documents").createSignedUrl(path, 60);
  if (signError || !signed?.signedUrl) return json({ error: "Attachment link could not be created." }, 500);
  return json({ url: signed.signedUrl, expiresInSeconds: 60 }, 200);
});
