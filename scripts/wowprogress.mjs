// Saves your guild's WoWProgress ranking using WoWProgress's official "json_rank" export
// (https://www.wowprogress.com/post/37_Data_Export). Change GUILD below if you switch guilds.
import { writeFile, mkdir } from 'node:fs/promises';

const GUILD = { region: 'eu', realm: 'twisting-nether', name: 'Disobedient' };
const url = `https://www.wowprogress.com/guild/${GUILD.region}/${GUILD.realm}/${encodeURIComponent(GUILD.name)}/json_rank`;
const res = await fetch(url, { headers: { 'User-Agent': 'gredush-site-updater (personal website; data attributed to wowprogress.com)', Accept: 'application/json' } });
console.log('WoWProgress status:', res.status);
if (!res.ok) throw new Error('WoWProgress responded ' + res.status + ' (it may block requests from GitHub servers)');
const j = await res.json();
console.log(j);
if (!j || !j.world_rank) throw new Error('No ranking returned for this guild.');

const out = {
  updated: new Date().toISOString(), guild: GUILD.name,
  score: Number(j.score), world_rank: +j.world_rank, world_total: +j.world_total,
  area_rank: +j.area_rank, area_total: +j.area_total, realm_rank: +j.realm_rank, realm_total: +j.realm_total,
};
await mkdir('data', { recursive: true });
await writeFile('data/wowprogress.json', JSON.stringify(out));
