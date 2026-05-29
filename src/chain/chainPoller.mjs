import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { readFileSync as fsRead, writeFileSync as fsWrite, existsSync } from 'fs';

const WORLD_PACKAGE = '0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c';
const POLL_INTERVAL_MS = 30000;
const FUEL_WARN_HOURS = 24;
const FUEL_CRITICAL_HOURS = 6;

let client;
let broadcast;
let pollTimer = null;

let STATE = {
  walletAddress: null,
  characterId: null,
  characterName: null,
  networkNodeId: null,
  structures: [],
  lastKnownStatuses: {},
  lastEventCursor: null,
  lastKillmailCursor: null,
  fuelQuantity: null,
  fuelAlertSent: { warning: false, critical: false },
};

export function getConnectionStatus() {
  return {
    connected: !!STATE.walletAddress,
    walletAddress: STATE.walletAddress,
    characterName: STATE.characterName,
    structureCount: STATE.structures.length,
  };
}

export function startChainPoller(broadcastFn) {
  client = new SuiClient({ url: getFullnodeUrl('testnet') });
  broadcast = broadcastFn;
  console.log('Chain poller ready — waiting for wallet address');

  // Auto-reconnect from saved wallet
  try {
    if (existsSync('./saved-wallet.json')) {
      const saved = JSON.parse(fsRead('./saved-wallet.json', 'utf8'));
      if (saved && saved.walletAddress) {
        console.log('Auto-reconnecting saved wallet:', saved.walletAddress);
        connectWallet(saved.walletAddress, broadcastFn);
      }
    }
  } catch(e) {
    console.log('No saved wallet to reconnect');
  }
}

export function broadcastCurrentState(sendFn) {
  for (const s of STATE.structures) {
    const status = STATE.lastKnownStatuses[s.id];
    if (status === undefined) continue;
    sendFn({ type: 'structure_status_init', severity: 'info', timestamp: new Date().toISOString(), structureId: s.id, structure: s.name, structureType: s.type, status, message: s.name + ' (' + s.type + '): ' + status });
  }
  if (STATE.fuelQuantity !== null) {
    const hrs = Math.round((STATE.fuelQuantity / (1509 / 150)) * 10) / 10;
    const days = Math.floor(hrs / 24);
    const h = Math.floor(hrs % 24);
    const str = days > 0 ? days + 'd ' + h + 'h' : h + 'h';
    sendFn({ type: 'fuel_update', severity: 'info', timestamp: new Date().toISOString(), quantity: STATE.fuelQuantity, hoursRemaining: hrs, message: 'Fuel: ' + STATE.fuelQuantity + ' units — ' + str + ' remaining' });
  }
  if (STATE.characterName) {
    sendFn({ type: 'player_info', characterName: STATE.characterName, walletAddress: STATE.walletAddress, structureCount: STATE.structures.length });
  }
}

