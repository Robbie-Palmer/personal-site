WITH stateless_runs AS (
  SELECT *
  FROM read_parquet('__REVIEW_RUN_FACT__')
  WHERE record_schema_version = 1
), stateless_models AS (
  SELECT *
  FROM read_parquet('__MODEL_RUN_FACT__')
  WHERE record_schema_version = 1
), totals AS (
  SELECT
    count(DISTINCT (repository, pull_request_number)) AS pull_requests,
    count(*) AS review_runs
  FROM stateless_runs
), model_totals AS (
  SELECT
    count(*) AS model_calls,
    coalesce(sum(uncached_input_tokens), 0) AS uncached_input_tokens
  FROM stateless_models
)
SELECT
  pull_requests,
  review_runs,
  model_calls,
  uncached_input_tokens,
  model_calls::DOUBLE / pull_requests AS model_calls_per_pull_request,
  uncached_input_tokens::DOUBLE / pull_requests AS uncached_input_tokens_per_pull_request
FROM totals, model_totals
WHERE pull_requests > 0 AND review_runs > 0;
