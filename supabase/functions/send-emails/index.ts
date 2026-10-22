// Sends the emails waiting in public.email_outbox through an SMTP account (the cafe's Gmail by default).
// The database calls this every 5 minutes while anything is waiting (see 2026-10-22-emails-and-admins.sql).
//
// Secrets to set in Supabase › Edge Functions › Secrets (never in the app's code):
//   SMTP_USER   the Gmail address that sends, e.g. caffepadrino@gmail.com
//   SMTP_PASS   a Google "app password" for that account (not the normal password)
//   APP_URL     the app's address, e.g. https://padrino-caffe.pages.dev
// Optional: SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 465), MAIL_FROM_NAME (default Caffe Padrino),
//           DAILY_LIMIT (default 450, under Gmail's 500 a day).
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const env = (k: string, fallback?: string) => Deno.env.get(k) ?? fallback ?? ''
const PER_RUN = 40

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Plain text in, simple branded HTML out; lines that are links become links.
function html(subject: string, text: string) {
  const body = text.split('\n\n').map(p => `<p style="margin:0 0 16px">${
    p.split('\n').map(l => /^https?:\/\//.test(l) ? `<a href="${escape(l)}" style="color:#8F6B1F">${escape(l)}</a>` : escape(l)).join('<br>')
  }</p>`).join('')
  return `<!doctype html><html><body style="margin:0;background:#FBF6EA;font-family:Georgia,serif;color:#2A1E10">
<div style="max-width:560px;margin:0 auto;padding:24px 20px">
<div style="background:#241A0F;color:#E8C877;padding:14px 18px;font-size:18px;letter-spacing:.12em">CAFFE PADRINO</div>
<div style="background:#fff;border:1px solid #e6dcc4;border-top:0;padding:22px 18px;font-size:16px;line-height:1.5">
<h1 style="font-size:20px;margin:0 0 14px;color:#8F6B1F">${escape(subject.replace(/^Caffe Padrino:\s*/, ''))}</h1>${body}</div>
<p style="font-size:12px;color:#6E5A3A;margin:12px 4px">Caffe Padrino · Paraćin</p></div></body></html>`
}

Deno.serve(async () => {
  const since = new Date(Date.now() - 864e5).toISOString()
  const { count, error: countError } = await db.from('email_outbox').select('id', { count: 'exact', head: true }).gte('sent_at', since)
  if (countError) return Response.json({ error: countError.message }, { status: 500 })
  const budget = Math.min(PER_RUN, Number(env('DAILY_LIMIT', '450')) - (count ?? 0))
  if (budget <= 0) return Response.json({ sent: 0, note: 'daily limit reached' })

  const { data: rows, error } = await db.rpc('claim_emails', { p_limit: budget })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return Response.json({ sent: 0 })

  const mail = nodemailer.createTransport({
    host: env('SMTP_HOST', 'smtp.gmail.com'), port: Number(env('SMTP_PORT', '465')), secure: true,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  })
  const appUrl = env('APP_URL').replace(/\/$/, '')
  let sent = 0
  for (const r of rows) {
    const text = r.body.replaceAll('{{APP_URL}}', appUrl)
    try {
      await mail.sendMail({ from: { name: env('MAIL_FROM_NAME', 'Caffe Padrino'), address: env('SMTP_USER') }, to: r.to_email, subject: r.subject, text, html: html(r.subject, text) })
      await db.from('email_outbox').update({ sent_at: new Date().toISOString(), last_error: null }).eq('id', r.id)
      sent++
    } catch (e) {
      await db.from('email_outbox').update({ last_error: String((e as Error).message ?? e).slice(0, 500) }).eq('id', r.id)
    }
  }
  return Response.json({ sent, failed: rows.length - sent })
})
