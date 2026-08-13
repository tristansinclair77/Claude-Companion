// Web search — three modes:
//   web   → DuckDuckGo HTML search, fetch top pages, return as url-type attachment.
//   image → Openverse API (openly-licensed images, no key required).
//   video → YouTube search page scrape (ytInitialData walk).
// The renderer opens a centered media popup for image/video; the backend also
// returns a short text summary so the companion can talk about what was found.

const https = require('https');
const { URL } = require('url');
const { fetchUrl } = require('./web-fetcher');

const SEARCH_TIMEOUT_MS   = 12000;
const MAX_RESULTS         = 3;
const PER_PAGE_CHAR_LIMIT = 4500;
const TOTAL_CHAR_LIMIT    = 14500;

/**
 * @param {string} input          A search query, keyword phrase, or a URL.
 * @param {object} [opts]
 * @param {'web'|'image'|'video'} [opts.mode='web']
 * @param {string} [opts.site]    Explicit host restriction (e.g. 'rule34video.com').
 *                                Takes precedence over any `site:` operator in `input`.
 * @returns {Promise<object>} attachment-shaped object; extra fields per mode
 */
async function searchWeb(input, opts = {}) {
  const trimmed = (input || '').trim();
  if (!trimmed) throw new Error('Empty search input');
  const mode = opts.mode || 'web';
  const site = (opts.site || '').toLowerCase();

  // Short-circuit: input is a direct URL. Route to a per-host embed helper for
  // video hosts (skip search entirely — the user is already pointing at the
  // exact thing they want). For everything else fall back to a plain page fetch.
  if (/^https?:\/\//i.test(trimmed)) {
    const direct = _tryDirectMediaUrl(trimmed, mode);
    if (direct) return direct;
    // Non-media or unknown host: fetch as a page and treat as text context.
    return await htmlSearch(trimmed);
  }

  if (mode === 'image') return await imageSearch(trimmed, { site });
  if (mode === 'video') return await videoSearch(trimmed, { site });
  return await htmlSearch(trimmed, { site });
}

/**
 * Detects a direct link to a known video host and returns a media payload
 * that the popup can render without any search step. Returns null if the URL
 * doesn't match a known pattern.
 */
function _tryDirectMediaUrl(url, mode) {
  // rule34video.com/video/{id}/{slug}
  const r34 = url.match(/^https?:\/\/(?:www\.)?rule34video\.com\/video\/(\d+)\//i);
  if (r34) {
    const id = r34[1];
    return _packVideoResults('(direct link)', [{
      id,
      title:    'rule34video / ' + id,
      url,
      embedUrl: `https://rule34video.com/embed/${id}`,
      thumbUrl: '',
      duration: '',
      channel:  '',
      views:    '',
      host:     'rule34video.com',
    }], 'rule34video.com');
  }

  // youtube.com/watch?v={id}  OR  youtu.be/{id}
  const ytFull = url.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?[^ ]*\bv=([\w-]{6,20})/i);
  const ytShort= url.match(/^https?:\/\/youtu\.be\/([\w-]{6,20})/i);
  const ytId = (ytFull && ytFull[1]) || (ytShort && ytShort[1]);
  if (ytId) {
    return _packVideoResults('(direct link)', [{
      id: ytId,
      title:    'YouTube / ' + ytId,
      url,
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      thumbUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      duration: '',
      channel:  '',
      views:    '',
      host:     'youtube.com',
    }], 'YouTube');
  }

  return null;
}

/* ═══════════════════════ WEB (HTML) SEARCH ══════════════════════════════ */

