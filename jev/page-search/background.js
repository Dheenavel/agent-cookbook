const JEV_API_URL = 'https://api.typesafe.ai/v1/systemone';

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-search') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
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
