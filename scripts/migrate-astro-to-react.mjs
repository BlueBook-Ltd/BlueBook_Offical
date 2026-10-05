#!/usr/bin/env node
/**
 * ponytail: one-shot Astro → React mechanical converter.
 * Ceiling: complex class:list / Astro-only syntax may need manual fix.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');

function extractStyleBlocks(content) {
  const styles = [];
  const without = content.replace(/<style(?:\s+is:global)?>([\s\S]*?)<\/style>/gi, (_, css) => {
    styles.push(css.replace(/:global\(([^)]+)\)/g, '$1'));
    return '';
  });
  return { html: without, css: styles.join('\n') };
}

function extractScripts(content) {
  const scripts = [];
  const without = content.replace(/<script(?:\s+is:inline)?>([\s\S]*?)<\/script>/gi, (_, js) => {
    if (js.includes('import ')) scripts.push(js.trim());
    return '';
  });
  return { html: without, scriptImports: scripts };
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return { fm: '', body: raw };
  return { fm: match[1], body: raw.slice(match[0].length) };
}

function convertFrontmatter(fm, componentName) {
  const lines = fm.split('\n').filter((l) => !l.includes('prerender') && !l.includes('Astro.redirect') && !l.includes('Astro.response'));
  const imports = [];
  const consts = [];
  let hasAwait = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('//')) continue;
    if (t.startsWith('import ')) {
      imports.push(t.replace(/\.astro(['"])/g, '$1').replace(/\.astro'/g, ".tsx'").replace(/\.astro"/g, '.tsx"'));
    } else if (t.startsWith('const ') || t.startsWith('interface ') || t.startsWith('type ')) {
      if (t.includes('await ')) hasAwait = true;
      consts.push(t);
    } else if (t.startsWith('return ')) {
      // skip redirect lines handled in routes
    }
  }

  const fn = hasAwait
    ? `export default async function ${componentName}()`
    : `export default function ${componentName}()`;

  return { imports, consts, fn, hasAwait };
}

function convertHtml(html) {
  return html
    .replace(/\bclass=/g, 'className=')
    .replace(/class:list=\{\[([^\]]+)\]\}/g, (_, inner) => {
      return `className={[${inner}].filter(Boolean).join(' ')}`;
    })
    .replace(/class:list=\{\["([^"]+)",\s*\{\s*"([^"]+)":\s*([^}]+)\s*\}\]\}/g, (_, cls, key, cond) => {
      return `className={\`${cls}\${${cond.trim()} ? ' ${key}' : ''}\`}`;
    })
    .replace(/set:html=\{([^}]+)\}/g, 'dangerouslySetInnerHTML={{ __html: $1 }}')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\sclassName="([^"]*)\s&amp;\s([^"]*)"/g, ' className="$1 & $2"')
    .replace(/<br\s*\/>/g, '<br />')
    .replace(/\{([^}]*)\.map\(\(([^)]+)\)\s*=>\s*\(\s*\n?\s*<(\w+)/g, (m, arr, params, tag) => {
      const param = params.split(',')[0].trim();
      return `{${arr}.map((${params}) => (\n            <${tag} key={${param}.slug ?? ${param}}`;
    })
    .replace(/\{([^}]*)\.map\(\(\[([^\]]+)\],\s*i\)\s*=>\s*\(\s*\n?\s*<(\w+)/g, (m, arr, destructure, tag) => {
      return `{${arr}.map(([${destructure}], i) => (\n        <${tag} key={i}`;
    })
    .replace(/\{([^}]*)\.map\(\(\[([^\]]+)\]\)\s*=>\s*\(\s*\n?\s*<(\w+)/g, (m, arr, destructure, tag) => {
      const key = destructure.split(',')[0].trim();
      return `{${arr}.map(([${destructure}]) => (\n            <${tag} key={${key}}`;
    })
    .replace(/<slot\s*\/>/g, '{children}')
    .replace(/<Fragment>/g, '<>')
    .replace(/<\/Fragment>/g, '</>');
}

function convertFile(astroPath, outPath, componentName) {
  const raw = fs.readFileSync(astroPath, 'utf8');
  const { fm, body } = parseFrontmatter(raw);
  const { html: noStyle, css } = extractStyleBlocks(body);
  const { html, scriptImports } = extractScripts(noStyle);
  const jsx = convertHtml(html.trim());
  const { imports, consts, fn, hasAwait } = convertFrontmatter(fm, componentName);

  if (css) {
    const cssPath = outPath.replace(/\.tsx$/, '.css');
    fs.mkdirSync(path.dirname(cssPath), { recursive: true });
    fs.writeFileSync(cssPath, css);
    imports.push(`import './${path.basename(cssPath)}';`);
  }

  const scriptEffect =
    scriptImports.length > 0
      ? `\nimport { useEffect } from 'react';\n\nconst __motionImports = [${scriptImports.map((s) => {
          const m = s.match(/import\s+['"]([^'"]+)['"]/);
          return m ? `'${m[1].replace(/^\.\.\//, '@/').replace(/^\.\//, '@/')}'` : null;
        }).filter(Boolean).join(', ')}];\n`
      : '';

  const effectHook =
    scriptImports.length > 0
      ? `\n  useEffect(() => {\n    __motionImports.forEach((p) => { import(/* @vite-ignore */ p); });\n  }, []);\n`
      : '';

  const reactImports = new Set(["import React from 'react';"]);
  if (scriptImports.length > 0) reactImports.add("import { useEffect } from 'react';");
  if (jsx.includes('Link ') || jsx.includes('<Link')) reactImports.add("import { Link } from 'react-router-dom';");
  jsx.replace(/href=\{?[`'"]\/en\//g, () => {
    reactImports.add("import { Link } from 'react-router-dom';");
    return 'href="/en/';
  });

  const allImports = [...new Set([...reactImports, ...imports.map((i) => i.replace(/from ['"]\.\.\/layouts\/BaseLayout\.astro['"]/g, "from '@/layouts/BaseLayout'").replace(/\.astro/g, '').replace(/from ['"]\.\.\/components\/([^'"]+)['"]/g, "from '@/components/$1'"))])];

  const content = `${allImports.join('\n')}${scriptEffect}
${consts.join('\n')}

${fn} {
${effectHook}  return (
    <>
${jsx.split('\n').map((l) => '      ' + l).join('\n')}
    </>
  );
}
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  console.log(`  ${path.relative(root, astroPath)} → ${path.relative(root, outPath)}`);
}

function migrateDir(astroDir, outDir, prefix = '') {
  if (!fs.existsSync(astroDir)) return;
  for (const entry of fs.readdirSync(astroDir, { withFileTypes: true })) {
    const astroPath = path.join(astroDir, entry.name);
    if (entry.isDirectory()) {
      migrateDir(astroPath, path.join(outDir, entry.name), prefix);
      continue;
    }
    if (!entry.name.endsWith('.astro')) continue;
    const base = entry.name.replace('.astro', '');
    const name = base === 'index' ? prefix || 'Page' : base.charAt(0).toUpperCase() + base.slice(1).replace(/\[slug\]/, 'Detail');
    convertFile(astroPath, path.join(outDir, `${name}.tsx`), name);
  }
}

console.log('[migrate] Converting Astro components…');
migrateDir(path.join(src, 'components'), path.join(src, 'components'), 'Component');
console.log('[migrate] Converting Astro pages…');
migrateDir(path.join(src, 'pages'), path.join(src, 'routes'), 'Page');
console.log('[migrate] Done.');
