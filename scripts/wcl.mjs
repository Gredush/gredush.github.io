// Fetches Gredush's Warcraft Logs raid percentiles into data/wcl.json.
// Needs env WCL_CLIENT_ID and WCL_CLIENT_SECRET (Warcraft Logs API v2 client credentials).
import { writeFile, mkdir } from 'node:fs/promises';

const CHAR = { name: 'Gredush', serverSlug: 'ragnaros', serverRegion: 'EU' };
const MIN_EXPANSION_ID = 0;        // raise to hide old expansions
const RAID_DIFFS = new Set([1, 3, 4, 5]); // LFR, Normal, Heroic, Mythic
const { WCL_CLIENT_ID: id, WCL_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) throw new Error('Missing WCL_CLIENT_ID / WCL_CLIENT_SECRET');

const tok = await (await fetch('https://www.warcraftlogs.com/oauth/token', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'grant_type=client_credentials',
})).json();

const gql = async (query) => {
  const r = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
};

const world = await gql(`{ worldData { expansions { id name zones { id name difficulties { id name } encounters { id name } } } } }`);
const c = CHAR, cq = `name:"${c.name}", serverSlug:"${c.serverSlug}", serverRegion:"${c.serverRegion}"`;
const out = { updated: new Date().toISOString(), character: { name: c.name, realm: 'Ragnaros', region: 'EU' }, expansions: [] };

for (const e of world.worldData.expansions.filter(e => e.id >= MIN_EXPANSION_ID)) {
  const zones = [];
  for (const z of e.zones) {
    const diffs = (z.difficulties || []).filter(d => RAID_DIFFS.has(d.id));
    if (!diffs.length || !z.encounters?.length) continue;
    const fields = diffs.map(d => `d${d.id}: zoneRankings(zoneID:${z.id}, difficulty:${d.id}, metric:dps)`).join(' ');
    let rankings = {};
    try {
      const data = await gql(`{ characterData { character(${cq}) { ${fields} } } }`);
      for (const d of diffs) {
        const zr = data.characterData.character?.[`d${d.id}`];
        rankings[d.id] = { rows: (zr?.rankings || []).map(r => ({ id: r.encounter.id, name: r.encounter.name, rankPercent: r.rankPercent, medianPercent: r.medianPercent, totalKills: r.totalKills })) };
      }
    } catch (err) { console.warn('skip', z.name, err.message); }
    zones.push({ id: z.id, name: z.name, difficulties: diffs, encounters: z.encounters, rankings });
    await new Promise(r => setTimeout(r, 300));
  }
  if (zones.length) out.expansions.push({ id: e.id, name: e.name, zones });
}
await mkdir('data', { recursive: true });
await writeFile('data/wcl.json', JSON.stringify(out));
console.log('Wrote data/wcl.json with', out.expansions.length, 'expansions');
