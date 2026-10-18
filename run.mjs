// 补丁落地助手：在 NAS 容器内运行（挂载 /volume1/docker:/work）
import https from 'https';
import fs from 'fs';
import zlib from 'zlib';
import { execSync } from 'child_process';

const URLS = [
  'https://fastly.jsdelivr.net/gh/teastywang/inv-relay@main/inv-patch.b64',
  'https://cdn.jsdelivr.net/gh/teastywang/inv-relay@main/inv-patch.b64',
  'https://raw.githubusercontent.com/teastywang/inv-relay/main/inv-patch.b64',
];
const WORK = '/work';

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return get(r.headers.location).then(resolve, reject);
      }
      if (r.statusCode !== 200) { reject(new Error('HTTP ' + r.statusCode)); return; }
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
  });
}

let b64 = '';
for (const u of URLS) {
  try {
    const d = await get(u);
    if (d.replace(/\s+/g, '').length > 100) { b64 = d; console.log('DOWNLOADED', u, d.length); break; }
  } catch (e) { console.log('FAIL', u, e.message); }
}
if (!b64) { console.error('DOWNLOAD FAILED'); process.exit(1); }

const tar = Buffer.from(b64.replace(/\s+/g, ''), 'base64');
fs.writeFileSync(WORK + '/inv-patch.tar.gz', tar);
const plain = zlib.gunzipSync(tar);
fs.writeFileSync(WORK + '/inv-patch.tar', plain);

execSync('tar tf ' + WORK + '/inv-patch.tar >/dev/null', { stdio: 'inherit' });
console.log('TAR OK');

if (!fs.existsSync(WORK + '/inventory')) { console.error('NO /work/inventory'); process.exit(1); }
execSync('tar xf ' + WORK + '/inv-patch.tar -C ' + WORK + '/inventory --exclude=_deploy_inv.sh', { stdio: 'inherit' });
const deploy = execSync('tar xf ' + WORK + '/inv-patch.tar -O _deploy_inv.sh').toString();
fs.writeFileSync(WORK + '/deploy_inv.sh', deploy);
try { fs.chmodSync(WORK + '/deploy_inv.sh', 0o755); } catch {}
console.log('PATCH_EXTRACTED_OK');
