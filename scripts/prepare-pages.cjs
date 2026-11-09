// Keep source files buildless; publish content-versioned assets to avoid mixed releases.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function prepare(root = path.resolve(__dirname, '..'), output = path.join(root, 'work/pages')) {
 const source = path.join(root, 'dist');
 if (output === source || output.startsWith(source + path.sep)) throw Error('Output must be outside dist.');
 fs.rmSync(output, { recursive: true, force: true });
 fs.mkdirSync(output, { recursive: true });
 fs.cpSync(source, output, { recursive: true });
 const manifest = {};
 let html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
 html = html.replace(/\b(src|href)="([^"\s]+)"/g, (attribute, kind, ref) => {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(ref) || !/\.(?:js|css)$/.test(ref)) return attribute;
  const input = path.resolve(source, ref);
  if (!input.startsWith(source + path.sep) || !fs.statSync(input).isFile()) throw Error('Invalid static asset: ' + ref);
  const bytes = fs.readFileSync(input), hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const extension = path.extname(ref), versioned = ref.slice(0, -extension.length) + '.' + hash + extension;
  fs.writeFileSync(path.join(output, versioned), bytes);
  manifest[ref] = versioned;
  return kind + '="' + versioned + '"';
 });
 fs.writeFileSync(path.join(output, 'index.html'), html);
 fs.writeFileSync(path.join(output, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
 return { output, manifest };
}
module.exports = { prepare };
if (require.main === module) {
 const result = prepare();
 console.log('Prepared Pages with ' + Object.keys(result.manifest).length + ' versioned assets.');
}
