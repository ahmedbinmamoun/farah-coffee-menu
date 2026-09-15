// pos-verify-admin-pin
// Used for every sensitive cashier action (void invoice, delete expense,
// cancel an open table/held/takeaway order, open employee management)
// instead of comparing PINs against a client-side copy of `pos_employees`.

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

  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const pin = String(body.pin ?? "").trim();
  if (!pin) return jsonResponse({ is_admin: false });

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, getServiceRoleKey());

  const { data, error } = await supabaseAdmin
    .from("pos_employees")
    .select("id")
    .eq("is_admin", true)
    .eq("pin", pin)
    .maybeSingle();

  if (error) {
    console.error(error);
    return jsonResponse({ error: "Verification failed" }, 500);
  }

  return jsonResponse({ is_admin: !!data });
});