export async function connectWallet(walletAddress, broadcastFn) {
  if (broadcastFn) broadcast = broadcastFn;
  console.log('Connecting wallet:', walletAddress);

  try {
    const objects = await client.getOwnedObjects({
      owner: walletAddress,
      options: { showContent: true, showType: true }
    });

    const profileObj = objects.data.find(o => o.data?.type?.includes('::character::PlayerProfile'));
    if (!profileObj) {
      return { success: false, error: 'No EVE Frontier character found for this wallet address.' };
    }

    const characterId = profileObj.data?.content?.fields?.character_id;
    if (!characterId) {
      return { success: false, error: 'Could not read character ID from profile.' };
    }

    const charObj = await client.getObject({ id: characterId, options: { showContent: true } });
    const charFields = charObj.data?.content?.fields || {};
    const characterName = charFields.metadata?.fields?.name || 'Unknown Pilot';

    const ownedByChar = await client.getOwnedObjects({
      owner: characterId,
      options: { showContent: true, showType: true }
    });

    const structures = [];
    let networkNodeId = null;

    for (const obj of ownedByChar.data) {
      const fields = obj.data?.content?.fields || {};
      const authorizedId = fields.authorized_object_id;
      if (!authorizedId) continue;

      const actual = await client.getObject({ id: authorizedId, options: { showContent: true, showType: true } });
      const actualType = actual.data?.type?.split('::').pop() || '';
      const actualFields = actual.data?.content?.fields || {};
      const name = actualFields.metadata?.fields?.name || '';

      if (actualType === 'NetworkNode') {
        networkNodeId = authorizedId;
        continue;
      }

      if (['Turret', 'StorageUnit', 'Assembly'].includes(actualType)) {
        structures.push({
          id: authorizedId,
          type: actualType,
          name: name || actualType + ' ' + (structures.length + 1),
        });
      }
    }

    // Save wallet to disk
    try {
      fsWrite('./saved-wallet.json', JSON.stringify({ walletAddress }));
    } catch(e) {}

    STATE = {
      walletAddress, characterId, characterName, networkNodeId, structures,
      lastKnownStatuses: {}, lastEventCursor: null, lastKillmailCursor: null,
      fuelQuantity: null, fuelAlertSent: { warning: false, critical: false },
    };

    if (pollTimer) clearInterval(pollTimer);
    poll();
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);

    console.log('Wallet connected:', characterName, '|', structures.length, 'structures');
    return { success: true, characterName, structureCount: structures.length };

  } catch (e) {
    console.error('Wallet connect error:', e.message);
    return { success: false, error: 'Failed to connect: ' + e.message };
  }
}

async function poll() {
  if (!STATE.walletAddress) return;
  try {
    await Promise.all([
      checkStructureStatuses(),
      checkFuelLevels(),
      checkAggressionEvents(),
      checkKillmailEvents(),
    ]);
  } catch (e) {
    console.error('Poll error:', e.message);
  }
}

async function checkStructureStatuses() {
  for (const structure of STATE.structures) {
    try {
      const obj = await client.getObject({ id: structure.id, options: { showContent: true } });
      const fields = obj.data?.content?.fields || {};
      const status = fields.status?.fields?.status?.variant || 'UNKNOWN';
      const chainName = fields.metadata?.fields?.name || '';
      const lastStatus = STATE.lastKnownStatuses[structure.id];

      if (chainName && chainName !== structure.name) structure.name = chainName;

      if (lastStatus === undefined) {
        STATE.lastKnownStatuses[structure.id] = status;
        broadcast({ type: 'structure_status_init', severity: 'info', timestamp: new Date().toISOString(), structureId: structure.id, structure: structure.name, structureType: structure.type, status, chainName, message: structure.name + ' (' + structure.type + '): ' + status });
        continue;
      }

      if (status !== lastStatus) {
        STATE.lastKnownStatuses[structure.id] = status;
        if (status === 'NULL' || status === 'UNANCHORED') {
          broadcast({ type: 'structure_unanchored', severity: 'critical', timestamp: new Date().toISOString(), structure: structure.name, structureType: structure.type, message: 'STRUCTURE UNANCHORED: ' + structure.name + ' has been unanchored!' });
        } else if (lastStatus === 'ONLINE' && status === 'OFFLINE') {
          broadcast({ type: 'structure_offline', severity: 'critical', timestamp: new Date().toISOString(), structure: structure.name, structureType: structure.type, message: 'STRUCTURE OFFLINE: ' + structure.name + ' went offline unexpectedly!' });
        } else if (status === 'ONLINE') {
          broadcast({ type: 'structure_online', severity: 'info', timestamp: new Date().toISOString(), structure: structure.name, structureType: structure.type, message: structure.name + ' is back online' });
        }
      }
    } catch (e) {
      console.error('Error checking ' + structure.name + ':', e.message);
    }
  }
}

