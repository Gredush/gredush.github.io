// Finds the newest video in the playlist and saves it to data/youtube.json.
import { writeFile, mkdir } from 'node:fs/promises';

const PLAYLIST = 'PLsuEuHcW7KBKVJB7hGwUPUyFzYYSfCSr2';
const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST}`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; gredush-site-updater)', 'Accept-Language': 'en' } });
console.log('YouTube feed status:', res.status);
if (!res.ok) throw new Error('YouTube feed responded ' + res.status);
const xml = await res.text();
const decode = t => t.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => ({
  id: (/<yt:videoId>([^<]+)</.exec(m[1]) || [])[1],
  title: decode((/<title>([^<]*)</.exec(m[1]) || [, ''])[1]),
  published: (/<published>([^<]+)</.exec(m[1]) || [])[1],
})).filter(e => e.id && e.published);
if (!entries.length) throw new Error('No videos found in the playlist feed.');

entries.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
const out = { updated: new Date().toISOString(), playlist: PLAYLIST, ...entries[0] };
console.log(out);
await mkdir('data', { recursive: true });
await writeFile('data/youtube.json', JSON.stringify(out));
