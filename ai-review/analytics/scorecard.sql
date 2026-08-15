SET preserve_insertion_order = false;
SET threads = 1;

CREATE TABLE raw_objects AS
SELECT json, filename
FROM read_json_objects([__INPUT_FILES__], filename = true);

CREATE TEMP TABLE invalid_objects AS
SELECT filename, json_extract_string(json, '$.schemaVersion') AS schema_version,
       json_extract_string(json, '$.recordType') AS record_type
FROM raw_objects
WHERE try_cast(json_extract_string(json, '$.schemaVersion') AS INTEGER) IS DISTINCT FROM 2
   OR json_extract_string(json, '$.recordType') IS NULL
   OR json_extract_string(json, '$.recordType') NOT IN
      ('review-run-terminal', 'finding-interaction-evidence', 'finding-outcome', 'replay-manifest');

SELECT CASE WHEN count(*) = 0 THEN 1 ELSE error(
  'Unknown schema version or record type: ' || string_agg(filename || ' (' || coalesce(schema_version, 'null') || ', ' || coalesce(record_type, 'null') || ')', ', ')
) END FROM invalid_objects;

CREATE TABLE review_runs AS
SELECT
  json_extract_string(json, '$.workflow.instanceId') AS run_id,
  json_extract_string(json, '$.repository') AS repository,
  cast(json_extract_string(json, '$.pullRequestNumber') AS INTEGER) AS pull_request_number,
  json_extract_string(json, '$.headSha') AS head_sha,
  json_extract_string(json, '$.status') AS status,
  json_extract_string(json, '$.promptVersion') AS prompt_version,
  json_extract_string(json, '$.pullRequest.taskType') AS task_type,
  json_extract_string(json, '$.pullRequest.originatingAgent') AS originating_agent,
  json_extract_string(json, '$.workflow.triggeredAt')::TIMESTAMPTZ AS triggered_at,
  coalesce(try_cast(json_extract_string(json, '$.change.additions') AS BIGINT), 0) AS additions,
  coalesce(try_cast(json_extract_string(json, '$.change.deletions') AS BIGINT), 0) AS deletions,
  coalesce(try_cast(json_extract_string(json, '$.change.changedFiles') AS BIGINT), 0) AS changed_files,
  coalesce(try_cast(json_extract_string(json, '$.coverage.totalHunks') AS BIGINT), 0) AS total_hunks,
  coalesce(json_array_length(json_extract(json, '$.coverage.reviewedHunkIds')), 0) AS reviewed_hunks,
  coalesce(try_cast(json_extract_string(json, '$.runCostUsd') AS DOUBLE), 0) AS run_cost_usd,
  json_extract(json, '$.change.riskSignals') AS risk_signals,
  json_extract(json, '$.change.repositoryAreas') AS repository_areas,
  json_extract(json, '$.findings.published') AS published_findings,
  json_extract(json, '$.models') AS models
FROM raw_objects WHERE json_extract_string(json, '$.recordType') = 'review-run-terminal';

SELECT CASE WHEN count(*) = 0 THEN 1 ELSE error('Review runs require non-null unique workflow instance IDs') END
FROM (SELECT run_id FROM review_runs GROUP BY run_id HAVING run_id IS NULL OR count(*) > 1);

CREATE TABLE finding_history AS
SELECT
  json_extract_string(json, '$.repository') AS repository,
  cast(json_extract_string(json, '$.pullRequestNumber') AS INTEGER) AS pull_request_number,
  json_extract_string(json, '$.findingId') AS finding_id,
  cast(json_extract_string(json, '$.outcomeVersion') AS INTEGER) AS outcome_version,
  json_extract_string(json, '$.outcome') AS outcome,
  json_extract_string(json, '$.basis') AS outcome_basis,
  json_extract_string(json, '$.occurredAt')::TIMESTAMPTZ AS outcome_at
FROM raw_objects WHERE json_extract_string(json, '$.recordType') = 'finding-outcome';

SELECT CASE WHEN count(*) = 0 THEN 1 ELSE error('Outcome revisions require positive, unique versions') END
FROM (SELECT repository, pull_request_number, finding_id, outcome_version FROM finding_history
      GROUP BY ALL HAVING outcome_version IS NULL OR outcome_version < 1 OR count(*) > 1);

