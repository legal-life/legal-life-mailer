/**
 * Cloudflare Worker: Resend メール送信プロキシ
 * legal&life メール配信バックエンド
 */

const ALLOWED_ORIGIN = "https://legal-life.pages.dev";

export default {
  async fetch(request, env) {
    // CORS プリフライト
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // POST 以外は拒否
    if (request.method !== "POST") {
      return corsResponse({ error: "Method Not Allowed" }, 405);
    }

    // リクエストボディを解析
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse({ error: "Invalid JSON" }, 400);
    }

    const { type, to_email, to_name, otp_code, expiry_minutes, purpose } = body;

    // 必須パラメータチェック
    if (!to_email || !type) {
      return corsResponse({ error: "Missing required fields: to_email, type" }, 400);
    }

    // メールの件名とHTML本文を生成
    const subject = buildSubject(type, purpose);
    const html    = buildHTML(type, { to_name, otp_code, expiry_minutes, purpose });

    // Resend API にリクエスト
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // DNSレコード設定なしの場合は onboarding@resend.dev を使用
        from: "legal&life <onboarding@resend.dev>",
        to:   [to_email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return corsResponse({ error: "Mail delivery failed", detail: errText }, 500);
    }

    return corsResponse({ ok: true });
  },
};

// ─────────────────────────────────────
// CORS レスポンスヘルパー
// ─────────────────────────────────────
function corsResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    },
  });
}

// ─────────────────────────────────────
// 件名生成
// ─────────────────────────────────────
function buildSubject(type, purpose) {
  if (type === "otp") return `【legal&life】認証コード (${purpose || "本人確認"})`;
  return `【legal&life】${purpose || "重要なお知らせ"}`;
}

// ─────────────────────────────────────
// HTML本文生成
// ─────────────────────────────────────
function buildHTML(type, { to_name, otp_code, expiry_minutes, purpose }) {
  const name  = esc(to_name || "ユーザー");
  const base  = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;max-width:480px;width:100%;">
  <!-- ヘッダー -->
  <tr><td style="background:#00C8E9;padding:24px 32px;">
    <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:1px;">legal&life</p>
  </td></tr>
  <!-- 本文 -->
  <tr><td style="padding:32px;">
    <p style="margin:0 0 16px;color:#334155;font-size:15px;">
      ${name} 様
    </p>`;

  const footer = `
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 20px;">
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">
      このメールは legal&life から自動送信されています。<br>
      心当たりがない場合はこのメールを無視してください。<br>
      <a href="https://legal-life.pages.dev" style="color:#00C8E9;text-decoration:none;">legal-life.pages.dev</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  if (type === "otp") {
    return `${base}
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.7;">
      以下の認証コードを入力してください。
    </p>
    <!-- コードボックス -->
    <div style="background:#f0fdff;border:2px solid #00C8E9;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
      <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:14px;color:#0f172a;font-family:monospace;">
        ${esc(otp_code || "")}
      </p>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
      ⏱ 有効期限: <strong>${esc(String(expiry_minutes || 5))}分</strong>
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;">
      用途: ${esc(purpose || "本人確認")}
    </p>
    ${footer}`;
  }

  // 通知メール
  return `${base}
  <p style="margin:0;color:#475569;font-size:15px;line-height:1.8;">
    ${esc(purpose || "")}
  </p>
  ${footer}`;
}

// XSS 対策エスケープ
function esc(s) {
  return String(s ?? "").replace(/[<>&"']/g,
    c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"})[c]);
}