async function htmlSearch(query, opts = {}) {
  if (/^https?:\/\//i.test(query)) {
    const page = await fetchUrl(query);
    return {
      mediaType: 'text',
      type: 'url',
      name: '🔎 ' + (page.title || query),
      url: page.url,
      content: page.content,
      resultCount: 1,
    };
  }

  // Explicit site restriction wins over any inline site: operator in the query.
  const site = (opts.site || '').toLowerCase();
  if (site && !/\bsite:/i.test(query)) query = `site:${site} ${query}`;

  const results = await ddgHtmlSearch(query, MAX_RESULTS);
  if (!results.length) throw new Error('No search results found');

  const chunks = [`Web search: "${query}"\n`];
  chunks.push(`Top ${results.length} result${results.length === 1 ? '' : 's'}:\n`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    chunks.push(`  ${i + 1}. ${r.title} — ${r.url}`);
    if (r.snippet) chunks.push(`     ${r.snippet}`);
  }
  chunks.push('');

  let totalLen = chunks.join('\n').length;
  for (let i = 0; i < results.length && totalLen < TOTAL_CHAR_LIMIT; i++) {
    const r = results[i];
    let body = '';
    try {
      const page = await fetchUrl(r.url);
      body = page.content || '';
    } catch (err) {
      body = `(Could not fetch this page: ${err.message})`;
    }
    const remaining = TOTAL_CHAR_LIMIT - totalLen;
    const cap = Math.min(PER_PAGE_CHAR_LIMIT, Math.max(500, remaining));
    const excerpt = body.length > cap ? body.slice(0, cap) + '\n[...truncated...]' : body;
    const block =
      `── Result ${i + 1}: ${r.title} ──\n` +
      `URL: ${r.url}\n\n` +
      excerpt +
      `\n\n`;
    chunks.push(block);
    totalLen += block.length;
  }

  return {
    mediaType: 'text',
    type: 'url',
    name: `🔎 Search: "${truncate(query, 40)}"`,
    url: `search://${encodeURIComponent(query)}`,
    content: chunks.join('\n'),
    resultCount: results.length,
  };
}

function ddgHtmlSearch(query, maxResults) {
  // kp=-2 → DuckDuckGo safe-search OFF (no filter).
  const endpoint = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query) + '&kp=-2';
  return fetchHtml(endpoint).then((html) => parseDdgResults(html, maxResults));
}

function parseDdgResults(html, maxResults) {
  const results = [];
  const anchorRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippets = [];
  let sm;
  while ((sm = snippetRe.exec(html)) !== null) snippets.push(cleanText(sm[1]));

  let m, i = 0;
  while ((m = anchorRe.exec(html)) !== null && results.length < maxResults) {
    const url = normalizeDdgUrl(m[1]);
    if (!url) { i++; continue; }
    results.push({ title: cleanText(m[2]) || url, url, snippet: snippets[i] || '' });
    i++;
  }
  return results;
}

function normalizeDdgUrl(href) {
  if (!href) return '';
  let candidate = href;
  if (candidate.startsWith('//')) candidate = 'https:' + candidate;
  try {
    const u = new URL(candidate, 'https://duckduckgo.com');
    if (u.pathname === '/l/' && u.searchParams.has('uddg')) return decodeURIComponent(u.searchParams.get('uddg'));
    if (/^https?:$/.test(u.protocol)) return u.toString();
  } catch { /* pass */ }
  return '';
}

/* ═══════════════════════ IMAGE SEARCH (OPENVERSE) ═══════════════════════ */

/* ═══════════════════════ IMAGE SEARCH — SITE ROUTING ═══════════════════ */

const SITE_IMAGE_HANDLERS = {
  'gelbooru.com':     gelbooruImageSearch,
  'www.gelbooru.com': gelbooruImageSearch,
};

async function imageSearch(query, opts = {}) {
  const host = (opts.site || '').toLowerCase();
  if (host) {
    const handler = SITE_IMAGE_HANDLERS[host];
    if (handler) return await handler(query);
  }
  return await openverseImageSearch(query);
}

