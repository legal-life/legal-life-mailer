// Audience 管理エンドポイント (POST /audience) — Resend Broadcasts 用
import { preflight } from "./_lib.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;

  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { action, email, name, audiences } = body;
  if (!email || !action || !audiences?.length) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const MAP = {
    maintenance: process.env.AUDIENCE_MAINTENANCE,
    feature:     process.env.AUDIENCE_FEATURE,
    newsletter:  process.env.AUDIENCE_NEWSLETTER,
  };
  const KEY = process.env.RESEND_API_KEY;

  await Promise.allSettled(audiences.map(async key => {
    const id = MAP[key]; if (!id) return;
    if (action === "add") {
      return fetch(`https://api.resend.com/audiences/${id}/contacts`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: name || "", unsubscribed: false }),
      });
    }
    const lr = await fetch(`https://api.resend.com/audiences/${id}/contacts`, {
      headers: { "Authorization": `Bearer ${KEY}` },
    });
    if (!lr.ok) return;
    const { data } = await lr.json();
    const c = data?.find(x => x.email === email); if (!c) return;
    return fetch(`https://api.resend.com/audiences/${id}/contacts/${c.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${KEY}` },
    });
  }));

  return res.status(200).json({ ok: true });
}
