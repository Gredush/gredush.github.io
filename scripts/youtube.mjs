// Finds the video to feature from the playlist and saves it to data/youtube.json.
// Tries, in order: YouTube Data API (if the YOUTUBE_API_KEY secret exists), the playlist web page, the RSS feed.
import { writeFile, mkdir } from 'node:fs/promises';

const PLAYLIST = 'PLsuEuHcW7KBKVJB7hGwUPUyFzYYSfCSr2';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const decode = t => t.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function viaApi(key) {
  let token = '', items = [];
  do {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${PLAYLIST}&key=${key}${token ? '&pageToken=' + token : ''}`);
    console.log('API status:', r.status);
    if (!r.ok) throw new Error('YouTube API: ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    items.push(...j.items.map(i => ({ id: i.snippet.resourceId.videoId, title: i.snippet.title, published: i.snippet.publishedAt })));
    token = j.nextPageToken || '';
  } while (token);
  items = items.filter(i => i.title !== 'Private video' && i.title !== 'Deleted video');
  items.sort((a, b) => Date.parse(b.published) - Date.parse(a.published)); // newest added first
  return items[0];
}

async function viaPage() {
  const r = await fetch(`https://www.youtube.com/playlist?list=${PLAYLIST}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1; SOCS=CAI' } });
  console.log('Playlist page status:', r.status);
  if (!r.ok) throw new Error('playlist page ' + r.status);
  const html = await r.text();
  const m = /"playlistVideoRenderer":\{"videoId":"([\w-]{11})"[\s\S]{0,2500}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/.exec(html);
  if (!m) throw new Error('could not find a video in the playlist page');
  return { id: m[1], title: JSON.parse('"' + m[2] + '"') }; // first video = the one the embedded playlist starts with
}

async function viaFeed() {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST}`, { headers: { 'User-Agent': UA } });
  console.log('Feed status:', r.status);
  if (!r.ok) throw new Error('feed ' + r.status);
  const xml = await r.text();
  const e = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => ({
    id: (/<yt:videoId>([^<]+)</.exec(m[1]) || [])[1], title: decode((/<title>([^<]*)</.exec(m[1]) || [, ''])[1]), published: (/<published>([^<]+)</.exec(m[1]) || [])[1],
  })).filter(x => x.id && x.published).sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
  if (!e.length) throw new Error('empty feed');
  return e[0];
}

const methods = [];
if (process.env.YOUTUBE_API_KEY) methods.push(() => viaApi(process.env.YOUTUBE_API_KEY));
methods.push(viaPage, viaFeed);

let video, lastErr;
for (const m of methods) { try { video = await m(); break; } catch (e) { lastErr = e; console.warn('method failed:', e.message); } }
if (!video) throw new Error('All methods failed. Last error: ' + (lastErr && lastErr.message));

const out = { updated: new Date().toISOString(), playlist: PLAYLIST, ...video };
console.log(out);
await mkdir('data', { recursive: true });
await writeFile('data/youtube.json', JSON.stringify(out));
