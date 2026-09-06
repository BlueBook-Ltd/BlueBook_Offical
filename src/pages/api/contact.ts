export const prerender = false;

import type { APIRoute } from "astro";
import { Resend } from "resend";

const TO_EMAIL = import.meta.env.CONTACT_TO_EMAIL || "bluebybook@outlook.com";
const FROM_EMAIL = import.meta.env.CONTACT_FROM_EMAIL || "no-reply@bluebook.hk";
const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const {
      name,
      email,
      company,
      phone,
      serviceInterest,
      message,
      consent,
    } = body;

    // ── Validation ──
    if (!name || typeof name !== "string" || !name.trim()) {
      return new Response(JSON.stringify({ success: false, error: "Name is required." }), { status: 400 });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, error: "A valid email address is required." }), { status: 400 });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ success: false, error: "A message is required." }), { status: 400 });
    }
    if (!consent) {
      return new Response(JSON.stringify({ success: false, error: "Consent is required." }), { status: 400 });
    }

    // ── Honeypot check ──
    if (body._hp && body._hp.length > 0) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // ── Build email content ──
    const fields = [
      ["Name", name],
      ["Email", email],
      ["Company", company || "—"],
      ["Phone", phone || "—"],
      ["Service Interest", serviceInterest || "—"],
      ["Message", message],
    ];

    const rows = fields
      .map(([label, value]) => `<strong>${label}:</strong> ${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}`)
      .join("<br>\n");

    const html = `<h2>New Bluebook Contact Enquiry</h2><p>${rows}</p>`;

    // ── Send via Resend ──
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "Email service not configured." }), { status: 500 });
    }

    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: "New Bluebook Contact Enquiry",
      html,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("Contact API error:", err);
    return new Response(JSON.stringify({ success: false, error: "Failed to send message. Please try again or email us directly." }), { status: 500 });
  }
};