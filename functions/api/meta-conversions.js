// Server-side Meta Conversions API endpoint (replaces the dead Supabase function).
// Accepts the existing form payload shape: { facebook: { ... } }
// Also accepts a bare facebook object.

import {
  buildHashedUserData,
  sendMetaEvent,
  corsHeaders,
  jsonResponse,
} from "./_meta.js";

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const fb = body.facebook || body;
    const user = fb.user || {};

    const ip =
      context.request.headers.get("CF-Connecting-IP") ||
      context.request.headers.get("X-Forwarded-For") ||
      "";
    const ua = fb.client_user_agent || context.request.headers.get("User-Agent") || "";

    const user_data = await buildHashedUserData({
      email: user.email,
      phone: user.phone,
      first_name: user.first_name,
      last_name: user.last_name,
      external_id: fb.external_id,
      fbp: fb.fbp,
      fbc: fb.fbc,
      ip,
      user_agent: ua,
    });

    const event = {
      event_name: fb.event_name || "Lead",
      event_time: Math.floor((fb.conversion_happened_at || Date.now()) / 1000),
      action_source: fb.action_source || "website",
      event_id: fb.event_id,
      event_source_url: fb.page_url || undefined,
      user_data,
    };

    const { ok, status, result } = await sendMetaEvent(context.env, event);
    console.log("[meta-conversions]", event.event_name, ip ? "ip:yes" : "ip:no", status, JSON.stringify(result));
    return jsonResponse({ success: ok, status, result }, ok ? 200 : 502);
  } catch (error) {
    console.error("[meta-conversions] error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
