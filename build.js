// Syncs the shared header, footer, nav-toggle script, and structured data
// into every page. Run `node build.js` after editing files in partials/,
// then verify pages in the browser as usual before committing.

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

function main() {
  const headerPartial = readPartial('header.html');
  const footerPartial = readPartial('footer.html');
  const navScriptPartial = readPartial('nav-script.js');
  const structuredDataPartial = readPartial('structured-data.html');

  const targetFiles = fs
    .readdirSync(ROOT)
    .filter((f) => f.toLowerCase().endsWith('.html'));

  let changedCount = 0;

  for (const file of targetFiles) {
    const filePath = path.join(ROOT, file);
    const original = fs.readFileSync(filePath, 'utf8');

    const header = matchLineEndings(headerPartial, original);
    const footer = matchLineEndings(footerPartial, original);
    const navScript = matchLineEndings(navScriptPartial, original);
    const structuredData = matchLineEndings(structuredDataPartial, original);
    const nl = original.includes('\r\n') ? '\r\n' : '\n';

    let updated = original;
    updated = syncStructuredData(updated, structuredData, file);
    updated = replaceInclusive(updated, '<header class="site-header">', '</header>', header, 'header', file);
    updated = replaceUpTo(updated, '<footer id="footer">', '<script>', footer + nl + nl, 'footer', file);
    updated = syncNavScript(updated, navScript, file);

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
