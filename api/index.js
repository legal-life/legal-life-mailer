// メール送信エンドポイント (POST /)
// Cloudflare Workers + MailChannels から Vercel Functions + Resend に移行
import { preflight, buildSubject, buildHTML } from "./_lib.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;

  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { type, to_email, to_name, otp_code, expiry_minutes, purpose } = body;
  if (!to_email || !type) return res.status(400).json({ error: "Missing fields" });

  // Resend で送信 (FROM_EMAIL は Resend で認証済みドメインのアドレスであること)
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `legal&life <${process.env.FROM_EMAIL}>`,
      to: [to_email],
      subject: buildSubject(type, purpose),
      html: buildHTML(type, { to_name, otp_code, expiry_minutes, purpose }),
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    console.error("Resend error:", errText);
    return res.status(500).json({ error: "Mail delivery failed", detail: errText });
  }
  return res.status(200).json({ ok: true });
}
