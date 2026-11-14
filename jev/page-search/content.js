if (window.__jevSearchLoaded) {
  // Already initialised — do nothing. The existing listener is still active.
} else {
  window.__jevSearchLoaded = true;

  let drawerEl = null;
  let chunkMap = [];   // { heading, text, snippet, element, level }
  let isSearching = false;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_OVERLAY') toggleDrawer();
  });

  // ── Open / close ──────────────────────────────────────────────────────────

  function toggleDrawer() {
    if (!drawerEl) buildDrawer();
    drawerEl.classList.contains('jev-open') ? closeDrawer() : openDrawer();
  }

  function openDrawer() {
    chunkMap = extractChunks();
    drawerEl.classList.add('jev-open');
    drawerEl.querySelector('#jev-input').focus();
    showPageStructure();
  }

  function closeDrawer() {
    drawerEl.classList.remove('jev-open');
    drawerEl.querySelector('#jev-input').value = '';
    isSearching = false;
    setPanel(null);
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────

  function buildDrawer() {
    drawerEl = document.createElement('div');
    drawerEl.id = 'jev-drawer';
    drawerEl.innerHTML = `
      <div id="jev-results-panel">
        <div id="jev-panel-label"></div>
        <div id="jev-results" role="list"></div>
        <div id="jev-status"></div>
      </div>
      <div id="jev-bar">
        <span id="jev-bar-icon">⌕</span>
        <input id="jev-input" type="text" placeholder="Search this page…" autocomplete="off" spellcheck="false" />
        <button id="jev-search-btn">Search</button>
        <button id="jev-close-btn" title="Close (Esc)">✕</button>
      </div>
    `;

    const input = drawerEl.querySelector('#jev-input');
    const searchBtn = drawerEl.querySelector('#jev-search-btn');
    const closeBtn = drawerEl.querySelector('#jev-close-btn');

    input.addEventListener('input', onInputChange);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runJevSearch();
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'ArrowDown') { e.preventDefault(); focusResult(0); }
    });

    searchBtn.addEventListener('click', runJevSearch);
    closeBtn.addEventListener('click', closeDrawer);

    drawerEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    document.body.appendChild(drawerEl);
  }

  // ── Input change — live filter while typing ───────────────────────────────

  function onInputChange() {
    if (isSearching) return;
    const q = drawerEl.querySelector('#jev-input').value.trim();
    if (!q) {
      showPageStructure();
    } else {
      showFilteredStructure(q);
    }
  }

  // ── Page structure (empty state) ─────────────────────────────────────────

  function showPageStructure() {
    const headings = chunkMap.filter((c) => c.isHeading);

    if (headings.length === 0) {
      setPanel('On this page', '', 'No sections found — type a query to search.');
      return;
    }

    const items = headings
      .map((c, i) => sectionItem(c.heading, chunkMap.indexOf(c)))
      .join('');

    setPanel('On this page', items, '');
    bindSectionClicks();
  }

  // ── Filtered structure (typing) ───────────────────────────────────────────

  function showFilteredStructure(query) {
    const q = query.toLowerCase();
    const matches = chunkMap.filter(
      (c) => c.isHeading && c.heading.toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      setPanel(
        `No sections match "${query}"`,
        '',
        'Press Search or Enter to run a semantic search.'
      );
      return;
    }

    const items = matches
      .map((c) => sectionItem(c.heading, chunkMap.indexOf(c)))
      .join('');

    setPanel(`${matches.length} section${matches.length === 1 ? '' : 's'} match`, items, '');
    bindSectionClicks();
  }

  function sectionItem(heading, index) {
    return `
      <button class="jev-section" data-idx="${index}">
        <span class="jev-section-arrow">›</span>
        <span class="jev-section-text">${escapeHtml(heading)}</span>
      </button>`;
  }

  function bindSectionClicks() {
    drawerEl.querySelectorAll('.jev-section').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(Number(btn.dataset.idx)));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigateTo(Number(btn.dataset.idx));
        if (e.key === 'ArrowDown') { e.preventDefault(); focusResult(Number(btn.dataset.idx) - chunkMap.indexOf(chunkMap.filter(c=>c.isHeading)[0]) + 1); }
        if (e.key === 'ArrowUp') {
          const items = drawerEl.querySelectorAll('.jev-section, .jev-result');
          const idx = Array.from(items).indexOf(btn);
          if (idx <= 0) drawerEl.querySelector('#jev-input').focus();
          else items[idx - 1].focus();
        }
      });
    });
  }

  // ── JEV semantic search ────────────────────────────────────────────────────

  async function runJevSearch() {
    if (isSearching) return;
    const query = drawerEl.querySelector('#jev-input').value.trim();
    if (!query) return;

    const { jevApiKey } = await chrome.storage.sync.get('jevApiKey');
    if (!jevApiKey) {
      setPanel('', '', 'No API key set — click the extension icon to add your JEV token.');
      return;
    }

    isSearching = true;
    drawerEl.querySelector('#jev-search-btn').disabled = true;
    setPanel(`Analyzing ${chunkMap.length} sections…`, '', '');

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
    drawerEl.querySelector('#jev-search-btn').disabled = false;

    if (response?.error) {
      setPanel('', '', `Error: ${response.error}`);
      return;
    }

    if (!response || response.length === 0) {
      setPanel(
        '',
        '',
        `Nothing found on this page. <a class="jev-fallback-link" data-query="${escapeHtml(query)}">Search the web →</a>`
      );
      drawerEl.querySelector('.jev-fallback-link')?.addEventListener('click', () => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
      });
      return;
    }

    renderJevResults(response);
  }

  function renderJevResults(results) {
    const items = results
      .map(
        (r) => `
      <div class="jev-result" tabindex="0" data-idx="${r.index}" role="listitem">
        <span class="jev-rank">${r.rank}</span>
        <div class="jev-result-body">
          <div class="jev-result-heading">${escapeHtml(r.heading)}</div>
          <div class="jev-result-snippet">${escapeHtml(r.snippet)}</div>
        </div>
      </div>`
      )
      .join('');

    setPanel('Top results', items, '');

    drawerEl.querySelectorAll('.jev-result').forEach((el) => {
      el.addEventListener('click', () => navigateTo(Number(el.dataset.idx)));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigateTo(Number(el.dataset.idx));
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const all = drawerEl.querySelectorAll('.jev-result');
          const i = Array.from(all).indexOf(el);
          if (i < all.length - 1) all[i + 1].focus();
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const all = drawerEl.querySelectorAll('.jev-result');
          const i = Array.from(all).indexOf(el);
          if (i === 0) drawerEl.querySelector('#jev-input').focus();
          else all[i - 1].focus();
        }
      });
    });
  }

  // ── Navigate to section ────────────────────────────────────────────────────

  function navigateTo(index) {
    const chunk = chunkMap[index];
    if (!chunk?.element) return;
    // Keep drawer open — scroll page underneath it
    chunk.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    chunk.element.classList.add('jev-highlight');
    setTimeout(() => chunk.element.classList.remove('jev-highlight'), 2000);
  }

  // ── Panel helpers ─────────────────────────────────────────────────────────

  function setPanel(label, itemsHtml, statusHtml) {
    const panel = drawerEl.querySelector('#jev-results-panel');
    const labelEl = drawerEl.querySelector('#jev-panel-label');
    const resultsEl = drawerEl.querySelector('#jev-results');
    const statusEl = drawerEl.querySelector('#jev-status');

    labelEl.textContent = label || '';
    resultsEl.innerHTML = itemsHtml || '';
    statusEl.innerHTML = statusHtml || '';

    statusEl.classList.toggle('jev-visible', Boolean(statusHtml));

    const hasContent = Boolean(label || itemsHtml || statusHtml);
    panel.classList.toggle('jev-visible', hasContent);
  }

  function focusResult(index) {
    const items = drawerEl.querySelectorAll('.jev-section, .jev-result');
    if (items[index]) items[index].focus();
  }

  // ── Page extraction ────────────────────────────────────────────────────────

  function extractChunks() {
    const skip = 'nav, footer, aside, [role="navigation"], [role="contentinfo"], script, style, noscript';
    const chunks = [];

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(
      (h) => !h.closest(skip) && (h.innerText?.trim().length ?? 0) > 2
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
      if (fullText.length < 20) return;

      chunks.push({
        heading: heading.innerText.trim().substring(0, 80),
        text: fullText.substring(0, 500),
        snippet: content.trim().substring(0, 120) || heading.innerText.trim().substring(0, 120),
        element: heading,
        isHeading: true,
      });
    });

    // Paragraph fallback for pages with no meaningful heading structure
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
          isHeading: false,
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
