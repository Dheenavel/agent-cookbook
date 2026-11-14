const JEV_API_URL = 'https://api.typesafe.ai/v1/systemone';

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-search') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Try sending to an already-running content script first
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
  } catch {
    // Content script not present — tab was open before the extension loaded.
    // Inject it programmatically then retry.
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['overlay.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      // Brief delay for the listener to register before we send the message
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
      }, 50);
    } catch (injectionErr) {
      // Can't inject on chrome:// pages or the Chrome Web Store — expected
      console.warn('JEV Page Search: cannot inject on this page.', injectionErr.message);
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEARCH') {
    handleSearch(message.query, message.chunks, message.apiKey)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep message channel open for async response
  }
});

async function handleSearch(query, chunks, apiKey) {
  const promises = chunks.map((chunk) => scoreChunk(chunk, query, apiKey));
  const scored = await Promise.all(promises);

  return scored
    .filter((r) => r.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r, rank) => ({ rank: rank + 1, index: r.index, heading: r.heading, snippet: r.snippet }));
}

async function scoreChunk(chunk, query, apiKey) {
  try {
    const res = await fetch(JEV_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state: chunk.text,
        questions: {
          relevance: {
            type: 'score',
            instructions: `How relevant is this section to the search query: "${query}"?`,
            criteria: [
              'Not relevant — unrelated to the query',
              'Slightly relevant — touches the topic loosely',
              'Moderately relevant — relates to the query',
              'Highly relevant — directly addresses the query',
              'Extremely relevant — directly answers the query',
            ],
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`JEV API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const rawScore = data.answers.relevance.score;
    const score = (rawScore / 4) * 10;

    return { ...chunk, score };
  } catch {
    return { ...chunk, score: 0 };
  }
}
