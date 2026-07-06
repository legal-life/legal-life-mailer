# legal-life-mailer

legal&life のメール送信プロキシ (Vercel Functions + Resend)。

Cloudflare Workers + MailChannels から移行しました
(MailChannels の Workers 向け無料送信は提供終了しており、Cloudflare 外では利用不可のため)。

## エンドポイント

- `POST /` … メール送信 (OTP / お知らせ)。Resend の `/emails` API で送信
- `POST /audience` … Resend Audience への登録 / 解除

## 必要な環境変数 (Vercel ダッシュボード → Settings → Environment Variables)

| 変数 | 説明 |
| --- | --- |
| `RESEND_API_KEY` | Resend の API キー |
| `FROM_EMAIL` | 送信元アドレス。**Resend でドメイン認証済み**であること (Gmail アドレス等は不可) |
| `SITE_URL` | メールフッターに載せるサイト URL (例: `https://legal-life.vercel.app`) |
| `ALLOWED_ORIGINS` | CORS 許可オリジン (カンマ区切り。例: `https://legal-life.vercel.app,https://legal-life.pages.dev`) |
| `AUDIENCE_MAINTENANCE` | Resend Audience ID (メンテナンス通知) |
| `AUDIENCE_FEATURE` | Resend Audience ID (新機能通知) |
| `AUDIENCE_NEWSLETTER` | Resend Audience ID (ニュースレター) |

## デプロイ

Vercel でこのリポジトリをインポートするだけです (フレームワーク: Other、ビルド設定不要)。
