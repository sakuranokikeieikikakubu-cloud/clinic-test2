// Syncs the shared header, footer, nav-toggle script, structured data, and
// the floating side menu into every page. Run `node build.js` after editing
// files in partials/, then verify pages in the browser as usual before
// committing.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PARTIALS_DIR = path.join(ROOT, 'partials');

function readPartial(name) {
  return fs.readFileSync(path.join(PARTIALS_DIR, name), 'utf8');
}

// Normalize a partial's LF line endings to match the target file's style.
function matchLineEndings(partial, targetHtml) {
  const usesCRLF = targetHtml.includes('\r\n');
  const normalized = partial.replace(/\r\n/g, '\n');
  return usesCRLF ? normalized.replace(/\n/g, '\r\n') : normalized;
}

// Replace [startMark ... endMark], where endMark itself IS included in the
// replaced region. Use when `replacement` already contains its own endMark
// (e.g. the header partial ends with "</header>").
function replaceInclusive(html, startMark, endMark, replacement, label, file) {
  const startIdx = html.indexOf(startMark);
  if (startIdx === -1) {
    console.warn(`  [skip] ${label}: start marker not found in ${file}`);
    return html;
  }
  const endIdx = html.indexOf(endMark, startIdx);
  if (endIdx === -1) {
    console.warn(`  [skip] ${label}: end marker not found in ${file}`);
    return html;
  }
  const endOfRegion = endIdx + endMark.length;
  return html.slice(0, startIdx) + replacement + html.slice(endOfRegion);
}

// Replace [startMark ... endMark), where endMark is NOT included/consumed —
// it stays untouched right after the replacement. Use when anchoring on a
// following tag that isn't part of this partial (e.g. footer ends, then
// "<script>" begins).
function replaceUpTo(html, startMark, endMark, replacement, label, file) {
  const startIdx = html.indexOf(startMark);
  if (startIdx === -1) {
    console.warn(`  [skip] ${label}: start marker not found in ${file}`);
    return html;
  }
  const endIdx = html.indexOf(endMark, startIdx);
  if (endIdx === -1) {
    console.warn(`  [skip] ${label}: end marker not found in ${file}`);
    return html;
  }
  return html.slice(0, startIdx) + replacement + html.slice(endIdx);
}

function syncNavScript(html, navScriptPartial, file) {
  const scriptTagIdx = html.indexOf('<script>');
  if (scriptTagIdx === -1) {
    console.warn(`  [skip] nav-script: no <script> tag found in ${file}`);
    return html;
  }
  const iifeStart = html.indexOf('(function(){', scriptTagIdx);
  if (iifeStart === -1) {
    console.warn(`  [skip] nav-script: no IIFE found in ${file}`);
    return html;
  }
  // Back up to the start of the line so we replace (and correctly
  // reinstate) the leading indentation too, instead of duplicating it.
  const lineStart = html.lastIndexOf('\n', iifeStart) + 1;

  const closeMark = '})();';
  const closeIdx = html.indexOf(closeMark, iifeStart);
  if (closeIdx === -1) {
    console.warn(`  [skip] nav-script: closing "})();" not found in ${file}`);
    return html;
  }
  const endOfRegion = closeIdx + closeMark.length;

  return html.slice(0, lineStart) + navScriptPartial + html.slice(endOfRegion);
}

// Sync the shared structured-data (JSON-LD) block into <head>. If the
// block already exists (marked by the structured-data:start/end comments),
// replace it in place. Otherwise, insert it right after the shared
// stylesheet link so it lands inside <head> on every page.
function syncStructuredData(html, structuredDataPartial, file) {
  const startMark = '<!-- structured-data:start -->';
  const endMark = '<!-- structured-data:end -->';

  const startIdx = html.indexOf(startMark);
  if (startIdx !== -1) {
    const endIdx = html.indexOf(endMark, startIdx);
    if (endIdx === -1) {
      console.warn(`  [skip] structured-data: end marker not found in ${file}`);
      return html;
    }
    let endOfRegion = endIdx + endMark.length;
    // Consume any line breaks directly after the old block so re-running
    // this doesn't accumulate an extra blank line each time (the partial
    // itself already supplies exactly one trailing newline).
    while (html[endOfRegion] === '\n' || html[endOfRegion] === '\r') {
      endOfRegion++;
    }
    return html.slice(0, startIdx) + structuredDataPartial + html.slice(endOfRegion);
  }

  const anchor = '<link rel="stylesheet" href="style.css">';
  const anchorIdx = html.indexOf(anchor);
  if (anchorIdx === -1) {
    console.warn(`  [skip] structured-data: anchor not found in ${file}`);
    return html;
  }
  const afterAnchor = anchorIdx + anchor.length;
  const lineEndIdx = html.indexOf('\n', afterAnchor);
  const insertAt = lineEndIdx === -1 ? afterAnchor : lineEndIdx + 1;
  return html.slice(0, insertAt) + structuredDataPartial + html.slice(insertAt);
}

