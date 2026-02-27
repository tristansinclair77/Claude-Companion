// Fetches webpage content and strips it to readable plain text.

const https = require('https');
const http = require('http');
const { URL } = require('url');

const MAX_CONTENT_CHARS = 15000;
const FETCH_TIMEOUT_MS = 10000;

/**
 * Fetches a URL and returns cleaned text content.
 * @param {string} url
 * @returns {Promise<{url, title, content, type: 'url'}>}
 */
async function fetchUrl(url) {
  const rawHtml = await fetchRaw(url);
  const title = extractTitle(rawHtml);
  const content = htmlToText(rawHtml).slice(0, MAX_CONTENT_CHARS);

  return {
    type: 'url',
    url,
    title: title || url,
    content: `Page: ${title || url}\n\n${content}`,
    name: title || url,
  };
}

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch (e) { return reject(new Error('Invalid URL')); }

    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const req = lib.get(url, {
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClaudeCompanion/0.1)',
        'Accept': 'text/html,text/plain',
      },
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchRaw(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8', 0, 500000)));
      res.on('error', reject);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Fetch timed out')); });
    req.on('error', reject);
  });
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

function htmlToText(html) {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Convert block elements to newlines
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|td|th|blockquote)[^>]*>/gi, '\n')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { fetchUrl };
