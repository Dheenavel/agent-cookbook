const input = document.getElementById('token-input');
const btn = document.getElementById('save-btn');
const status = document.getElementById('status');

// Pre-fill saved token (masked)
chrome.storage.sync.get('jevApiKey', ({ jevApiKey }) => {
  if (jevApiKey) {
    input.placeholder = '••••••••••••••••••••';
    status.textContent = 'Token saved.';
  }
});

btn.addEventListener('click', () => {
  const token = input.value.trim();
  if (!token) {
    status.textContent = 'Please enter a token.';
    return;
  }
  chrome.storage.sync.set({ jevApiKey: token }, () => {
    input.value = '';
    input.placeholder = '••••••••••••••••••••';
    status.textContent = 'Saved!';
    setTimeout(() => { status.textContent = 'Token saved.'; }, 1500);
  });
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btn.click();
});
