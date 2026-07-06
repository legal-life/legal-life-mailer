// 共通ヘルパー: CORS / メール本文生成

// 許可するオリジン (環境変数 ALLOWED_ORIGINS にカンマ区切りで設定。未設定時は既定値)
const DEFAULT_ORIGINS = [
  "https://legal-life.pages.dev",
  "https://legal-life.vercel.app",
];

export function allowedOrigins() {
  const env = process.env.ALLOWED_ORIGINS;
  return env ? env.split(",").map(s => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}

export function corsOrigin(req) {
  const origin = req.headers.origin || "";
  const list = allowedOrigins();
  return list.includes(origin) ? origin : list[0];
}

export function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin(req));
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// OPTIONS / メソッドチェックを共通処理。処理継続なら false を返す
export function preflight(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return true;
  }
  return false;
}

export function buildSubject(type, purpose) {
  if (type === "otp") return `【legal&life】認証コード (${purpose || "本人確認"})`;
  return `【legal&life】${purpose || "重要なお知らせ"}`;
}

export function buildHTML(type, { to_name, otp_code, expiry_minutes, purpose }) {
  const n = esc(to_name || "ユーザー");
  const siteUrl = process.env.SITE_URL || "https://legal-life.pages.dev";
  const siteLabel = siteUrl.replace(/^https?:\/\//, "");
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
    <a href="${siteUrl}" style="color:#00C8E9;">${esc(siteLabel)}</a>
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

export function esc(s) {
  return String(s ?? "").replace(/[<>&"']/g,
    c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"})[c]);
}
