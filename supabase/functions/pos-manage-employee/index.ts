// pos-manage-employee
// Adds or deletes a pos_employees row after verifying the admin_pin
// server-side. Replaces the direct anon-key insert/delete on pos_employees
// that admin.html/cashier.html used to do (now blocked by RLS).

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

interface Payload {
  admin_pin?: string;
  action?: "add" | "delete";
  payload?: {
    name?: string;
    pin?: string;
    is_admin?: boolean;
    id?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const admin_pin = String(body.admin_pin ?? "").trim();
  const action = body.action;
  const payload = body.payload || {};

  if (!admin_pin || (action !== "add" && action !== "delete")) {
    return jsonResponse({ error: "admin_pin and a valid action are required" }, 400);
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, getServiceRoleKey());

  const { data: adminMatch, error: adminErr } = await supabaseAdmin
    .from("pos_employees")
    .select("id")
    .eq("is_admin", true)
    .eq("pin", admin_pin)
    .maybeSingle();

  if (adminErr) {
    console.error(adminErr);
    return jsonResponse({ error: "Verification failed" }, 500);
  }
  if (!adminMatch) {
    return jsonResponse({ error: "PIN غلط — لازم PIN أدمن" }, 401);
  }

  if (action === "add") {
    const name = String(payload.name ?? "").trim();
    const pin = String(payload.pin ?? "").trim();
    const is_admin = !!payload.is_admin;
    if (!name || !pin) {
      return jsonResponse({ error: "لازم اسم و PIN" }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("pos_employees")
      .insert({ name, pin, is_admin })
      .select("id, name, is_admin")
      .single();

    if (error) {
      console.error(error);
      return jsonResponse({ error: "حصل خطأ في الإضافة" }, 500);
    }
    return jsonResponse({ employee: data });
  }

  // action === "delete"
  const id = Number(payload.id);
  if (!id) return jsonResponse({ error: "id is required" }, 400);

  const { error: delError } = await supabaseAdmin.from("pos_employees").delete().eq("id", id);

  if (delError) {
    console.error(delError);
    return jsonResponse({ error: "حصل خطأ في الحذف" }, 500);
  }

  return jsonResponse({ ok: true });
});
