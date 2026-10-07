// One-click "Qualified Lead" reporter.
// The lead notification email contains a signed link to this endpoint.
// Clicking it fires a Qualified_Lead event to the Meta Conversions API
// so Meta can optimise for high-quality leads instead of junk.

import { sendMetaEvent, verifyQualifyToken } from "./_meta.js";

function htmlPage(title, message, ok = true) {
  const color = ok ? "#16a34a" : "#dc2626";
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
<div style="max-width:420px;width:100%;text-align:center;background:#fff;border-radius:20px;padding:40px 28px;box-shadow:0 10px 40px rgba(15,23,42,.08);border:1px solid #e2e8f0">
<div style="font-size:44px;line-height:1;margin-bottom:16px">${ok ? "&#9989;" : "&#9888;&#65039;"}</div>
<h1 style="margin:0 0 10px;font-size:22px;color:#0f172a">${title}</h1>
<p style="margin:0;color:${color};font-size:14px;line-height:1.6">${message}</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");
  const data = await verifyQualifyToken(context.env, token);

  if (!data) {
    return htmlPage("Invalid or expired link", "This qualify link could not be verified.", false);
  }

  const user_data = {};
  ["em", "ph", "fn", "ln", "external_id"].forEach((k) => {
    if (data[k]) user_data[k] = [data[k]];
  });
  if (data.fbp) user_data.fbp = data.fbp;
  if (data.fbc) user_data.fbc = data.fbc;
  if (data.ip) user_data.client_ip_address = data.ip;
  if (data.ua) user_data.client_user_agent = data.ua;

  const event = {
    event_name: "Qualified_Lead",
    event_time: Math.floor(Date.now() / 1000),
    action_source: "system_generated",
    // Stable id so repeat clicks deduplicate instead of double-counting.
    event_id: (data.eid || "lead") + "_qualified",
    event_source_url: data.url || undefined,
    user_data,
  };

  const { ok, status, result } = await sendMetaEvent(context.env, event);
  console.log("[qualify-lead]", status, JSON.stringify(result));

  if (!ok) {
    const msg = (result && result.error && result.error.message) || "Unknown error from Meta.";
    return htmlPage("Could not record qualification", "Meta API error: " + msg, false);
  }
  return htmlPage("Marked as Qualified", "This lead has been reported to Meta as a high-quality lead.");
}
