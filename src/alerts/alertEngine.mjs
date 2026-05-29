import https from 'https';

const COOLDOWN_MS = (parseInt(process.env.ALERT_COOLDOWN_SECONDS) || 10) * 1000;
const lastAlertTime = {};

export function startAlertEngine(broadcast) {
  console.log('Alert engine ready');
}

export function handleAlert(event, broadcast) {
  const now = Date.now();
  const key = `${event.type}_${event.attacker || event.target || 'general'}`;
  if (lastAlertTime[key] && now - lastAlertTime[key] < COOLDOWN_MS) return;
  lastAlertTime[key] = now;
  if (!['critical', 'warning'].includes(event.severity)) return;
  if (process.env.DISCORD_WEBHOOK_URL) sendDiscordAlert(event);
}

function sendDiscordAlert(event) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;
  const color = event.severity === 'critical' ? 0xff0000 : 0xff9900;
  const payload = JSON.stringify({
    embeds: [{
      title: event.severity === 'critical' ? 'BASE UNDER ATTACK' : 'Alert',
      description: event.message,
      color,
      fields: [
        { name: 'Time', value: event.timestamp, inline: true },
        { name: 'Type', value: event.type, inline: true }
      ],
      footer: { text: 'EVE Frontier IDS' }
    }]
  });
  try {
    const url = new URL(webhookUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    });
    req.write(payload);
    req.end();
  } catch (e) {
    console.error('Discord webhook error:', e.message);
  }
}
