#!/usr/bin/env node
/**
 * update-lessons-index.mjs
 *
 * Regenerates docs/lessons/index.md from the lesson markdown files found under
 * docs/lessons/<category>/<topic>/<lesson-name>.md.
 *
 * Exits 0 in all cases. Prints "noop" when the file is already current so the
 * GitHub Actions workflow can skip the commit step cleanly.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const LESSONS_DIR = join(ROOT, 'docs', 'lessons');
const INDEX_PATH = join(LESSONS_DIR, 'index.md');

// Human-readable overrides for directory names that are abbreviations.
// Everything else is converted from kebab-case to Title Case automatically.
const LABEL_MAP = /** @type {Record<string, string>} */ ({
  pwa: 'PWA',
  css: 'CSS',
  api: 'API',
  jsx: 'JSX',
  tsx: 'TSX',
  html: 'HTML',
  svg: 'SVG',
  ai: 'AI',
  ci: 'CI',
  'ci-automation': 'CI Automation',
  wgi: 'WGI',
  'wgi-eras': 'WGI Eras',
  competitionsuite: 'CompetitionSuite',
  rmpa: 'RMPA',
});

/** Convert a kebab-case directory name to a human-readable label. */
function toLabel(dirName) {
  return (
    LABEL_MAP[dirName] ??
    dirName
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

/**
 * Extract the title and key takeaway from a lesson file.
 * Falls back to the filename stem / empty string when not found.
 */
function extractLesson(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const titleMatch = text.match(/^# (.+)$/m);
  const takeawayMatch = text.match(/^## Key takeaway\s*\n+(.+)/m);
  return {
    title: titleMatch?.[1]?.trim() ?? basename(filePath, '.md'),
    takeaway: takeawayMatch?.[1]?.trim() ?? '',
  };
}

/**
 * Scan the lessons directory and return a nested structure:
 *   { [category]: { [topic]: filePath[] } }
 *
 * Only directories at the first level (category) and second level (topic) are
 * traversed. Lesson files must live at exactly the third level.
 */
function scanLessons(lessonsDir) {
  /** @type {Record<string, Record<string, string[]>>} */
  const result = {};

  const categoryDirs = readdirSync(lessonsDir)
    .filter((e) => statSync(join(lessonsDir, e)).isDirectory())
    .sort();

  for (const cat of categoryDirs) {
    const catPath = join(lessonsDir, cat);
    const topicDirs = readdirSync(catPath)
      .filter((e) => statSync(join(catPath, e)).isDirectory())
      .sort();

    const topics = /** @type {Record<string, string[]>} */ ({});

    for (const topic of topicDirs) {
      const topicPath = join(catPath, topic);
      const files = readdirSync(topicPath)
        .filter((e) => e.endsWith('.md') && e !== 'index.md')
        .sort()
        .map((e) => join(topicPath, e));

      if (files.length > 0) {
        topics[topic] = files;
      }
    }

    if (Object.keys(topics).length > 0) {
      result[cat] = topics;
    }
  }

  return result;
}

/** Build the full text content for index.md. */
function generateIndex(categories, lessonsDir) {
  const lines = [
    '# Lessons Index',
    '',
    '_Auto-generated. Do not edit by hand — run `node scripts/update-lessons-index.mjs` to regenerate._',
    '',
  ];

  for (const [cat, topics] of Object.entries(categories)) {
    lines.push(`## ${toLabel(cat)}`);
    lines.push('');

    for (const [topic, files] of Object.entries(topics)) {
      lines.push(`### ${toLabel(topic)}`);
      lines.push('');

      for (const filePath of files) {
        const { title, takeaway } = extractLesson(filePath);
        const rel = relative(lessonsDir, filePath);
        const bullet = takeaway
          ? `- [${title}](${rel}) — ${takeaway}`
          : `- [${title}](${rel})`;
        lines.push(bullet);
      }

      lines.push('');
    }
  }

  // Ensure single trailing newline
  return lines.join('\n').trimEnd() + '\n';
}

const categories = scanLessons(LESSONS_DIR);
const newContent = generateIndex(categories, LESSONS_DIR);

if (existsSync(INDEX_PATH) && readFileSync(INDEX_PATH, 'utf8') === newContent) {
  console.log('noop: docs/lessons/index.md is already up to date.');
  process.exit(0);
}

writeFileSync(INDEX_PATH, newContent, 'utf8');
console.log('Updated docs/lessons/index.md');