async function openverseImageSearch(query) {
  // `mature=true` + `unstable__include_sensitive_results=true` disable
  // Openverse's built-in safe filter. NOTE: Openverse's underlying index is
  // Wikimedia/Flickr openly-licensed content, so genuinely-adult results are
  // rare regardless — this flag is honest but not magic. Adult-image search
  // is handled by dedicated site handlers (gelbooru, etc.).
  const endpoint = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(query) +
                   '&page_size=6&mature=true&unstable__include_sensitive_results=true';
  const json = await fetchJson(endpoint);
  const results = (json.results || []).filter((r) => r.url).map((r) => ({
    title:      r.title || query,
    imageUrl:   r.url,
    thumbUrl:   r.thumbnail || r.url,
    sourceUrl:  r.foreign_landing_url || r.url,
    source:     r.source || r.provider || 'openverse',
    creator:    r.creator || '',
    license:    r.license ? `${r.license} ${r.license_version || ''}`.trim() : '',
    width:      r.width || null,
    height:     r.height || null,
  }));
  if (!results.length) throw new Error(`No image results for "${query}"`);

  const top = results[0];
  const others = results.slice(1, 4);

  const contextLines = [
    `Image search: "${query}"`,
    `Displayed to user: ${top.title}`,
    `  URL: ${top.imageUrl}`,
    `  Source: ${top.source}${top.creator ? ' — ' + top.creator : ''}${top.license ? ' (' + top.license + ')' : ''}`,
    top.width && top.height ? `  Dimensions: ${top.width}×${top.height}` : '',
    '',
    others.length ? 'Also available (not shown by default):' : '',
    ...others.map((r, i) => `  ${i + 2}. ${r.title} — ${r.imageUrl}`),
  ].filter(Boolean);

  return {
    mediaType: 'image',
    type: 'url',
    name: `🖼 Image: "${truncate(query, 40)}"`,
    url: top.imageUrl,
    content: contextLines.join('\n'),
    resultCount: results.length,
    media: {
      query,
      primary: top,
      alternates: others,
    },
  };
}

/**
 * gelbooru.com — imageboard search. Tags are underscore-joined and space-separated
 * with `+` in the URL. We convert the natural query "blonde hair anime" into
 * tag form "blonde_hair+anime". The primary result's full-size URL is fetched
 * from its post page (via og:image); alternates keep their thumbnail URLs only.
 */
