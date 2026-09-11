# Writing editor domain

This package implements version 1 of the Agent-first Writing Editor record
contract. It gives rule and model producers one runtime-validated format for
local suggestions, grouped proposals, and review decisions.

The contract uses half-open UTF-8 byte spans. A producer must hash the exact
source bytes it inspected and copy the text covered by each span. Consumers
call `verifySuggestionSource` or `verifyProposalSource` before showing or
applying a record. A mismatch is a conflict. Consumers must not remap a stale
span without recording a separate migration. A migrated proposal stores the old
ID in `migratedFromProposalId`.

`createSuggestion` and `createProposal` calculate IDs from canonical JSON and
SHA-256. A suggestion ID covers the producer, source revision, span, category,
and replacement. A proposal ID covers its canonically ordered member IDs.
Reasons, confidence, and detailed provenance remain editable metadata and do
not change record identity.

Canonical JSON recursively sorts object keys by UTF-16 code unit and preserves
array order. It uses JavaScript's JSON encoding for finite numbers, strings,
booleans, and null, then hashes the resulting UTF-8 bytes. Identity payloads do
not accept `undefined`, non-finite numbers, or objects with custom prototypes.
The tests contain fixed hashes so another language can verify its encoder.

Decisions embed the complete proposal. This keeps the ordered member IDs,
original suggestions, producer versions, and source revision beside the
accepted, rejected, or changed outcome.