// Sync the shared side floating menu (WEB予約 / LINE / カウベルキッズ / 電話)
// right after </header>. Same insert-or-replace pattern as
// syncStructuredData: replace the marked block if it already exists,
// otherwise insert it anchored right after the header's closing tag.
function syncSideFab(html, sideFabPartial, file) {
  const startMark = '<!-- side-fab:start -->';
  const endMark = '<!-- side-fab:end -->';

  const startIdx = html.indexOf(startMark);
  if (startIdx !== -1) {
    const endIdx = html.indexOf(endMark, startIdx);
    if (endIdx === -1) {
      console.warn(`  [skip] side-fab: end marker not found in ${file}`);
      return html;
    }
    let endOfRegion = endIdx + endMark.length;
    while (html[endOfRegion] === '\n' || html[endOfRegion] === '\r') {
      endOfRegion++;
    }
    return html.slice(0, startIdx) + sideFabPartial + html.slice(endOfRegion);
  }

  const anchor = '</header>';
  const anchorIdx = html.indexOf(anchor);
  if (anchorIdx === -1) {
    console.warn(`  [skip] side-fab: anchor not found in ${file}`);
    return html;
  }
  const afterAnchor = anchorIdx + anchor.length;
  const lineEndIdx = html.indexOf('\n', afterAnchor);
  const insertAt = lineEndIdx === -1 ? afterAnchor : lineEndIdx + 1;
  return html.slice(0, insertAt) + sideFabPartial + html.slice(insertAt);
}

// Sync the top page's news list (date/title/link for every entry) from all
// <article class="news-entry"> blocks in news.html, so news.html stays the
// single source of truth for news content: editing news.html and running
// `node build.js` keeps index.html's list in sync automatically instead of
// requiring every headline to be typed in twice. news.html itself always
// shows every entry; index.html shows every entry too, but CSS
// (`.news-list .news-item:nth-child(n+4)` in style.css) hides the 4th one
// onward, so only the latest 3 are visible on the top page.
function syncNewsList(html, newsHtml, file) {
  if (file !== 'index.html') return html;

  const articleRegex =
    /<article class="news-entry" id="([^"]+)">[\s\S]*?<h2>([\s\S]*?)<\/h2>[\s\S]*?<p class="news-date">([\s\S]*?)<\/p>/g;
  const items = [];
  let match;
  while ((match = articleRegex.exec(newsHtml)) !== null) {
    const [, id, title, dateLabel] = match;
    // news-date is like "📅 2026.07.27" — strip the leading emoji/whitespace.
    const date = dateLabel.replace(/^[^\d]*/, '').trim();
    items.push({ id, title, date });
  }
  if (items.length === 0) {
    console.warn(`  [skip] news-list: no <article class="news-entry"> found in news.html`);
    return html;
  }

  const startMark = '<!-- news-list:start -->';
  const endMark = '<!-- news-list:end -->';
  const startIdx = html.indexOf(startMark);
  if (startIdx === -1) {
    console.warn(`  [skip] news-list: start marker not found in ${file}`);
    return html;
  }
  const endIdx = html.indexOf(endMark, startIdx);
  if (endIdx === -1) {
    console.warn(`  [skip] news-list: end marker not found in ${file}`);
    return html;
  }
  const endOfRegion = endIdx + endMark.length;

  const indent = '      ';
  const itemLines = items
    .map((item) => `${indent}  <div class="news-item"><time>${item.date}</time><a href="news.html#${item.id}">${item.title}</a></div>`)
    .join('\n');
  const replacement =
    `${startMark}\n${indent}<div class="news-list">\n${itemLines}\n${indent}</div>\n${indent}${endMark}`;
  return html.slice(0, startIdx) + replacement + html.slice(endOfRegion);
}

function main() {
  const headerPartial = readPartial('header.html');
  const footerPartial = readPartial('footer.html');
  const navScriptPartial = readPartial('nav-script.js');
  const structuredDataPartial = readPartial('structured-data.html');
  const sideFabPartial = readPartial('side-fab.html');
  const newsHtml = fs.readFileSync(path.join(ROOT, 'news.html'), 'utf8');

  // admin-*.html pages (投稿管理画面) are standalone tools with their own
  // markup and inline script — they don't include the shared
  // header/footer/side-fab/structured-data/nav-toggle blocks, so they're
  // excluded from partial syncing.
  const targetFiles = fs
    .readdirSync(ROOT)
    .filter((f) => f.toLowerCase().endsWith('.html'))
    .filter((f) => !f.toLowerCase().startsWith('admin-'));

  let changedCount = 0;

  for (const file of targetFiles) {
    const filePath = path.join(ROOT, file);
    const original = fs.readFileSync(filePath, 'utf8');

    let header = matchLineEndings(headerPartial, original);
    // The header partial's clinic-name element is an <h1> for SEO, but only
    // the top page should have it as the page's h1 — every other page has
    // its own page-specific h1 (e.g. "医師紹介"), so there the logo element
    // is downgraded to a <p> to keep exactly one h1 per page.
    if (file !== 'index.html') {
      header = header
        .replace('<h1 class="logo-text">', '<p class="logo-text">')
        .replace('</h1>', '</p>');
    }
    const footer = matchLineEndings(footerPartial, original);
    const navScript = matchLineEndings(navScriptPartial, original);
    const structuredData = matchLineEndings(structuredDataPartial, original);
    const sideFab = matchLineEndings(sideFabPartial, original);
    const nl = original.includes('\r\n') ? '\r\n' : '\n';

    let updated = original;
    updated = syncStructuredData(updated, structuredData, file);
    updated = replaceInclusive(updated, '<header class="site-header">', '</header>', header, 'header', file);
    updated = syncSideFab(updated, sideFab, file);
    updated = replaceUpTo(updated, '<footer id="footer">', '<script>', footer + nl + nl, 'footer', file);
    updated = syncNavScript(updated, navScript, file);
    updated = syncNewsList(updated, newsHtml, file);

    if (updated !== original) {
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log(`updated: ${file}`);
      changedCount++;
    } else {
      console.log(`unchanged: ${file}`);
    }
  }

  console.log(`\nDone. ${changedCount}/${targetFiles.length} file(s) updated.`);
}

main();
