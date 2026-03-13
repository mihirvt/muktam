import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const PIXEL_ID = "747197838381810"

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function normalizePhone(value: unknown) {
  // keep digits only (Meta recommends E164, but hashing digits-only is acceptable if consistent)
  return String(value ?? "").replace(/[^\d]/g, "")
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function normalizeExternalId(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

async function sha256Hex(value: string) {
  if (!value) return ""
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for")
  if (!xff) return ""
  return xff.split(",")[0]?.trim() ?? ""
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const accessToken = Deno.env.get("FB_ACCESS_TOKEN")
  if (!accessToken) {
    console.error("[meta-capi] Missing FB_ACCESS_TOKEN secret")
    return new Response(
      JSON.stringify({ success: false, error: "Missing FB_ACCESS_TOKEN secret" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }

  const payload = await req.json()
  const meta = payload?.meta ?? payload ?? {}

  const eventName = String(meta.event_name ?? "Lead")
  const eventId = String(meta.event_id ?? meta.eventId ?? crypto.randomUUID())

  const conversionMs = Number(meta.conversion_happened_at ?? Date.now())
  const eventTime = Math.floor(conversionMs / 1000)

  const eventSourceUrl = String(
    meta.page_url ??
      meta.event_source_url ??
      req.headers.get("origin") ??
      "",
  )

  const email = normalizeEmail(meta.email)
  const phone = normalizePhone(meta.phone)
  const fn = normalizeName(meta.first_name)
  const ln = normalizeName(meta.last_name)
  const externalId = normalizeExternalId(meta.external_id)

  const user_data: Record<string, string> = {}

  const [emHash, phHash, fnHash, lnHash, externalIdHash] = await Promise.all([
    sha256Hex(email),
    sha256Hex(phone),
    sha256Hex(fn),
    sha256Hex(ln),
    sha256Hex(externalId),
  ])

  if (emHash) user_data.em = emHash
  if (phHash) user_data.ph = phHash
  if (fnHash) user_data.fn = fnHash
  if (lnHash) user_data.ln = lnHash
  if (externalIdHash) user_data.external_id = externalIdHash

  const fbp = String(meta.fbp ?? "")
  const fbc = String(meta.fbc ?? "")
  if (fbp) user_data.fbp = fbp
  if (fbc) user_data.fbc = fbc

  const ua = String(meta.user_agent ?? req.headers.get("user-agent") ?? "")
  if (ua) user_data.client_user_agent = ua

  const ip = String(meta.client_ip_address ?? getClientIp(req) ?? "")
  if (ip) user_data.client_ip_address = ip

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data,
      },
    ],
  }

  const testEventCode = String(meta.test_event_code ?? "")
  if (testEventCode) body.test_event_code = testEventCode

  console.log("[meta-capi] Sending event", {
    pixel_id: PIXEL_ID,
    event_name: eventName,
    event_id: eventId,
  })

  const resp = await fetch(
    `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )

  const resultText = await resp.text()
  console.log("[meta-capi] Meta response", resp.status, resultText)

  return new Response(
    JSON.stringify({
      success: resp.ok,
      status: resp.status,
      result: resultText,
    }),
    {
      status: resp.ok ? 200 : resp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  )
})