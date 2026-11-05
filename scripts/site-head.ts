// Checks the page's <head>: every tag a browser, a home screen or a link-preview crawler needs is
// there, and every file it points to exists (in public/ for the source, in dist/ after a build),
// with icons and the preview image at the sizes they declare.
//   pnpm tsx scripts/site-head.ts dist     checks a build
// site-head.test.ts runs the same check on index.html and public/.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CANONICAL = 'https://battle-ball.netlify.app/';

/** Tags that must be present, as [attribute, name] for <meta> and [rel] for <link>. */
const METAS = [
  ['name', 'description'],
  ['name', 'theme-color'],
  ['property', 'og:type'],
  ['property', 'og:site_name'],
  ['property', 'og:title'],
  ['property', 'og:description'],
  ['property', 'og:url'],
  ['property', 'og:image'],
  ['property', 'og:image:width'],
  ['property', 'og:image:height'],
  ['property', 'og:image:alt'],
  ['name', 'twitter:card'],
  ['name', 'twitter:title'],
  ['name', 'twitter:description'],
  ['name', 'twitter:image'],
  ['name', 'twitter:image:alt'],
] as const;
const LINKS = ['canonical', 'icon', 'apple-touch-icon', 'manifest'] as const;

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

function tags(html: string, element: 'meta' | 'link'): string[] {
  return [...html.matchAll(new RegExp(`<${element}\\s[^>]*>`, 'g'))].map((match) => match[0]);
}

/** Width and height of a PNG, from its IHDR chunk. */
export function pngSize(bytes: Buffer): [number, number] | undefined {
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') return undefined;
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

/** Problems with the head of `htmlPath`, whose files are served from `filesDir`. Empty is good. */
export function checkHead(htmlPath: string, filesDir: string): string[] {
  const html = readFileSync(htmlPath, 'utf8');
  const problems: string[] = [];
  const metas = tags(html, 'meta');
  const links = tags(html, 'link');
  const meta = (key: string, name: string) =>
    metas
      .map((tag) => (attribute(tag, key) === name ? attribute(tag, 'content') : undefined))
      .find((content) => content !== undefined);

  if (!/<title>[^<]+<\/title>/.test(html)) problems.push('missing <title>');
  for (const [key, name] of METAS) {
    if (!meta(key, name)) problems.push(`missing <meta ${key}="${name}">`);
  }
  for (const rel of LINKS) {
    if (!links.some((tag) => attribute(tag, 'rel') === rel))
      problems.push(`missing <link rel="${rel}">`);
  }

  /** Maps a URL on this site (relative, or on the canonical domain) to a file, or reports it. */
  const resolve = (url: string, what: string): string | undefined => {
    const path = url.startsWith(CANONICAL) ? `/${url.slice(CANONICAL.length)}` : url;
    if (!path.startsWith('/')) {
      problems.push(`${what} is not on this site: ${url}`);
      return undefined;
    }
    const file = join(filesDir, path);
    if (!existsSync(file)) problems.push(`${what} does not resolve: ${url}`);
    return file;
  };

  const canonical = links.find((tag) => attribute(tag, 'rel') === 'canonical');
  if (canonical !== undefined && attribute(canonical, 'href') !== CANONICAL) {
    problems.push(`canonical is not ${CANONICAL}`);
  }
  if (meta('property', 'og:url') !== CANONICAL) problems.push(`og:url is not ${CANONICAL}`);

  for (const tag of links) {
    const rel = attribute(tag, 'rel');
    const href = attribute(tag, 'href');
    if (rel === 'canonical' || href === undefined || href.startsWith('/src/')) continue;
    const file = resolve(href, `<link rel="${rel ?? ''}">`);
    const sizes = attribute(tag, 'sizes');
    if (file !== undefined && existsSync(file) && sizes !== undefined && sizes !== 'any') {
      const size = pngSize(readFileSync(file));
      if (size?.join('x') !== sizes) problems.push(`${href} is not ${sizes}`);
    }
  }

  for (const key of ['og:image', 'twitter:image']) {
    const content = meta(key.startsWith('og') ? 'property' : 'name', key);
    if (content === undefined) continue;
    if (!content.startsWith(CANONICAL))
      problems.push(`${key} must be an absolute URL on ${CANONICAL}`);
    const file = resolve(content, key);
    if (file !== undefined && existsSync(file)) {
      const size = pngSize(readFileSync(file));
      const declared = [meta('property', 'og:image:width'), meta('property', 'og:image:height')];
      if (size?.join('x') !== declared.join('x'))
        problems.push(`${key} is not ${declared.join('x')}`);
    }
  }

  const manifestTag = links.find((tag) => attribute(tag, 'rel') === 'manifest');
  const manifestHref = manifestTag === undefined ? undefined : attribute(manifestTag, 'href');
  const manifestFile = manifestHref === undefined ? undefined : resolve(manifestHref, 'manifest');
  if (manifestFile !== undefined && existsSync(manifestFile)) {
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
      name?: string;
      start_url?: string;
      icons?: { src: string; sizes: string; purpose?: string }[];
    };
    if (!manifest.name || !manifest.start_url) problems.push('manifest lacks name or start_url');
    for (const icon of manifest.icons ?? []) {
      const file = resolve(icon.src, `manifest icon ${icon.src}`);
      if (file === undefined || !existsSync(file) || icon.sizes === 'any') continue;
      if (pngSize(readFileSync(file))?.join('x') !== icon.sizes) {
        problems.push(`manifest icon ${icon.src} is not ${icon.sizes}`);
      }
    }
    if (!(manifest.icons ?? []).some((icon) => icon.purpose === 'maskable')) {
      problems.push('manifest has no maskable icon');
    }
  }
  return problems;
}

if (process.argv[1]?.endsWith('site-head.ts')) {
  const dir = process.argv[2] ?? 'dist';
  const problems = checkHead(join(dir, 'index.html'), dir);
  console.log(
    problems.length === 0 ? `${dir}/index.html: every tag and file resolves` : problems.join('\n'),
  );
  process.exitCode = problems.length === 0 ? 0 : 1;
}