CREATE TABLE published_findings AS
SELECT r.run_id, r.repository, r.pull_request_number, r.head_sha, r.prompt_version, r.triggered_at,
       json_extract_string(f.value, '$.findingId') AS finding_id,
       json_extract_string(f.value, '$.file') AS file,
       json_extract_string(f.value, '$.severity') AS severity,
       json_extract_string(f.value, '$.title') AS title,
       json_extract(f.value, '$.source_models') AS source_models
FROM review_runs r, LATERAL json_each(coalesce(r.published_findings, '[]'::JSON)) f
WHERE r.status = 'published';

SELECT CASE WHEN count(*) = 0 THEN 1 ELSE error('Outcome/evidence references a finding that was never published') END
FROM (
  SELECT h.finding_id FROM finding_history h LEFT JOIN published_findings p
    USING (repository, pull_request_number, finding_id) WHERE p.finding_id IS NULL
  UNION ALL
  SELECT json_extract_string(e.json, '$.findingId')
  FROM raw_objects e LEFT JOIN published_findings p
    ON p.repository = json_extract_string(e.json, '$.repository')
   AND p.pull_request_number = cast(json_extract_string(e.json, '$.pullRequestNumber') AS INTEGER)
   AND p.finding_id = json_extract_string(e.json, '$.findingId')
  WHERE json_extract_string(e.json, '$.recordType') = 'finding-interaction-evidence' AND p.finding_id IS NULL
);

CREATE TABLE finding_latest AS
WITH first_publication AS (
  SELECT * EXCLUDE (rn) FROM (SELECT *, row_number() OVER (PARTITION BY repository, pull_request_number, finding_id ORDER BY triggered_at, run_id) rn FROM published_findings) WHERE rn = 1
), latest_outcome AS (
  SELECT * EXCLUDE (rn) FROM (SELECT *, row_number() OVER (PARTITION BY repository, pull_request_number, finding_id ORDER BY outcome_version DESC) rn FROM finding_history) WHERE rn = 1
)
SELECT p.*, o.outcome_version, o.outcome, o.outcome_basis, o.outcome_at,
       o.outcome IN ('confirmed-fixed', 'acknowledged') AS accepted,
       o.outcome = 'confirmed-fixed' AS fixed,
       o.outcome = 'rejected' AS rejected,
       o.outcome = 'no-observable-response' OR o.outcome IS NULL AS no_response,
       date_diff('millisecond', p.triggered_at, o.outcome_at) AS outcome_latency_ms
FROM first_publication p LEFT JOIN latest_outcome o USING (repository, pull_request_number, finding_id);

CREATE TABLE review_run_fact AS
WITH finding_counts AS (
  SELECT run_id,
    count(*) FILTER (WHERE accepted) AS accepted_count,
    count(*) FILTER (WHERE fixed) AS fixed_count,
    count(*) FILTER (WHERE rejected) AS rejected_count,
    count(*) FILTER (WHERE no_response) AS no_response_count
  FROM finding_latest GROUP BY run_id
)
SELECT r.* EXCLUDE (published_findings, models),
  additions + deletions AS change_size,
  CASE WHEN additions + deletions < 50 THEN 'small' WHEN additions + deletions < 250 THEN 'medium' ELSE 'large' END AS change_size_band,
  coalesce(json_array_length(r.published_findings), 0) AS published_finding_count,
  coalesce(f.accepted_count, 0) AS accepted_finding_count,
  coalesce(f.fixed_count, 0) AS fixed_finding_count,
  coalesce(f.rejected_count, 0) AS rejected_finding_count,
  coalesce(f.no_response_count, 0) AS no_response_finding_count,
  CASE WHEN total_hunks = 0 THEN NULL ELSE reviewed_hunks::DOUBLE / total_hunks END AS coverage_rate,
  CASE WHEN coalesce(f.accepted_count, 0) = 0 THEN NULL ELSE run_cost_usd / f.accepted_count END AS cost_per_accepted_finding,
  CASE WHEN coalesce(f.accepted_count, 0) + coalesce(f.rejected_count, 0) = 0 THEN NULL ELSE f.accepted_count::DOUBLE / (f.accepted_count + f.rejected_count) END AS acceptance_rate,
  CASE WHEN coalesce(json_array_length(r.published_findings), 0) = 0 THEN NULL ELSE coalesce(f.fixed_count, 0)::DOUBLE / json_array_length(r.published_findings) END AS fix_through_rate,
  CASE WHEN coalesce(json_array_length(r.published_findings), 0) = 0 THEN NULL ELSE coalesce(f.rejected_count, 0)::DOUBLE / json_array_length(r.published_findings) END AS noise_rate,
  CASE WHEN coalesce(json_array_length(r.published_findings), 0) = 0 THEN NULL ELSE coalesce(f.no_response_count, 0)::DOUBLE / json_array_length(r.published_findings) END AS no_response_rate
