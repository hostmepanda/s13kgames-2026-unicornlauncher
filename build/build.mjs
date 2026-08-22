// Build pipeline: src/*.js + src/*.css + src/index.html -> dist/index.html
//
// JS: esbuild bundle+minify, then terser for a second, more aggressive pass.
// CSS: esbuild minify.
// Then two HTML variants are assembled — one with the plain minified JS,
// one with the JS further packed by Roadroller — and both get zipped to
// measure their real js13k footprint. The smaller zip wins and its HTML
// becomes dist/index.html, so Roadroller only gets used when it actually
// helps (it can lose to plain DEFLATE on small/non-repetitive code).
import { build } from 'esbuild';
import { minify } from 'terser';
import { Packer } from 'roadroller';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

async function buildJs() {
  const bundled = await build({
    entryPoints: [path.join(src, 'main.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2019',
    write: false,
  });
  const esbuildJs = bundled.outputFiles[0].text;

  const terserResult = await minify(esbuildJs, {
    compress: {
      passes: 3,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_methods: true,
      toplevel: true,
    },
    mangle: { toplevel: true },
    format: { comments: false },
  });
  return terserResult.code;
}

async function buildCss() {
  const bundled = await build({
    entryPoints: [path.join(src, 'style.css')],
    minify: true,
    write: false,
  });
  return bundled.outputFiles[0].text.trim();
}

async function packWithRoadroller(js) {
  const packer = new Packer([{ data: js, type: 'js', action: 'eval' }]);
  await packer.optimize();
  const { firstLine, secondLine } = packer.makeDecoder();
  return firstLine + secondLine;
}

function collapseWhitespace(html) {
  return html.replace(/>\s+</g, '><').trim();
}

async function assembleHtml(css, js) {
  const template = await readFile(path.join(src, 'index.html'), 'utf8');
  const [before, rest] = template.split('<!--CSS-->');
  const [middle, after] = rest.split('<!--JS-->');
  return collapseWhitespace(before) + css + collapseWhitespace(middle) + js + collapseWhitespace(after);
}

async function zipSize(html) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'unicorn-launch-'));
  try {
    const htmlPath = path.join(tmp, 'index.html');
    const zipPath = path.join(tmp, 'game.zip');
    await writeFile(htmlPath, html);
    const result = spawnSync('zip', ['-9', '-X', zipPath, 'index.html'], { cwd: tmp });
    if (result.status !== 0) {
      throw new Error(`zip failed: ${result.stderr}`);
    }
    return (await stat(zipPath)).size;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const [js, css] = await Promise.all([buildJs(), buildCss()]);
  const packedJs = await packWithRoadroller(js);

  const plainHtml = await assembleHtml(css, js);
  const roadrollerHtml = await assembleHtml(css, packedJs);

  const [plainZip, roadrollerZip] = await Promise.all([
    zipSize(plainHtml),
    zipSize(roadrollerHtml),
  ]);

  const useRoadroller = roadrollerZip < plainZip;
  const winner = useRoadroller ? roadrollerHtml : plainHtml;

  console.log(`plain minified:  ${plainHtml.length} bytes html, ${plainZip} bytes zipped`);
  console.log(`roadroller:      ${roadrollerHtml.length} bytes html, ${roadrollerZip} bytes zipped`);
  console.log(`using: ${useRoadroller ? 'roadroller' : 'plain minified'} (smaller zip)`);

  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, 'index.html'), winner);
  console.log(`wrote dist/index.html (${winner.length} bytes)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
