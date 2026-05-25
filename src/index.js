const ALLOWED_ORIGIN = "https://legal-life.pages.dev";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }});
    }
    if (request.method !== "POST") return corsRes({error:"Method Not Allowed"}, 405);

    const url = new URL(request.url);
    let body;
    try { body = await request.json(); } catch { return corsRes({error:"Invalid JSON"}, 400); }

    // Audience 管理エンドポイント
    if (url.pathname === "/audience") return handleAudience(body, env);

    // メール送信
    const { type, to_email, to_name, otp_code, expiry_minutes, purpose } = body;
    if (!to_email || !type) return corsRes({error:"Missing fields"}, 400);

    // MailChannels で送信（Cloudflare Workers 専用・無料）
    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to_email, name: to_name || "ユーザー" }],
          // DKIM署名なしでも送信可能（pages.devでは省略）
        }],
        from: {
          email: env.FROM_EMAIL,   // 例: your-gmail@gmail.com
          name:  "legal&life",
        },
        subject: buildSubject(type, purpose),
        content: [{
          type: "text/html",
          value: buildHTML(type, { to_name, otp_code, expiry_minutes, purpose }),
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("MailChannels error:", errText);
      return corsRes({ error: "Mail delivery failed", detail: errText }, 500);
    }
    return corsRes({ ok: true });
  },
};

// ── Audience 管理（Resend Broadcasts用・変更なし）────────────
async function handleAudience(body, env) {
  const { action, email, name, audiences } = body;
  if (!email || !action || !audiences?.length) return corsRes({error:"Missing fields"}, 400);
  const MAP = {
    maintenance: env.AUDIENCE_MAINTENANCE,
    feature:     env.AUDIENCE_FEATURE,
    newsletter:  env.AUDIENCE_NEWSLETTER,
  };
  await Promise.allSettled(audiences.map(async key => {
    const id = MAP[key]; if (!id) return;
    if (action === "add") {
      return fetch(`https://api.resend.com/audiences/${id}/contacts`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: name || "", unsubscribed: false }),
      });
    }
    const lr = await fetch(`https://api.resend.com/audiences/${id}/contacts`, {
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}` },
    });
    if (!lr.ok) return;
    const { data } = await lr.json();
    const c = data?.find(x => x.email === email); if (!c) return;
    return fetch(`https://api.resend.com/audiences/${id}/contacts/${c.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}` },
    });
  }));
  return corsRes({ ok: true });
}

// ── ヘルパー ─────────────────────────────────────────────────
function corsRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    },
  });
}

function buildSubject(type, purpose) {
  if (type === "otp") return `【legal&life】認証コード (${purpose || "本人確認"})`;
  return `【legal&life】${purpose || "重要なお知らせ"}`;
}

function buildHTML(type, { to_name, otp_code, expiry_minutes, purpose }) {
  const n = esc(to_name || "ユーザー");
  const header = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 20px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0"
  style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;max-width:520px;width:100%;">
<tr><td style="background:#00C8E9;padding:24px 32px;border-radius:12px 12px 0 0;">
  <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">legal&amp;life</p>
</td></tr>
<tr><td style="padding:32px;">
  <p style="margin:0 0 16px;color:#334155;font-size:15px;">${n} 様</p>`;

  const footer = `
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 20px;">
  <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">
    このメールは legal&amp;life から自動送信されています。<br>
    心当たりがない場合は無視してください。<br>
    <a href="https://legal-life.pages.dev" style="color:#00C8E9;">legal-life.pages.dev</a>
  </p>
</td></tr></table></td></tr></table></body></html>`;

  if (type === "otp") {
    return `${header}
<p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.7;">
  以下の認証コードを入力してください。
</p>
<div style="background:#f0fdff;border:2px solid #00C8E9;border-radius:10px;
            padding:24px;text-align:center;margin-bottom:20px;">
  <span style="font-size:36px;font-weight:700;letter-spacing:14px;
               color:#0f172a;font-family:monospace;">
    ${esc(otp_code || "")}
  </span>
</div>
<p style="margin:0 0 8px;font-size:13px;color:#64748b;">
  ⏱ 有効期限: <strong>${esc(String(expiry_minutes || 5))}分</strong>
</p>
<p style="margin:0;font-size:13px;color:#64748b;">
  用途: ${esc(purpose || "本人確認")}
</p>${footer}`;
  }

  return `${header}
<p style="margin:0;color:#475569;font-size:15px;line-height:1.8;">
  ${esc(purpose || "")}
</p>${footer}`;
}

function esc(s) {
  return String(s ?? "").replace(/[<>&"']/g,
    c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"})[c]);
}
