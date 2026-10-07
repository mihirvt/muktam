// Shared helpers for Meta Conversions API (Cloudflare Pages Functions).
// This file is not routed (underscore prefix). Move secrets to Cloudflare
// env vars (META_ACCESS_TOKEN, META_PIXEL_ID) when possible.

export const META_PIXEL_ID = "747197838381810";
export const META_API_VERSION = "v21.0";

// Fallback so the integration works before env vars are configured.
// RECOMMENDED: set META_ACCESS_TOKEN in Cloudflare Pages -> Settings -> Environment variables.
const FALLBACK_META_TOKEN = "EAAMZAdsviqNABSihjxr2P6TIjheicLAq8aPkUqZArMZAylo9PVFzFdKZCXVQcFqB2LrwzW5n1DwygqHWIJ1ZCcEwxvSz5SAvtWZB7xmw9ZCWrKxrcJFT1c8QdZCTFOl7nZBYuRQXeTl2st5XEYZAviCLhbH0ZCEJRfXUWqXBm7LjENu4I1JuZC4uF96dc9iZCASSoZABzOUAZDZD";

export function getMetaToken(env) {
  return (env && env.META_ACCESS_TOKEN) || FALLBACK_META_TOKEN;
}

export function getPixelId(env) {
  return (env && env.META_PIXEL_ID) || META_PIXEL_ID;
}

// Signing key for the one-click qualify links. Falls back to the Meta token
// so no extra secret is required.
export function getQualifySecret(env) {
  return (env && env.QUALIFY_SECRET) || getMetaToken(env);
}

// Normalize a phone number to digits + country code (E.164 without "+"),
// defaulting to India (+91) for bare 10-digit numbers.
export function canonicalizePhone(phone) {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits;
}

export async function sha256Hex(value) {
  if (!value) return "";
  const data = new TextEncoder().encode(String(value).trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashIdentifiers(u) {
  return {
    em: await sha256Hex(u.email),
    ph: await sha256Hex(canonicalizePhone(u.phone)),
    fn: await sha256Hex(u.first_name),
    ln: await sha256Hex(u.last_name),
    external_id: await sha256Hex(u.external_id),
  };
}

export async function buildHashedUserData(u) {
  const h = await hashIdentifiers(u);
  const user_data = {};
  if (h.em) user_data.em = [h.em];
  if (h.ph) user_data.ph = [h.ph];
  if (h.fn) user_data.fn = [h.fn];
  if (h.ln) user_data.ln = [h.ln];
  if (h.external_id) user_data.external_id = [h.external_id];
  if (u.fbp) user_data.fbp = u.fbp;
  if (u.fbc) user_data.fbc = u.fbc;
  if (u.ip) user_data.client_ip_address = u.ip;
  if (u.user_agent) user_data.client_user_agent = u.user_agent;
  return user_data;
}

// ---- base64url + HMAC token helpers ----

function bytesToB64url(bytes) {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToB64url(str) {
  return bytesToB64url(new TextEncoder().encode(str));
}

function b64urlToStr(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createQualifyToken(env, payload) {
  const body = strToB64url(JSON.stringify(payload));
  const sig = await hmacHex(getQualifySecret(env), body);
  return body + "." + sig;
}

export async function verifyQualifyToken(env, token) {
  if (!token || token.indexOf(".") === -1) return null;
  const [body, sig] = token.split(".");
  const expected = await hmacHex(getQualifySecret(env), body);
  if (sig !== expected) return null;
  try {
    return JSON.parse(b64urlToStr(body));
  } catch (e) {
    return null;
  }
}

export async function sendMetaEvent(env, event) {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${getPixelId(env)}/events?access_token=${getMetaToken(env)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [event] }),
  });
  let result = {};
  try {
    result = await res.json();
  } catch (e) {
    result = {};
  }
  return { ok: res.ok, status: res.status, result };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
