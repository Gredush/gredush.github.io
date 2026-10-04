// Reads Gredush's WoWProgress character page and saves the key stats to data/wowprogress.json.
// WoWProgress has no public JSON API for characters, so this parses the page text.
import { writeFile, mkdir } from 'node:fs/promises';

const URL = 'https://www.wowprogress.com/character/eu/ragnaros/Gredush';
const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gredush-site-updater)', 'Accept-Language': 'en' } });
if (!res.ok) throw new Error('WoWProgress responded ' + res.status);
const html = await res.text();

const decode = t => t.replace(/&nbsp;/g, ' ').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = decode(html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
  .replace(/<\/(td|th|tr|li|p|div|h\d|table|ul)>|<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ''));
const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
const flat = lines.join(' ');

const num = (re, s) => { const m = re.exec(s); return m ? Number(m[1]) : null; };
const labels = ['Item Level:', 'SimDPS:', 'Ach. Points:', 'PvE Score:'];
const section = label => {
  const i = flat.indexOf(label); if (i < 0) return '';
  const next = labels.map(l => flat.indexOf(l)).filter(p => p > i);
  return flat.slice(i, next.length ? Math.min(...next) : i + 600);
};
const ranks = s => ({ eu: num(/EU:\s*(\d+)/, s), euClass: num(/EU:\s*\d+\s*\(hunter:\s*(\d+)\)/, s), realm: num(/realm:\s*(\d+)/, s), realmClass: num(/realm:\s*\d+\s*\(hunter:\s*(\d+)\)/, s) });

const ilvl = section('Item Level:'), sim = section('SimDPS:'), ach = section('Ach. Points:');
const first = (re) => { const m = re.exec(html); return m ? decode(m[1]).trim() : null; };

const raids = []; let cur = null;
for (const l of lines) {
  const h = /^(.+?) Bosses$/.exec(l);
  if (h) { cur = { name: h[1], mythic: 0, heroic: 0, normal: 0, total: 0 }; raids.push(cur); continue; }
  if (!cur) continue;
  if (/^all events/i.test(l)) { cur = null; continue; }
  const d = /(Mythic|Heroic|Normal)$/.exec(l);
  if (d && l.length > 8) { cur[d[1].toLowerCase()]++; cur.total++; }
}

const out = {
  updated: new Date().toISOString(),
  guild: first(/href="[^"]*\/guild\/eu\/[^"\/]+\/[^"]+"[^>]*>([^<]+)</),
  team: first(/href="[^"]*\/team\/eu\/[^"]+"[^>]*>([^<]+)</),
  itemLevel: { value: num(/Item Level:\s*([\d.]+)/, ilvl), ...ranks(ilvl) },
  simdps: { value: num(/SimDPS:\s*([\d.]+)/, sim), ...ranks(sim) },
  achievements: { value: num(/Ach\. Points:\s*(\d+)/, ach), ...ranks(ach) },
  pveScore: num(/PvE Score:\s*([\d.]+)/, flat),
  raids,
};
console.log(JSON.stringify(out, null, 2));
if (out.itemLevel.value == null || !raids.length) throw new Error('Could not read the WoWProgress page layout; keeping the old data.');
await mkdir('data', { recursive: true });
await writeFile('data/wowprogress.json', JSON.stringify(out));
