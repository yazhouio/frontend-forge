const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app');
}

function render(json) {
  root.innerHTML = '';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(json, null, 2);
  root.appendChild(pre);
}

async function main() {
  render({ ok: true, message: 'Static files are working. Fetching /healthz…' });

  try {
    const res = await fetch('/healthz', { headers: { Accept: 'application/json' } });
    const data = await res.json();
    render({ ok: true, healthz: data, time: new Date().toISOString() });
  } catch (err) {
    render({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}

main();

