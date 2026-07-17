# Database operations

The recipe database uses the TypeScript schema in
`packages/recipe-db/src/schema.ts` as its model and committed Drizzle SQL
migrations in `workers/recipe-api/drizzle` as its deployment history.
Production and previews run those migrations before deploying the Worker.

## Change the schema

1. Edit `packages/recipe-db/src/schema.ts`.
2. Generate one migration for the coherent change:

   ```bash
   mise run //workers/recipe-api:db:generate -- --name add_recipe_notes
   ```

3. Review both the generated SQL and snapshot. Add explicit SQL for any data
   backfill required by the new shape. Generated SQL is a starting point, not
   an automatically approved change.
4. Run the database package and API checks:

   ```bash
   mise run //packages/recipe-db:check
   mise run //workers/recipe-api:check
   ```

5. Exercise the migration through the PR preview. The preview is a schema-only
   Neon branch with synthetic data, so it does not expose production rows.

Migration files are append-only after they reach `main`. Fix a deployed
migration with a new migration; editing history makes environments disagree
about what a recorded hash means.

Use one migration per deployable domain change, not one per table. For example,
adding a notification subtype and its indexes belongs in one migration. Use an
expand-and-contract sequence across multiple deployments when old and new
Worker versions cannot safely share the final schema.

## Test migrations and database behaviour

Run the real-PostgreSQL integration suite from the repository root:

```bash
mise run //workers/recipe-api:test:integration
```

By default, the task starts a labelled disposable PostgreSQL 17 Docker
container, applies every committed migration, runs the tests, and removes the
container. It covers representative recipe, household/notification, diet, and
import paths with genuine Better Auth sessions. External Cloudflare R2 and
Workflow bindings are stubbed; PostgreSQL and the API handlers are not.

To use an already-disposable PostgreSQL database instead of Docker, both
variables are required:

```bash
TEST_DATABASE_URL=postgresql://... \
ALLOW_INTEGRATION_DATABASE=1 \
mise run //workers/recipe-api:test:integration
```

The explicit opt-in exists because the suite truncates all mutable application
tables between scenarios. Never point it at a shared or production database.
Recipe API CI runs this task separately from the fast unit suite.

## Apply migrations manually

With `DATABASE_URL` set to the intended database:

```bash
mise run //workers/recipe-api:db:migrate
```

Prefer Neon's direct (non-pooled) URL for migration commands so the entire
migration transaction remains on one PostgreSQL connection. Hyperdrive and
pooled URLs remain appropriate for application traffic.

The normal production and preview workflows do this automatically. Do not use
`drizzle-kit push` on shared databases; it has no committed reviewable history
and can apply an unintended diff.

## Manage data

The repository deliberately has three data paths:

| Data kind | Mechanism | Rule |
| --- | --- | --- |
| One-time transform needed by a schema change | SQL in the migration | Runs once and in migration order |
| Required reference data, such as diets and ingredients | SQL data migration | Versioned with the application and applied exactly once |
| Disposable PR test accounts and recipes | Preview seed | Preview environments only |

The initial reference catalog is committed as `0001_diet_catalog.sql`, so a
fresh `db:migrate` produces a usable database without a separate seed command.
For a catalog change, generate a custom migration and write the explicit
inserts, updates, or deletes required to move from the old catalog to the new
one:

```bash
mise run //workers/recipe-api:db:generate -- --custom --name update_diet_catalog
```

Do not edit a catalog migration after it reaches `main`. A later migration is
the audit trail for renamed presets, corrected memberships, and retired values.

To inspect or make a deliberate small correction, set `DATABASE_URL` and open
Drizzle Studio:

```bash
mise run //workers/recipe-api:db:studio
```

Studio is not a substitute for migrations or repeatable seeds. Prefer an
application/admin workflow for routine content management once one exists, so
validation and authorization remain in the write path.

## Deploy and recover

The production workflow runs in this order:

1. apply committed migrations;
2. deploy the Worker.

Keep schema changes backward-compatible with the currently deployed Worker.
For a destructive or difficult-to-reverse migration, create a Neon snapshot
immediately before deployment and note its timestamp in the change record.
Neon's Backup & Restore flow can first restore to a separate branch for
inspection and then finalize a restore while preserving the production
connection string. Prefer a corrective roll-forward migration when the data is
sound; restore only when the migration damaged or removed data.

After any restore, compare the restored `drizzle.__drizzle_migrations` rows with
the checked-in journal before redeploying. Restoring data also restores the
migration history from that point in time, so CD will reapply later committed
migrations.

## Initial baseline

`0000_baseline.sql` captures the complete schema as it existed when migrations
were adopted. It is the only intentionally idempotent migration: that lets the
first production deployment record the baseline over tables previously created
by `drizzle-kit push`, while the same file creates a fresh database from
nothing. It also contains the former canonical-user-email backfill.

Later migrations must be strict. A missing table, column, or constraint should
fail deployment instead of being silently ignored.

Neon schema-only branches copy structure but omit all table rows, including the
Drizzle journal. The preview workflow restores journal entries that existed at
the PR base commit before applying the PR's migrations. If a preview is reused,
its non-empty journal is preserved so it can migrate forward from its actual
older state.
