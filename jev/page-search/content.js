// Guard against double-injection (tab open before extension loaded → injected once from
// manifest, then again programmatically). Without this, overlay toggles twice and closes.
if (window.__jevSearchLoaded) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_OVERLAY') toggleOverlay();
  });
} else {
  window.__jevSearchLoaded = true;

  let overlayEl = null;
  let chunkMap = [];
  let isSearching = false;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_OVERLAY') toggleOverlay();
  });

  function toggleOverlay() {
    if (!overlayEl) buildOverlay();
    const hidden = overlayEl.classList.contains('jev-hidden');
    if (hidden) {
      overlayEl.classList.remove('jev-hidden');
      overlayEl.querySelector('#jev-input').focus();
    } else {
      closeOverlay();
    }
  }

  function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.add('jev-hidden');
    overlayEl.querySelector('#jev-input').value = '';
    clearResults();
    setStatus('');
  }

  function buildOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.id = 'jev-search-overlay';
    overlayEl.classList.add('jev-hidden');
    overlayEl.innerHTML = `
      <div id="jev-backdrop"></div>
      <div id="jev-modal" role="dialog" aria-label="JEV Page Search">
        <div id="jev-search-row">
          <span id="jev-icon">⌕</span>
          <input id="jev-input" type="text" placeholder="Search this page…" autocomplete="off" spellcheck="false" />
          <button id="jev-btn">Search</button>
        </div>
        <div id="jev-results" role="list"></div>
        <div id="jev-status"></div>
      </div>
    `;

    overlayEl.querySelector('#jev-backdrop').addEventListener('click', closeOverlay);
    overlayEl.querySelector('#jev-btn').addEventListener('click', runSearch);
    overlayEl.querySelector('#jev-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSearch();
      if (e.key === 'Escape') closeOverlay();
      if (e.key === 'ArrowDown') focusResult(0);
    });
    overlayEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOverlay();
    });

    document.body.appendChild(overlayEl);
  }

  async function runSearch() {
    if (isSearching) return;
    const query = overlayEl.querySelector('#jev-input').value.trim();
    if (!query) return;

    const { jevApiKey } = await chrome.storage.sync.get('jevApiKey');
    if (!jevApiKey) {
      setStatus('No API key set — click the extension icon to add your JEV token.');
      return;
    }

    isSearching = true;
    clearResults();
    overlayEl.querySelector('#jev-btn').disabled = true;

    chunkMap = extractChunks();
    if (chunkMap.length === 0) {
      setStatus('No readable content found on this page.');
      isSearching = false;
      overlayEl.querySelector('#jev-btn').disabled = false;
      return;
    }

    setStatus(`Analyzing ${chunkMap.length} sections…`);

    const chunks = chunkMap.map((c, i) => ({
      index: i,
      heading: c.heading,
      text: c.text,
      snippet: c.snippet,
    }));

    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH',
      query,
      chunks,
      apiKey: jevApiKey,
    });

    isSearching = false;
    overlayEl.querySelector('#jev-btn').disabled = false;

    if (response?.error) {
      setStatus(`Error: ${response.error}`);
      return;
    }

    if (!response || response.length === 0) {
      setStatus('No sections found — try a different query.');
      renderWebFallback(query);
      return;
    }

    setStatus('');
    renderResults(response);
  }

  function renderResults(results) {
    const container = overlayEl.querySelector('#jev-results');
    container.innerHTML = '';

    results.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'jev-result';
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.dataset.index = r.index;
      item.innerHTML = `
        <span class="jev-rank">${r.rank}</span>
        <div class="jev-result-text">
          <div class="jev-result-heading">${escapeHtml(r.heading)}</div>
          <div class="jev-result-snippet">${escapeHtml(r.snippet)}</div>
        </div>
      `;
      item.addEventListener('click', () => navigateTo(r.index));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigateTo(r.index);
        if (e.key === 'ArrowDown') focusResult(r.rank);
        if (e.key === 'ArrowUp') {
          if (r.rank === 1) overlayEl.querySelector('#jev-input').focus();
          else focusResult(r.rank - 2);
        }
      });
      container.appendChild(item);
    });
  }

  function renderWebFallback(query) {
    const container = overlayEl.querySelector('#jev-results');
    const item = document.createElement('div');
    item.className = 'jev-fallback';
    item.innerHTML = `Nothing relevant on this page. <a id="jev-web-search" href="#">Search the web →</a>`;
    item.querySelector('#jev-web-search').addEventListener('click', (e) => {
      e.preventDefault();
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    });
    container.appendChild(item);
  }

  function navigateTo(index) {
    const chunk = chunkMap[index];
    if (!chunk?.element) return;
    closeOverlay();
    chunk.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    chunk.element.classList.add('jev-highlight');
    setTimeout(() => chunk.element.classList.remove('jev-highlight'), 2000);
  }

  function focusResult(index) {
    const items = overlayEl.querySelectorAll('.jev-result');
    if (items[index]) items[index].focus();
  }

  function setStatus(msg) {
    overlayEl.querySelector('#jev-status').textContent = msg;
  }

  function clearResults() {
    overlayEl.querySelector('#jev-results').innerHTML = '';
  }

  function extractChunks() {
    const skip = 'nav, footer, aside, [role="navigation"], [role="contentinfo"], script, style, noscript';
    const chunks = [];

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(
      (h) => !h.closest(skip) && h.innerText?.trim().length > 2
    );

    headings.forEach((heading) => {
      let content = '';
      let el = heading.nextElementSibling;
      while (el && !el.matches('h1,h2,h3,h4,h5,h6')) {
        const t = el.innerText?.trim();
        if (t && t.length > 20) content += ' ' + t;
        el = el.nextElementSibling;
      }

      const fullText = (heading.innerText.trim() + ' ' + content).trim();
      if (fullText.length < 30) return;

      chunks.push({
        heading: heading.innerText.trim().substring(0, 80),
        text: fullText.substring(0, 500),
        snippet: content.trim().substring(0, 120) || heading.innerText.trim().substring(0, 120),
        element: heading,
      });
    });

    // Fallback: paragraphs when no meaningful headings
    if (chunks.length < 3) {
      Array.from(document.querySelectorAll('p, li')).forEach((p) => {
        if (p.closest(skip)) return;
        const text = p.innerText?.trim();
        if (!text || text.length < 60) return;
        chunks.push({
          heading: text.substring(0, 70) + '…',
          text: text.substring(0, 500),
          snippet: text.substring(0, 120),
          element: p,
        });
      });
    }

    return chunks.slice(0, 50);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
