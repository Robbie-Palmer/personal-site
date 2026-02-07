import { Markdown } from "@/components/markdown";

const SHIKI_DEMO_SOURCE = `
### Python with f-strings and decorators

Notice how decorators, type hints, and nested f-string expressions are all accurately highlighted:

\`\`\`python
from functools import lru_cache
from typing import List, Optional

@lru_cache(maxsize=128)
def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number with memoization."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

def format_results(numbers: List[int]) -> str:
    return f"Fibonacci sequence: {', '.join(f'F({i})={fibonacci(i)}' for i in numbers)}"

# Complex f-string with nested expressions
print(f"Results: {format_results([1, 2, 3, 4, 5])}")
\`\`\`

### SQL with window functions

Observe the precise highlighting of window functions, partitions, and CTEs:

\`\`\`sql
-- Calculate running total and rank by department
SELECT
    employee_id,
    department,
    salary,
    SUM(salary) OVER (
        PARTITION BY department
        ORDER BY hire_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_total,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS salary_rank,
    LAG(salary, 1) OVER (PARTITION BY department ORDER BY hire_date) AS previous_salary
FROM employees
WHERE hire_date >= '2023-01-01'
ORDER BY department, salary_rank;
\`\`\`

### TypeScript with generics and type inference

Generic constraints, async/await, and nullish coalescing are all highlighted correctly:

\`\`\`typescript
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
}

class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private items = new Map<string, T>();

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) ?? null;
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.items.values());
  }

  async save(entity: T): Promise<T> {
    this.items.set(entity.id, entity);
    return entity;
  }
}

// Type inference in action
const userRepo = new InMemoryRepository<{ id: string; name: string }>();
const user = await userRepo.findById('123'); // Type: { id: string; name: string } | null
\`\`\`

### YAML with anchors and merge keys

Complex YAML features like anchors, aliases, and merge keys are precisely tokenized:

\`\`\`yaml
defaults: &defaults
  adapter: postgres
  host: localhost
  pool: 5

development:
  <<: *defaults
  database: myapp_dev

production:
  <<: *defaults
  host: \${DATABASE_HOST}
  database: myapp_prod
  pool: 25
\`\`\`

### Bash with parameter expansion

Shell scripts with parameter expansion, conditionals, and special variables are highlighted correctly:

\`\`\`bash
#!/bin/bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="\${SCRIPT_DIR}/deploy.log"

deploy() {
  local env="\${1:-staging}"
  local version="\${2:-$(git describe --tags --always)}"

  echo "Deploying \${version} to \${env}..." | tee -a "$LOG_FILE"

  if [[ "$env" == "production" ]]; then
    read -rp "Are you sure? [y/N] " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  fi
}

deploy "$@"
\`\`\`
`;

export function ShikiDemo() {
  return <Markdown source={SHIKI_DEMO_SOURCE} />;
}
