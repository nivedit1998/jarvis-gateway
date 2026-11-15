const button = document.querySelector('#refresh');
const badge = document.querySelector('#gateway-badge');
const detail = document.querySelector('#gateway-detail');
const note = document.querySelector('#check-note');
let inFlight = false;
async function check() {
  if (inFlight) return;
  inFlight = true; button.disabled = true;
  try {
    const response = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('health check failed');
    const health = await response.json();
    if (health.service !== 'jarvis-gateway' || health.status !== 'ok') throw new Error('unexpected response');
    badge.textContent = 'Online'; badge.classList.remove('muted');
    detail.textContent = 'This deployment is responding.';
    note.textContent = `Checked at ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}. The home connection is not configured yet.`;
  } catch {
    badge.textContent = 'Check failed'; badge.classList.add('muted');
    detail.textContent = 'Could not verify the gateway. Try again.';
    note.textContent = 'This does not tell us whether your home computer is online.';
  } finally { inFlight = false; button.disabled = false; }
}
button.addEventListener('click', check);
check();
