const LOG_REGEX = /\[\s*(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})\s*\]\s*\((\w+)\)\s*(.*)/;
const DAMAGE_AMOUNT = /<b>(\d+)<\/b>/;
const NPC_PATTERNS = /shambler|ostler|wright|drone|feral|rogue|sentry|guardian|luthier/i;

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function parseLogLine(line) {
  const match = line.match(LOG_REGEX);
  if (!match) return null;

  const [, timestamp, type, rawMessage] = match;
  const message = rawMessage.trim();
  const cleanMessage = stripHtml(message);

  if (type === 'combat') {
    if (message.includes('0xffcc0000')) {
      const amountMatch = message.match(DAMAGE_AMOUNT);
      const names = [...message.matchAll(/<b><color=0xffffffff>([^<]+)<\/b>/g)];
      const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
      const attacker = names.length > 0 ? names[0][1] : 'Unknown';
      const hitType = cleanMessage.split('-').pop().trim();
      const isPlayer = !NPC_PATTERNS.test(attacker);

      return {
        type: 'combat_incoming',
        severity: isPlayer ? 'critical' : 'warning',
        timestamp, amount, attacker, hitType, isPlayer,
        message: isPlayer
          ? `PLAYER ATTACK: ${attacker} hit you for ${amount} (${hitType})`
          : `NPC hit: ${attacker} dealt ${amount} damage (${hitType})`,
        raw: cleanMessage
      };
    }

    if (message.includes('0xff00ffff')) {
      const amountMatch = message.match(DAMAGE_AMOUNT);
      const names = [...message.matchAll(/<b><color=0xffffffff>([^<]+)<\/b>/g)];
      const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
      const target = names.length > 0 ? names[0][1] : 'Unknown';
      const parts = cleanMessage.split(' - ');
      const weapon = parts.length > 1 ? parts[parts.length - 2] : 'Unknown weapon';
      const hitType = parts.length > 0 ? parts[parts.length - 1] : '';

      return {
        type: 'combat_outgoing',
        severity: 'info',
        timestamp, amount, target, weapon, hitType,
        message: `You fired: ${amount} dmg to ${target} with ${weapon} (${hitType})`,
        raw: cleanMessage
      };
    }

    if (message.toLowerCase().includes('misses you')) {
      const attacker = message.replace('misses you completely', '').trim();
      return {
        type: 'combat_miss',
        severity: 'info',
        timestamp, attacker,
        message: `${attacker} missed you`,
        raw: cleanMessage
      };
    }
  }

  if (type === 'notify') {
    if (/turret/i.test(message)) {
      return {
        type: 'turret_notify',
        severity: 'info',
        timestamp,
        message: `Turret: ${cleanMessage}`,
        raw: cleanMessage
      };
    }
    if (/hull|armor|shield|structure|repairer/i.test(message)) {
      return {
        type: 'structure_notify',
        severity: 'warning',
        timestamp,
        message: `Structure alert: ${cleanMessage}`,
        raw: cleanMessage
      };
    }
    if (/aggression/i.test(message)) {
      return {
        type: 'aggression',
        severity: 'critical',
        timestamp,
        message: `AGGRESSION DETECTED: ${cleanMessage}`,
        raw: cleanMessage
      };
    }
  }

  return null;
}