async function gelbooruImageSearch(query) {
  const tagQuery = _naturalQueryToBooruTags(query);
  const listUrl = `https://gelbooru.com/index.php?page=post&s=list&tags=${tagQuery}`;
  const html = await fetchHtml(listUrl);

  const thumbs = [];
  const seen = new Set();
  const re = /<a\s+id="p(\d+)"[^>]*href="([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*title="([^"]*)"/gi;
  let m;
  while ((m = re.exec(html)) !== null && thumbs.length < 6) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const postUrl  = cleanText(m[2]).replace(/&amp;/g, '&');
    const thumbUrl = cleanText(m[3]);
    const tags     = cleanText(m[4]);
    thumbs.push({ id, postUrl, thumbUrl, tags });
  }
  if (!thumbs.length) throw new Error(`No gelbooru results for "${query}"`);

  // Resolve the primary's full-size URL from its post page. Gelbooru posts
  // can be .mp4/.webm — an <img> tag can't render those, so we walk down
  // the candidates until we find a still-image extension. Costs one HTTP
  // request per candidate; capped at 4 attempts.
  const STILL_IMG_RE = /\.(jpe?g|png|webp|gif|bmp)(?:\?|#|$)/i;
  let top = null;
  let fullImageUrl = '';
  for (let i = 0; i < Math.min(thumbs.length, 4); i++) {
    const t = thumbs[i];
    try {
      const postHtml = await fetchHtml(t.postUrl);
      const ogM = postHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      const candidate = ogM ? ogM[1] : t.thumbUrl;
      if (STILL_IMG_RE.test(candidate)) {
        top = t;
        fullImageUrl = candidate;
        break;
      }
    } catch { /* try the next thumb */ }
  }
  if (!top) {
    // No still-image candidates in top 4 — fall back to thumbnail of first.
    top = thumbs[0];
    fullImageUrl = top.thumbUrl;
  }

  const primary = {
    title:      _firstTagsAsTitle(top.tags, 4) || `gelbooru / ${top.id}`,
    imageUrl:   fullImageUrl,
    thumbUrl:   top.thumbUrl,
    sourceUrl:  top.postUrl,
    source:     'gelbooru',
    creator:    '',
    license:    '',
    width:      null,
    height:     null,
    tags:       top.tags,
    id:         top.id,
  };
  const alternates = thumbs.slice(1, 4).map((t) => ({
    title:      _firstTagsAsTitle(t.tags, 4) || `gelbooru / ${t.id}`,
    imageUrl:   t.thumbUrl,
    thumbUrl:   t.thumbUrl,
    sourceUrl:  t.postUrl,
    source:     'gelbooru',
    id:         t.id,
    tags:       t.tags,
  }));

  const contextLines = [
    `Image search (gelbooru): "${query}"`,
    `Displayed to user: ${primary.title}`,
    `  Image URL: ${primary.imageUrl}`,
    `  Post page: ${primary.sourceUrl}`,
    primary.tags ? `  Tags: ${truncate(primary.tags, 200)}` : '',
    '',
    alternates.length ? 'Also available:' : '',
    ...alternates.map((r, i) => `  ${i + 2}. ${r.title} — ${r.sourceUrl}`),
  ].filter(Boolean);

  return {
    mediaType: 'image',
    type: 'url',
    name: `🖼 gelbooru: "${truncate(query, 40)}"`,
    url: primary.imageUrl,
    content: contextLines.join('\n'),
    resultCount: thumbs.length,
    media: {
      query,
      source: 'gelbooru',
      primary,
      alternates,
    },
  };
}

/**
 * Convert a natural query into booru tag format:
 *   "blonde hair anime" → "blonde_hair+anime"
 *   "1girl solo blonde_hair" → "1girl+solo+blonde_hair"
 * If the query already has underscores or +'s, respect them; otherwise pair
 * common adjective+noun runs into single tags. This is a light-touch heuristic
 * — for precise tag searches the user can pre-join with underscores themselves.
 */
function _naturalQueryToBooruTags(query) {
  const trimmed = query.trim();
  // Already tag-formatted (has + separators or underscores)?
  if (/\+/.test(trimmed)) return encodeURIComponent(trimmed).replace(/%2B/g, '+');
  // Split by whitespace; leave existing underscore tokens intact.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.map((t) => encodeURIComponent(t)).join('+');
}

function _firstTagsAsTitle(tags, n) {
  if (!tags) return '';
  const arr = tags.split(/\s+/).filter(Boolean).slice(0, n);
  return arr.join(', ');
}

/* ═══════════════════════ VIDEO SEARCH ═══════════════════════════════════ */
//
// Default backend is YouTube. A `site:<host>` operator in the query routes to
// a per-site handler that hits that site's own search page and returns the
// same {primary, alternates} shape so the media popup renders it identically.
//
// Register new hosts by adding an entry to SITE_VIDEO_HANDLERS.

const SITE_VIDEO_HANDLERS = {
  'rule34video.com':     rule34VideoSearch,
  'www.rule34video.com': rule34VideoSearch,
};

async function videoSearch(query, opts = {}) {
  // Explicit site (from dropdown) wins. Fall back to inline site: operator.
  let host = (opts.site || '').toLowerCase();
  let cleaned = query;
  if (!host) {
    const siteMatch = query.match(/\bsite:([\w.-]+)/i);
    if (siteMatch) {
      host = siteMatch[1].toLowerCase();
      cleaned = query.replace(/\bsite:[\w.-]+/gi, '').replace(/\s+/g, ' ').trim();
    }
  } else {
    // Dropdown-selected site — strip any redundant site: operator from the query.
    cleaned = query.replace(/\bsite:[\w.-]+/gi, '').replace(/\s+/g, ' ').trim();
  }
  if (host) {
    const handler = SITE_VIDEO_HANDLERS[host];
    if (handler) return await handler(cleaned || query);
    // Unknown host → fall through to YouTube (we don't silently swap sites).
  }
  return await youtubeVideoSearch(cleaned || query);
}

async function youtubeVideoSearch(query) {
  // No auth = Restricted Mode already OFF by default. We don't add any extra
  // safe-search param — YouTube's URL query interface doesn't support one and
  // Restricted Mode is a cookie-controlled setting we're not sending anyway.
  const endpoint = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
  const html = await fetchHtml(endpoint);
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) throw new Error('YouTube search page did not return results');
  let data;
  try { data = JSON.parse(m[1]); } catch { throw new Error('Could not parse YouTube search response'); }

  const results = [];
  (function walk(o) {
    if (!o || typeof o !== 'object' || results.length >= 6) return;
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      const id = v.videoId;
      if (id) {
        const thumbs = v.thumbnail?.thumbnails || [];
        results.push({
          id,
          title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'Untitled',
          url: `https://www.youtube.com/watch?v=${id}`,
          embedUrl: `https://www.youtube.com/embed/${id}`,
          thumbUrl: thumbs[thumbs.length - 1]?.url || '',
          duration: v.lengthText?.simpleText || '',
          channel:  v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || '',
          views:    v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || '',
          host:     'youtube.com',
        });
      }
    }
    if (Array.isArray(o)) o.forEach(walk);
    else for (const k in o) walk(o[k]);
  })(data);

  if (!results.length) throw new Error(`No video results for "${query}"`);
  return _packVideoResults(query, results, 'YouTube');
}

