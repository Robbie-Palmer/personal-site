// Moved from package.json so the yaml rule can exclude vendored .vale
// styles. The *.{yml,yaml} lint-staged glob matches yaml by basename in
// every directory (matchBase), including .vale, but the //:lint:yaml task
// ignores .vale and errors with "No YAML files matching your selection"
// when a .vale style is the only yaml staged. Filter them out here.
const yamlLint = (filenames) => {
  const files = filenames.filter((f) => !f.includes('.vale/'))
  return files.length ? `mise run //:lint:yaml -- ${files.join(' ')}` : 'true'
}

export default {
  'ui/**/*.{ts,tsx,js,jsx,json}': ['mise run //ui:format'],
  'infra/**/*.tf': ['mise run //infra:format', 'mise run //infra:precommit-lint', 'mise run //infra:lint:tflint'],
  'infra-bootstrap/**/*.tf': [
    'mise run //infra-bootstrap:format',
    'mise run //infra-bootstrap:precommit-lint',
    'mise run //infra-bootstrap:lint:tflint',
  ],
  '**/*.md': ['mise run //:lint:markdown', 'mise run //:lint:prose:staged'],
  '**/*.mdx': ['mise run //:lint:mdx', 'mise run //:lint:prose:staged'],
  '*.{yml,yaml}': [yamlLint],
  'homelab/**/*.{yml,yaml}': ['mise run //:lint:yaml'],
}
