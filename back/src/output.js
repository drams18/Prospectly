import { writeFileSync, mkdirSync } from 'fs';
import { stringify } from 'csv-stringify/sync';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '..', 'results');

const CSV_COLUMNS = [
  { key: 'name',              header: 'Nom' },
  { key: 'address',           header: 'Adresse' },
  { key: 'phone',             header: 'Téléphone' },
  { key: 'rating',            header: 'Note Google' },
  { key: 'user_ratings_total',header: 'Nb Avis' },
  { key: 'distance_meters',   header: 'Distance (m)' },
  { key: 'hasSite',           header: 'A un site' },
  { key: 'isOwnSite',         header: 'Site propre' },
  { key: 'platforms',         header: 'Plateformes détectées' },
  { key: 'websiteUrl',        header: 'URL site' },
  { key: 'priority',          header: 'Priorité' },
  { key: 'score',             header: 'Score potentiel' },
  { key: 'score_reasons',     header: 'Raisons score' },
  { key: 'google_maps_url',   header: 'Lien Google Maps' },
];

export function saveResults(salons, label = 'results') {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
  const baseName = `${label}_${timestamp}`;

  // --- JSON ---
  const jsonPath = join(RESULTS_DIR, `${baseName}.json`);
  writeFileSync(jsonPath, JSON.stringify(salons, null, 2), 'utf-8');

  // --- CSV ---
  const rows = salons.map((s) => ({
    ...s,
    platforms: (s.platforms || []).join(' | '),
    score_reasons: (s.reasons || []).join(' | '),
  }));

  const csvData = stringify(rows, {
    header: true,
    columns: CSV_COLUMNS,
    delimiter: ';', // compatible Excel FR
    cast: { boolean: (v) => (v ? 'oui' : 'non') },
  });

  const csvPath = join(RESULTS_DIR, `${baseName}.csv`);
  writeFileSync(csvPath, '\uFEFF' + csvData, 'utf-8'); // BOM pour Excel

  return { jsonPath, csvPath };
}

/**
 * Affiche un résumé lisible dans le terminal.
 */
export function printSummary(salons, chalk) {
  const high   = salons.filter((s) => s.priority === 'high');
  const medium = salons.filter((s) => s.priority === 'medium');
  const low    = salons.filter((s) => s.priority === 'low');

  console.log('\n' + chalk.bold('─── RÉSUMÉ ────────────────────────────────────'));
  console.log(`  Total salons analysés : ${chalk.white.bold(salons.length)}`);
  console.log(`  🔴 Priorité HIGH      : ${chalk.red.bold(high.length)}`);
  console.log(`  🟡 Priorité MEDIUM    : ${chalk.yellow.bold(medium.length)}`);
  console.log(`  🟢 Priorité LOW       : ${chalk.green.bold(low.length)}`);
  console.log(chalk.bold('───────────────────────────────────────────────'));

  if (high.length) {
    console.log('\n' + chalk.red.bold('TOP PROSPECTS (HIGH) :'));
    for (const s of high.slice(0, 10)) {
      console.log(
        `  • ${chalk.white.bold(s.name.padEnd(35))} ` +
        `score:${chalk.red.bold(String(s.score).padStart(3))}  ` +
        `${String(s.distance_meters ?? '?').padStart(5)}m  ` +
        `⭐${s.rating || '?'} (${s.user_ratings_total || 0} avis)  ` +
        chalk.dim(s.address)
      );
    }
  }

  if (medium.length) {
    console.log('\n' + chalk.yellow.bold('PROSPECTS MEDIUM (5 premiers) :'));
    for (const s of medium.slice(0, 5)) {
      console.log(
        `  • ${chalk.white(s.name.padEnd(35))} ` +
        `score:${chalk.yellow(String(s.score).padStart(3))}  ` +
        chalk.dim(s.address)
      );
    }
  }
}