FROM review_runs r LEFT JOIN finding_counts f USING (run_id);

CREATE TABLE model_run_fact AS
WITH model_rows AS (
SELECT r.run_id, r.repository, r.pull_request_number, r.head_sha, r.prompt_version, r.triggered_at,
  json_extract_string(m.value, '$.model') AS model,
  json_extract_string(m.value, '$.provider') AS provider,
  json_extract_string(m.value, '$.role') AS role,
  cast(json_extract_string(m.value, '$.ok') AS BOOLEAN) AS ok,
  coalesce(try_cast(json_extract_string(m.value, '$.latencyMs') AS BIGINT), 0) AS latency_ms,
  coalesce(try_cast(json_extract_string(m.value, '$.costUsd') AS DOUBLE), 0) AS cost_usd,
  coalesce(try_cast(json_extract_string(m.value, '$.usage.inputTokens') AS BIGINT), 0) AS input_tokens,
  coalesce(try_cast(json_extract_string(m.value, '$.usage.cachedInputTokens') AS BIGINT), 0) AS cached_input_tokens,
  coalesce(try_cast(json_extract_string(m.value, '$.usage.outputTokens') AS BIGINT), 0) AS output_tokens,
  r.risk_signals, r.repository_areas, rf.change_size_band
FROM review_runs r JOIN review_run_fact rf USING (run_id), LATERAL json_each(coalesce(r.models, '[]'::JSON)) m
), attributed AS (
SELECT m.run_id, m.model, count(*) FILTER (WHERE f.accepted) AS accepted_count
FROM model_rows m LEFT JOIN finding_latest f
  ON f.run_id = m.run_id AND json_contains(coalesce(f.source_models, '[]'::JSON), to_json(m.model))
GROUP BY m.run_id, m.model
)
SELECT m.*,
  input_tokens - cached_input_tokens AS uncached_input_tokens,
  CASE WHEN input_tokens = 0 THEN NULL ELSE cached_input_tokens::DOUBLE / input_tokens END AS cache_hit_rate,
  CASE WHEN input_tokens - cached_input_tokens = 0 THEN NULL ELSE a.accepted_count * 1000000.0 / (input_tokens - cached_input_tokens) END AS accepted_findings_per_million_uncached_tokens
FROM model_rows m JOIN attributed a USING (run_id, model);

CREATE TABLE pull_request_fact AS
SELECT repository, pull_request_number,
  min(triggered_at) AS first_review_at, max(triggered_at) AS last_review_at,
  count(*) AS review_run_count, sum(run_cost_usd) AS total_cost_usd,
  sum(published_finding_count) AS published_finding_count,
  sum(accepted_finding_count) AS accepted_finding_count,
  sum(fixed_finding_count) AS fixed_finding_count,
  sum(rejected_finding_count) AS rejected_finding_count,
  sum(no_response_finding_count) AS no_response_finding_count,
  sum(reviewed_hunks) AS reviewed_hunks, sum(total_hunks) AS total_hunks,
  CASE WHEN sum(total_hunks) = 0 THEN NULL ELSE sum(reviewed_hunks)::DOUBLE / sum(total_hunks) END AS coverage_rate,
  CASE WHEN sum(accepted_finding_count) = 0 THEN NULL ELSE sum(run_cost_usd) / sum(accepted_finding_count) END AS cost_per_accepted_finding,
  min(prompt_version) AS prompt_version, min(task_type) AS task_type, min(originating_agent) AS originating_agent
FROM review_run_fact GROUP BY repository, pull_request_number;
