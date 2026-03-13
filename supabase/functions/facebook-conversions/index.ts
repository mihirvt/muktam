import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return ""
  return value.replace(/[^\d+]/g, "")
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

async function sha256Hex(value: string) {
  if (!value) return ""
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  // Hardcoded tokens as requested
  const accessToken = "EAAMZAdsviqNABQ0eShhbWQJQtZBZBqaws6eUF5exL5snZBxplsqOdhQXxkjc4SncWESA6P10fme2U6UATJtjMWZCg4sISbpY6raOWHZBzAdiTUKx05saoLkus7uMM43xOb4Q68DngffWL8xQRGqJZBF4tI6pbDpKYMDMtP4SHtxQ96Onj6JrRlULimp7UEPvqgJGgZDZD"
  const pixelId = "747197838381810"

  const payload = await req.json()

  const rawIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || ""
  const clientIp = rawIp ? rawIp.split(",")[0].trim() : ""

  const eventId = typeof payload?.event_id === "string" ? payload.event_id : ""
  const eventTime = Math.floor(((payload?.conversion_happened_at as number) || Date.now()) / 1000)

  const email = normalizeEmail(payload?.email)
  const phone = normalizePhone(payload?.phone)

  const fb = payload?.facebook || {}
  const fbp = typeof fb?.fbp === "string" ? fb.fbp : ""
  const fbc = typeof fb?.fbc === "string" ? fb.fbc : ""

  const fn = normalizeText(fb?.first_name)
  const ln = normalizeText(fb?.last_name)
  
  const city = normalizeText(fb?.city)
  const state = normalizeText(fb?.state)
  const zip = normalizeText(fb?.zip)
  const country = normalizeText(fb?.country)

  const externalIdRaw = normalizeText(payload?.external_id)

  const user_data: Record<string, unknown> = {
    client_user_agent: typeof payload?.user_agent === "string" ? payload.user_agent : "",
  }

  if (clientIp) user_data.client_ip_address = clientIp
  if (fbp) user_data.fbp = fbp
  if (fbc) user_data.fbc = fbc

  const emHash = await sha256Hex(email)
  if (emHash) user_data.em = [emHash]

  const phHash = await sha256Hex(phone)
  if (phHash) user_data.ph = [phHash]

  const fnHash = await sha256Hex(fn)
  if (fnHash) user_data.fn = [fnHash]

  const lnHash = await sha256Hex(ln)
  if (lnHash) user_data.ln = [lnHash]

  const ctHash = await sha256Hex(city)
  if (ctHash) user_data.ct = [ctHash]

  const stHash = await sha256Hex(state)
  if (stHash) user_data.st = [stHash]

  const zpHash = await sha256Hex(zip)
  if (zpHash) user_data.zp = [zpHash]

  const countryHash = await sha256Hex(country)
  if (countryHash) user_data.country = [countryHash]

  const externalIdHash = await sha256Hex(externalIdRaw)
  if (externalIdHash) user_data.external_id = [externalIdHash]

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: eventTime,
        action_source: "website",
        event_id: eventId || undefined,
        event_source_url: typeof payload?.page_url === "string" ? payload.page_url : undefined,
        user_data,
      },
    ],
  }

  console.log("[facebook-conversions] Sending CAPI event", {
    pixelId,
    hasEventId: Boolean(eventId),
    hasFbp: Boolean(fbp),
    hasFbc: Boolean(fbc),
    hasEmail: Boolean(emHash),
    hasPhone: Boolean(phHash),
  })

  const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const fbText = await fbRes.text()
  console.log("[facebook-conversions] Meta response", fbRes.status, fbText)

  return new Response(JSON.stringify({ ok: fbRes.ok, status: fbRes.status, response: fbText }), {
    status: fbRes.ok ? 200 : fbRes.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})