async function checkFuelLevels() {
  if (!STATE.networkNodeId) return;
  try {
    const obj = await client.getObject({ id: STATE.networkNodeId, options: { showContent: true } });
    const fields = obj.data?.content?.fields || {};
    const fuel = fields.fuel?.fields || {};
    const quantity = parseInt(fuel.quantity || 0);
    const isBurning = fuel.is_burning;
    if (!isBurning) return;

    const unitsPerHour = 1509 / 150;
    const hoursRemaining = quantity / unitsPerHour;
    const days = Math.floor(hoursRemaining / 24);
    const hrs = Math.floor(hoursRemaining % 24);
    const str = days > 0 ? days + 'd ' + hrs + 'h' : hrs + 'h';

    broadcast({ type: 'fuel_update', severity: 'info', timestamp: new Date().toISOString(), quantity, hoursRemaining: Math.round(hoursRemaining * 10) / 10, message: 'Fuel: ' + quantity + ' units — ' + str + ' remaining' });

    if (hoursRemaining <= FUEL_CRITICAL_HOURS && !STATE.fuelAlertSent.critical) {
      STATE.fuelAlertSent.critical = true;
      broadcast({ type: 'fuel_critical', severity: 'critical', timestamp: new Date().toISOString(), quantity, hoursRemaining: Math.round(hoursRemaining), message: 'FUEL CRITICAL: Only ' + str + ' of fuel left!' });
    }
    if (hoursRemaining <= FUEL_WARN_HOURS && !STATE.fuelAlertSent.warning) {
      STATE.fuelAlertSent.warning = true;
      broadcast({ type: 'fuel_warning', severity: 'warning', timestamp: new Date().toISOString(), quantity, hoursRemaining: Math.round(hoursRemaining), message: 'FUEL WARNING: ' + str + ' of fuel remaining — refuel soon!' });
    }
    if (hoursRemaining > FUEL_WARN_HOURS) STATE.fuelAlertSent = { warning: false, critical: false };

    STATE.fuelQuantity = quantity;
  } catch (e) {
    console.error('Fuel check error:', e.message);
  }
}

async function checkAggressionEvents() {
  try {
    const result = await client.queryEvents({ query: { MoveEventType: WORLD_PACKAGE + '::turret::AggressionEvent' }, cursor: STATE.lastEventCursor, limit: 50, order: 'ascending' });
    if (!result.data.length) return;
    STATE.lastEventCursor = result.nextCursor;
    const ourIds = new Set(STATE.structures.filter(s => s.type === 'Turret').map(s => s.id));
    for (const event of result.data) {
      const json = event.parsedJson || {};
      const turretId = json.turret_id || json.assembly_id;
      if (!ourIds.has(turretId)) continue;
      const turret = STATE.structures.find(s => s.id === turretId);
      const attacker = json.character_name || json.attacker || 'Unknown pilot';
      broadcast({ type: 'turret_fired', severity: 'critical', timestamp: new Date().toISOString(), turret: turret?.name || 'Turret', attacker, message: 'BASE TURRET FIRED: ' + (turret?.name || 'Turret') + ' engaged ' + attacker + '!' });
    }
  } catch (e) {
    console.error('Aggression check error:', e.message);
  }
}

async function checkKillmailEvents() {
  try {
    const result = await client.queryEvents({ query: { MoveEventType: WORLD_PACKAGE + '::killmail::KillMailEvent' }, cursor: STATE.lastKillmailCursor, limit: 20, order: 'ascending' });
    if (!result.data.length) return;
    STATE.lastKillmailCursor = result.nextCursor;
    const ourIds = new Set(STATE.structures.map(s => s.id));
    for (const event of result.data) {
      const json = event.parsedJson || {};
      const victimId = json.victim_id || json.assembly_id;
      const s = STATE.structures.find(x => x.id === victimId);
      if (!s) continue;
      broadcast({ type: 'structure_destroyed', severity: 'critical', timestamp: new Date().toISOString(), structure: s.name, structureType: s.type, message: 'STRUCTURE DESTROYED: ' + s.name + ' has been destroyed!' });
    }
  } catch (e) {
    console.error('Killmail check error:', e.message);
  }
}
