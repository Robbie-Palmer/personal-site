import {
  loadPredictions,
  loadParams,
  CANONICALIZATION_DECISIONS_PATH,
  CANONICALIZED_PREDICTIONS_PATH,
  writeJson,
} from "../lib/io.js";
import { canonicalizePredictions } from "../lib/canonicalization.js";

async function main() {
  console.log("Loading predictions and canonical registries...");
  const [predictions, pipelineParams] = await Promise.all([
    loadPredictions(),
    loadParams(),
  ]);

  const { canonicalized, decisions } = await canonicalizePredictions({
    predictions,
    canonicalizeParams: pipelineParams.canonicalize,
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  await Promise.all([
    writeJson(CANONICALIZED_PREDICTIONS_PATH, canonicalized),
    writeJson(CANONICALIZATION_DECISIONS_PATH, decisions),
  ]);
  console.log(
    `Canonicalized ${canonicalized.entries.length} entries → ${CANONICALIZED_PREDICTIONS_PATH}`,
  );
  console.log(`Canonicalization decisions written to ${CANONICALIZATION_DECISIONS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
