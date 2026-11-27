// Server-side transactional email. No credentials are embedded in the source.
const address = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export function emailConfiguration(env = process.env) {
  try {
    const provider = (env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();
    if (!['brevo', 'resend'].includes(provider)) return null;
    const key = (provider === 'brevo' ? env.BREVO_API_KEY : env.RESEND_API_KEY)?.trim();
    const from = env.EMAIL_FROM?.trim();
    const origin = new URL(env.APP_ORIGIN?.trim() || '');
    const fromName = (env.EMAIL_FROM_NAME || 'Learning Academy').trim();
    if (!key || /[\r\n]/.test(key) || !from || /[\r\n]/.test(from) || !fromName || /[\r\n]/.test(fromName) || origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null;
    if (provider === 'brevo' && !address.test(from)) return null;
    return { provider, key, from, fromName, origin: origin.origin, invitationOrigin: origin.origin };
  } catch { return null; }
}
export async function sendTransactional(message, config, payload, fetcher = globalThis.fetch) {
  const provider = config.provider || 'resend';
  if (!address.test(message.email) || !config.key || !config.from) throw new Error('Configuração de e-mail inválida.');
  let endpoint, headers, body;
  if (provider === 'brevo') {
    endpoint = 'https://api.brevo.com/v3/smtp/email';
    headers = { 'api-key': config.key, accept: 'application/json', 'content-type': 'application/json' };
    body = { sender: { email: config.from, name: config.fromName || 'Learning Academy' }, to: [{ email: message.email }], subject: payload.subject, ...(payload.html ? { htmlContent: payload.html } : { textContent: payload.text }), headers: { IdempotencyKey: message.id } };
  } else if (provider === 'resend') {
    endpoint = 'https://api.resend.com/emails';
    headers = { authorization: 'Bearer ' + config.key, 'content-type': 'application/json', 'idempotency-key': message.id };
    body = { from: config.from, to: [message.email], ...payload };
  } else throw new Error('Provedor de e-mail inválido.');
  const result = await fetcher(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!result.ok) throw new Error('O provedor recusou o envio de e-mail (HTTP ' + result.status + ').');
  // A successful API response is acceptance, not proof of inbox delivery.
  return true;
}
