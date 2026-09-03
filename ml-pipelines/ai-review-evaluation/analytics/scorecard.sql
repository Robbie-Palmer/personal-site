SET preserve_insertion_order = false;
SET threads = 1;

CREATE TABLE replay_observation AS
SELECT * FROM read_ndjson_auto('__OBSERVATIONS__');

COPY (
  SELECT * FROM replay_observation
  ORDER BY variant_role, variant_id, corpus_id, repetition
) TO '__PARQUET__' (FORMAT PARQUET, COMPRESSION uncompressed);

COPY (
  WITH per_corpus AS (
    SELECT
      variant_id,
      corpus_id,
      stddev_samp(accepted_finding_count) FILTER (WHERE completed) AS accepted_findings_repetition_stddev,
      stddev_samp(
        CASE WHEN completed AND accepted_finding_count + rejected_finding_count > 0
          THEN rejected_finding_count::DOUBLE / (accepted_finding_count + rejected_finding_count) END
      ) AS noise_rate_repetition_stddev,
      stddev_samp(
        CASE WHEN completed AND historical_adjudicated_count > 0
          THEN historical_matched_count::DOUBLE / historical_adjudicated_count END
      ) AS historical_coverage_rate_repetition_stddev,
      stddev_samp(latency_ms) FILTER (WHERE executed) AS latency_ms_repetition_stddev,
      stddev_samp(cost_usd) FILTER (WHERE executed) AS cost_usd_repetition_stddev
    FROM replay_observation
    GROUP BY variant_id, corpus_id
  ),
  variant_repetition_variance AS (
    SELECT
      variant_id,
      avg(accepted_findings_repetition_stddev) AS accepted_findings_repetition_stddev_mean,
      avg(noise_rate_repetition_stddev) AS noise_rate_repetition_stddev_mean,
      avg(historical_coverage_rate_repetition_stddev) AS historical_coverage_rate_repetition_stddev_mean,
      avg(latency_ms_repetition_stddev) AS latency_ms_repetition_stddev_mean,
      avg(cost_usd_repetition_stddev) AS cost_usd_repetition_stddev_mean,
      count(*) FILTER (WHERE accepted_findings_repetition_stddev IS NOT NULL) AS corpus_items_with_accepted_findings_repetition_variance
    FROM per_corpus
    GROUP BY variant_id
  ),
  per_pull_request AS (
    SELECT
      variant_id,
      pull_request_number,
      avg(accepted_finding_count) FILTER (WHERE completed) AS accepted_findings_per_replay,
      (sum(accepted_finding_count) FILTER (WHERE completed))::DOUBLE
        / nullif(sum(accepted_finding_count + rejected_finding_count) FILTER (WHERE completed), 0) AS acceptance_rate,
      (sum(rejected_finding_count) FILTER (WHERE completed))::DOUBLE
        / nullif(sum(accepted_finding_count + rejected_finding_count) FILTER (WHERE completed), 0) AS noise_rate,
      (sum(historical_matched_count) FILTER (WHERE completed))::DOUBLE
        / nullif(sum(historical_adjudicated_count) FILTER (WHERE completed), 0) AS historical_coverage_rate,
      (sum(provider_failure_count) FILTER (WHERE executed))::DOUBLE
        / nullif(sum(provider_call_count) FILTER (WHERE executed), 0) AS provider_failure_rate,
      avg(latency_ms) FILTER (WHERE executed) AS mean_latency_ms,
      avg(cost_usd) FILTER (WHERE executed) AS mean_cost_usd_per_replay
    FROM replay_observation
    GROUP BY variant_id, pull_request_number
  ),
  variant_pull_request_metrics AS (
    SELECT
      variant_id,
      avg(accepted_findings_per_replay) AS accepted_findings_per_replay,
      avg(acceptance_rate) AS acceptance_rate,
      avg(noise_rate) AS noise_rate,
      avg(historical_coverage_rate) AS historical_coverage_rate,
      avg(provider_failure_rate) AS provider_failure_rate,
      avg(mean_latency_ms) AS mean_latency_ms,
      avg(mean_cost_usd_per_replay) AS mean_cost_usd_per_replay,
      stddev_samp(accepted_findings_per_replay) AS accepted_findings_between_pull_request_stddev
    FROM per_pull_request
    GROUP BY variant_id
  )
  SELECT
    replay.variant_id,
    any_value(variant_role) AS variant_role,
    any_value(model) AS model,
    any_value(provider) AS provider,
    count(*) AS replay_records,
    count(*) FILTER (WHERE executed) AS executed_replays,
    count(*) FILTER (WHERE completed) AS completed_replays,
    count(*) FILTER (WHERE executed AND NOT completed) AS incomplete_replays,
    count(DISTINCT pull_request_number) FILTER (WHERE completed) AS completed_pull_requests,
    count(*) FILTER (WHERE replay_status = 'planned') AS planned_replays,
    sum(candidate_finding_count) FILTER (WHERE completed) AS candidate_findings,
    sum(accepted_finding_count) FILTER (WHERE completed) AS accepted_findings,
    sum(rejected_finding_count) FILTER (WHERE completed) AS rejected_findings,
    sum(censored_finding_count) FILTER (WHERE completed) AS censored_findings,
    sum(no_response_finding_count) FILTER (WHERE completed) AS no_response_findings,
    sum(unmatched_finding_count) FILTER (WHERE completed) AS unmatched_findings,
    sum(manual_adjudication_count) FILTER (WHERE completed) AS manual_adjudications_required,
    sum(historical_adjudicated_count) FILTER (WHERE completed) AS historical_adjudicated_findings,
    sum(historical_matched_count) FILTER (WHERE completed) AS historical_matched_findings,
    any_value(pull_request_metrics.accepted_findings_per_replay) AS accepted_findings_per_replay,
    any_value(pull_request_metrics.acceptance_rate) AS acceptance_rate,
    any_value(pull_request_metrics.noise_rate) AS noise_rate,
    any_value(pull_request_metrics.historical_coverage_rate) AS historical_coverage_rate,
    any_value(pull_request_metrics.provider_failure_rate) AS provider_failure_rate,
    sum(input_tokens) FILTER (WHERE executed) AS input_tokens,
    sum(output_tokens) FILTER (WHERE executed) AS output_tokens,
    sum(cached_input_tokens) FILTER (WHERE executed) AS cached_input_tokens,
    sum(cost_usd) FILTER (WHERE executed) AS cost_usd,
    any_value(pull_request_metrics.mean_cost_usd_per_replay) AS mean_cost_usd_per_replay,
    any_value(pull_request_metrics.mean_latency_ms) AS mean_latency_ms,
    count(*) FILTER (WHERE completed AND coverage_missing) AS missing_coverage_replays,
    any_value(variance.accepted_findings_repetition_stddev_mean) AS accepted_findings_repetition_stddev_mean,
    any_value(variance.noise_rate_repetition_stddev_mean) AS noise_rate_repetition_stddev_mean,
    any_value(variance.historical_coverage_rate_repetition_stddev_mean) AS historical_coverage_rate_repetition_stddev_mean,
    any_value(variance.latency_ms_repetition_stddev_mean) AS latency_ms_repetition_stddev_mean,
    any_value(variance.cost_usd_repetition_stddev_mean) AS cost_usd_repetition_stddev_mean,
    any_value(variance.corpus_items_with_accepted_findings_repetition_variance) AS corpus_items_with_accepted_findings_repetition_variance,
    any_value(pull_request_metrics.accepted_findings_between_pull_request_stddev) AS accepted_findings_between_pull_request_stddev
  FROM replay_observation AS replay
  LEFT JOIN variant_repetition_variance AS variance USING (variant_id)
  LEFT JOIN variant_pull_request_metrics AS pull_request_metrics USING (variant_id)
  GROUP BY replay.variant_id
  ORDER BY variant_role, variant_id
) TO '__SUMMARY__' (FORMAT JSON, ARRAY true);
