import 'dotenv/config';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';

import { geocodeAddress } from './src/geocode.js';
import { searchSalons, getPlaceDetails, haversineDistance, isFranchise } from './src/places.js';
import { analyzeWebsite, searchWebPresence } from './src/enrich.js';
import { computeScore, rankSalons } from './src/score.js';
import { saveResults, printSummary } from './src/output.js';

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_RESULTS     = parseInt(process.env.MAX_RESULTS || '60');
const SEARCH_RADIUS   = parseInt(process.env.SEARCH_RADIUS || '2000');
const WEB_ENRICHMENT  = process.env.ENABLE_WEB_ENRICHMENT === 'true';

// ─── Validation clé API ─────────────────────────────────────────────────────

if (!process.env.GOOGLE_MAPS_API_KEY) {
  console.error(chalk.red('✗ GOOGLE_MAPS_API_KEY manquante dans .env'));
  console.error(chalk.dim('  Copier .env.example → .env et renseigner la clé.'));
  process.exit(1);
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function main() {
  console.log(chalk.bold.cyan('\n  ✂  BARBER PROSPECTOR\n'));

  // 1. Saisie de l'adresse
  const { address } = await prompts({
    type: 'text',
    name: 'address',
    message: 'Adresse / quartier de recherche :',
    initial: 'Paris 18',
    validate: (v) => v.trim().length > 0 || 'Entrer une adresse',
  });

  if (!address) process.exit(0);

  const { radius } = await prompts({
    type: 'select',
    name: 'radius',
    message: 'Rayon de recherche :',
    choices: [
      { title: '1 km', value: 1000 },
      { title: '2 km (recommandé)', value: 2000 },
      { title: '3 km', value: 3000 },
    ],
    initial: 1,
  });

  // 2. Géocodage
  let spinner = ora('Géocodage de l\'adresse…').start();
  let origin;
  try {
    origin = await geocodeAddress(address);
    spinner.succeed(`Adresse : ${chalk.white(origin.formatted)}`);
  } catch (err) {
    spinner.fail(`Erreur géocodage : ${err.message}`);
    process.exit(1);
  }

  // 3. Recherche Google Places
  spinner = ora('Recherche des salons via Google Places…').start();
  let rawPlaces;
  try {
    rawPlaces = await searchSalons({ lat: origin.lat, lng: origin.lng, radius: radius || SEARCH_RADIUS });
    spinner.succeed(`${rawPlaces.length} lieu(x) brut(s) trouvé(s)`);
  } catch (err) {
    spinner.fail(`Erreur Places API : ${err.message}`);
    process.exit(1);
  }

  // 4. Filtrage franchises + limite
  const filtered = rawPlaces
    .filter((p) => !isFranchise(p.name))
    .slice(0, MAX_RESULTS);

  console.log(chalk.dim(`  ${rawPlaces.length - filtered.length} franchise(s) exclue(s) → ${filtered.length} salons à analyser`));

  // 5. Récupération des détails + enrichissement
  console.log(chalk.dim('\n  Récupération des détails (Places Details API)…'));
  const salons = [];

  for (let i = 0; i < filtered.length; i++) {
    const place = filtered[i];
    process.stdout.write(`\r  [${i + 1}/${filtered.length}] ${place.name.slice(0, 40).padEnd(40)}`);

    const details = await getPlaceDetails(place.place_id);
    if (!details) continue;

    // Calcul distance
    const distanceMeters = haversineDistance(
      origin.lat, origin.lng,
      details.geometry?.location?.lat || place.geometry?.location?.lat,
      details.geometry?.location?.lng || place.geometry?.location?.lng
    );

    // Analyse site web
    const webInfo = analyzeWebsite(details.website);

    // Enrichissement CSE optionnel (uniquement si pas de site détecté)
    let cseInfo = null;
    if (WEB_ENRICHMENT && !webInfo.hasSite) {
      cseInfo = await searchWebPresence(details.name, details.formatted_address);
    }

    const hasSite     = webInfo.hasSite || cseInfo?.foundSite || false;
    const isOwnSite   = webInfo.isOwnSite || (cseInfo?.foundSite && !cseInfo?.platforms?.length) || false;
    const platforms   = [...new Set([...webInfo.platforms, ...(cseInfo?.platforms || [])])];

    const salon = {
      place_id:            details.place_id,
      name:                details.name,
      address:             details.formatted_address,
      phone:               details.formatted_phone_number || null,
      rating:              details.rating || null,
      user_ratings_total:  details.user_ratings_total || 0,
      distance_meters:     distanceMeters,
      hasSite,
      isOwnSite,
      platforms,
      websiteUrl:          details.website || null,
      google_maps_url:     details.url || `https://maps.google.com/?place_id=${details.place_id}`,
    };

    const { score, priority, reasons } = computeScore(salon);
    salons.push({ ...salon, score, priority, reasons });
  }

  console.log('\n');

  // 6. Filtrage final : exclure ceux avec un site propre solide
  const prospects = salons.filter((s) => !(s.isOwnSite && s.user_ratings_total > 50));

  // 7. Classement
  const ranked = rankSalons(prospects);

  // 8. Affichage résumé
  printSummary(ranked, chalk);

  // 9. Export
  const label = address.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  const { jsonPath, csvPath } = saveResults(ranked, `barbers_${label}`);

  console.log('\n' + chalk.bold('  Fichiers générés :'));
  console.log(`  JSON : ${chalk.cyan(jsonPath)}`);
  console.log(`  CSV  : ${chalk.cyan(csvPath)}`);
  console.log(chalk.dim('\n  Ouvrir le CSV dans Excel / Google Sheets pour le filtrage.\n'));
}

main().catch((err) => {
  console.error(chalk.red('\n✗ Erreur fatale :'), err.message);
  process.exit(1);
});