/**
 * rule34video.com — direct HTML search of /search/{query}/. Embeds via
 * https://rule34video.com/embed/{id}. Returns the same media shape as YouTube.
 */
async function rule34VideoSearch(query) {
  const endpoint = 'https://rule34video.com/search/' + encodeURIComponent(query).replace(/%20/g, '+') + '/';
  const html = await fetchHtml(endpoint);

  // Each video card contains: <a class="th js-open-popup" href="https://rule34video.com/video/{id}/{slug}/" title="{TITLE}">
  // Nearby: <img class="thumb lazy-load" ... data-original="{THUMB_URL}" ...>
  const results = [];
  const seen = new Set();
  const anchorRe = /<a\s+class="th\s+js-open-popup"\s+href="(https:\/\/rule34video\.com\/video\/(\d+)\/[^"]*)"\s+title="([^"]*)"/gi;
  let am;
  while ((am = anchorRe.exec(html)) !== null && results.length < 6) {
    const id = am[2];
    if (seen.has(id)) continue;
    seen.add(id);
    const pageUrl = am[1];
    const title   = cleanText(am[3]) || `rule34video/${id}`;

    // Look for a thumbnail data-original within the next ~1500 chars of markup
    const slice = html.slice(am.index, am.index + 1800);
    const thumbM = slice.match(/data-original="([^"]+)"/);
    const durM   = slice.match(/<div\s+class="time"[^>]*>([^<]+)</) || slice.match(/class="duration"[^>]*>([^<]+)</);
    const upM    = slice.match(/class="btn\s+js-uploader"[^>]*>([^<]+)</);

    results.push({
      id,
      title,
      url:      pageUrl,
      embedUrl: `https://rule34video.com/embed/${id}`,
      thumbUrl: thumbM ? thumbM[1] : '',
      duration: durM ? cleanText(durM[1]) : '',
      channel:  upM ? cleanText(upM[1]) : '',
      views:    '',
      host:     'rule34video.com',
    });
  }

  if (!results.length) throw new Error(`No rule34video results for "${query}"`);
  return _packVideoResults(query, results, 'rule34video.com');
}

