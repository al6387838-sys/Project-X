import fs from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/summarize-lighthouse.mjs <report.json> [...]');
  process.exit(1);
}

for (const file of files) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const categories = Object.fromEntries(
    Object.entries(report.categories || {}).map(([id, category]) => [
      id,
      Math.round((category.score || 0) * 100),
    ]),
  );
  const metrics = {};
  for (const id of [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive',
  ]) {
    const audit = report.audits?.[id];
    if (audit) metrics[id] = audit.displayValue || audit.numericValue;
  }
  const failures = Object.values(report.audits || {})
    .filter((audit) => audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== 'notApplicable')
    .map((audit) => ({
      id: audit.id,
      score: audit.score,
      title: audit.title,
      displayValue: audit.displayValue || '',
      items: (Array.isArray(audit.details?.items) ? audit.details.items : []).slice(0, 8).map((item) => ({
        node: item.node?.snippet || item.node?.selector || '',
        url: item.url || '',
        totalBytes: item.totalBytes,
        wastedMs: item.wastedMs,
        source: item.source || '',
      })),
    }))
    .sort((left, right) => (left.score ?? 1) - (right.score ?? 1));
  const diagnostics = {};
  for (const id of ['bootup-time', 'mainthread-work-breakdown', 'long-tasks', 'unused-javascript']) {
    const audit = report.audits?.[id];
    if (!audit) continue;
    diagnostics[id] = {
      displayValue: audit.displayValue || '',
      items: (Array.isArray(audit.details?.items) ? audit.details.items : []).slice(0, 12).map((item) => ({
        url: item.url || '',
        total: item.total,
        scripting: item.scripting,
        scriptParseCompile: item.scriptParseCompile,
        duration: item.duration,
        startTime: item.startTime,
        wastedMs: item.wastedMs,
        groupLabel: item.groupLabel || '',
      })),
    };
  }
  console.log(JSON.stringify({ file, url: report.finalDisplayedUrl, categories, metrics, failures, diagnostics }, null, 2));
}
