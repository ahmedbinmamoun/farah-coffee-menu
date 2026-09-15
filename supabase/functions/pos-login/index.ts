// pos-login
// Verifies a cashier employee's PIN server-side (using the service role key,
// never exposed to the browser) and returns the employee's public data.
// The `pos_employees` table itself is locked down by RLS — this is the only
// place the `pin` column is ever read.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Supabase auto-injects the privileged key into every Edge Function's env.
// Older/most projects call it SUPABASE_SERVICE_ROLE_KEY; newer projects on the
// publishable/secret key system may expose it as SUPABASE_SECRET_KEY instead —
// check both so this doesn't silently break depending on project vintage.
function getServiceRoleKey(): string {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!key) throw new Error("No service role / secret key found in the function environment");
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: { employee_id?: number; pin?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const employee_id = Number(body.employee_id);
  const pin = String(body.pin ?? "").trim();

  if (!employee_id || !pin) {
    return jsonResponse({ error: "employee_id and pin are required" }, 400);
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, getServiceRoleKey());

  const { data: employee, error } = await supabaseAdmin
    .from("pos_employees")
    .select("id, name, is_admin, pin")
    .eq("id", employee_id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return jsonResponse({ error: "Login failed, try again" }, 500);
  }

  if (!employee || String(employee.pin) !== pin) {
    return jsonResponse({ error: "الاسم أو الـ PIN غلط" }, 401);
  }

  return jsonResponse({
    id: employee.id,
    name: employee.name,
    is_admin: employee.is_admin,
  });
});