function _packVideoResults(query, results, sourceLabel) {
  const top = results[0];
  const others = results.slice(1, 4);
  const contextLines = [
    `Video search (${sourceLabel}): "${query}"`,
    `Displayed to user: ${top.title}`,
    `  URL: ${top.url}`,
    `  ${top.channel ? 'Uploader: ' + top.channel + (top.duration ? ' — ' + top.duration : '') : (top.duration || '')}`,
    top.views ? `  Views: ${top.views}` : '',
    '',
    others.length ? 'Also available (not shown by default):' : '',
    ...others.map((r, i) => `  ${i + 2}. ${r.title} — ${r.url}` + (r.channel ? ` (${r.channel})` : '')),
  ].filter(Boolean);

  return {
    mediaType: 'video',
    type: 'url',
    name: `🎬 Video: "${truncate(query, 40)}"`,
    url: top.url,
    content: contextLines.join('\n'),
    resultCount: results.length,
    media: {
      query,
      source: sourceLabel,
      primary: top,
      alternates: others,
    },
  };
}

/* ═══════════════════════ HTTP HELPERS ═══════════════════════════════════ */

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return reject(new Error('Invalid URL')); }

    const req = https.get(url, {
      timeout: SEARCH_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://${parsedUrl.host}${res.headers.location}`;
        return fetchHtml(next).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        return reject(new Error(`Search HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8', 0, 2_000_000)));
      res.on('error', reject);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Search timed out')); });
    req.on('error', reject);
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: SEARCH_TIMEOUT_MS,
      headers: {
        'User-Agent': 'ClaudeCompanion/0.1',
        'Accept': 'application/json',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        return reject(new Error(`Search HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
        catch (e) { reject(new Error('Bad JSON: ' + e.message)); }
      });
      res.on('error', reject);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Search timed out')); });
    req.on('error', reject);
  });
}

/**
 * Download an image URL to a Buffer. Used by the SAVE action in the media popup.
 * Follows redirects, refuses obviously-non-image content types.
 * @param {string} imageUrl
 * @returns {Promise<{buffer: Buffer, contentType: string, extension: string}>}
 */
async function downloadImage(imageUrl) {
  // Some CDNs (gelbooru, etc.) 302 any request without a same-host Referer.
  // Send one derived from the target URL to defeat hotlink protection.
  let refererHost = '';
  try { const u = new URL(imageUrl); refererHost = `${u.protocol}//${u.host}/`; } catch {}
  const buf = await new Promise((resolve, reject) => {
    const req = https.get(imageUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
        'Accept':     'image/*,*/*;q=0.5',
        ...(refererHost ? { 'Referer': refererHost } : {}),
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        return reject(new Error(`Download HTTP ${res.statusCode}`));
      }
      const ct = (res.headers['content-type'] || '').toLowerCase();
      const chunks = [];
      let total = 0;
      const CAP = 25 * 1024 * 1024;
      res.on('data', (c) => {
        total += c.length;
        if (total > CAP) { res.destroy(); return reject(new Error('Image too large (>25 MB)')); }
        chunks.push(c);
      });
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: ct }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timed out')); });
    req.on('error', reject);
  });

  const extFromCt =
    buf.contentType.includes('jpeg') ? '.jpg' :
    buf.contentType.includes('png')  ? '.png' :
    buf.contentType.includes('webp') ? '.webp' :
    buf.contentType.includes('gif')  ? '.gif' :
    buf.contentType.includes('svg')  ? '.svg' :
    '';
  const extFromUrl = (imageUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)(?:\?|#|$)/i) || [])[1];
  const extension = extFromCt || (extFromUrl ? '.' + extFromUrl.toLowerCase().replace('jpeg', 'jpg') : '.jpg');

  return { buffer: buf.buffer, contentType: buf.contentType, extension };
}

/* ═══════════════════════ TEXT HELPERS ═══════════════════════════════════ */

function cleanText(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g,   (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\s+/g, ' ').trim();
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

module.exports = { searchWeb, downloadImage };
