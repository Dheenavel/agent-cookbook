const input = document.getElementById('token-input');
const saveBtn = document.getElementById('save-btn');
const searchBtn = document.getElementById('search-btn');
const divider = document.getElementById('divider');
const status = document.getElementById('status');
const shortcutHint = document.getElementById('shortcut-hint');

// Show correct shortcut for platform
const isMac = navigator.platform.startsWith('Mac');
shortcutHint.textContent = isMac ? 'Cmd+Shift+F' : 'Ctrl+Shift+F';

// Show "Search this page" button if token is already saved
chrome.storage.sync.get('jevApiKey', ({ jevApiKey }) => {
  if (jevApiKey) {
    input.placeholder = '••••••••••••••••••••';
    status.textContent = 'Token saved.';
    searchBtn.style.display = 'block';
    divider.style.display = 'block';
  }
});

// Save token
saveBtn.addEventListener('click', () => {
  const token = input.value.trim();
  if (!token) {
    status.textContent = 'Please enter a token.';
    return;
  }
  chrome.storage.sync.set({ jevApiKey: token }, () => {
    input.value = '';
    input.placeholder = '••••••••••••••••••••';
    status.textContent = 'Saved!';
    searchBtn.style.display = 'block';
    divider.style.display = 'block';
    setTimeout(() => { status.textContent = 'Token saved.'; }, 1500);
  });
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

// Search this page — injects content script if needed then toggles overlay
searchBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  window.close();

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
  } catch {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['overlay.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
      }, 60);
    } catch (err) {
      console.warn('JEV: cannot inject on this page.', err.message);
    }
  }
});
