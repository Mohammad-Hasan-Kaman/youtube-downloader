// Robust GitHub release asset upload with retry, for slow connections.
const fs = require('fs');
const { execFileSync } = require('child_process');

const [,, releaseId, file, name] = process.argv;
const creds = fs.readFileSync(require('os').homedir() + '/.git-credentials', 'utf8');
const m = creds.match(/https:\/\/Mohammad-Hasan-Kaman:([^@]+)@github\.com/);
if (!m) { console.error('NO TOKEN'); process.exit(1); }
const TOKEN = m[1];
const url = `https://uploads.github.com/repos/Mohammad-Hasan-Kaman/youtube-downloader/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;

async function tryUpload() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(fs.statSync(file).size),
    },
    body: fs.readFileSync(file),
  });
  return res;
}

(async () => {
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(`attempt ${attempt} uploading ${file} (${(fs.statSync(file).size / 1048576).toFixed(0)}MiB)...`);
    try {
      const res = await tryUpload();
      const text = await res.text();
      if (res.status >= 200 && res.status < 300) {
        let j = {}; try { j = JSON.parse(text); } catch (_) {}
        console.log(`OK status=${res.status} name=${j.name || name} state=${j.state}`);
        process.exit(0);
      }
      console.log(`status=${res.status} body=${text.slice(0, 200)}`);
    } catch (e) {
      console.log(`network error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  console.log('FAILED after 4 attempts');
  process.exit(1);
})();
