# Data Synchronization Scripts

The system makes use of several externally managed data sources. These sources need to be periodically synchronized with the Apollo Server.

To add a new synchronization script, add a new file here and then add an NPM script to the `package.json` file in the root of the project that will run the script.

The AWS environment has a scheduled ECS task that runs these scripts. Once you've added your new script, to this directory and the NPM script, you will need to add a line to the `src/dataSync/start.sh` file in the [dmptool-infrastructure repo](https://github.com/CDLUC3/dmptool-apollo-server#) that runs the NPM script. Then run the `build_publish.sh` script in that same directory to deploy the updated image to the AWS ECR.

Be sure to add any new ENV variables you may need to the `config/[env]/ecs/dataSync.yaml` file in the dmptool-infrastructure repo!

The scripts can be run manually as well. See the documentation in that dmptool-infrastructure repo for more details.

## re3data repositories

This README explains the `re3data-os-populate.ts` migration script found in `data-migrations/`.

Purpose
- Sync repository metadata from the re3data API (`https://www.re3data.org/api/v1`) into OpenSearch.
- Uses a blue-green deployment strategy for indices: creates a new index with a numeric suffix using a configured prefix (default `re3data-idx` → `re3data-idx1`, `re3data-idx2`, ...). After indexing completes, it atomically swaps the alias (default `re3data`) to point to the new index and deletes old prefix-matching indices.

Why blue-green?
- Zero-downtime swaps: the alias is updated atomically so consumers using the alias see no partial data.
- Allows a safe full reindex and then swap when ready.

Key behaviors
- Creates a new index using the configured prefix and the next numeric suffix.
- Indexes documents in bulk.
- After successful indexing, atomically updates alias to the new index and removes old indices matching the prefix.
- Has a `--dry-run` mode that prints what it would do (index creation and alias updates are skipped).
- Verbose logging via `--verbose`.

CLI options
The script accepts the following options (also available via environment variables for some):

- `--node` (string) — OpenSearch node URL. Equivalent env var: `OPENSEARCH_NODE`. Default: `http://localhost:9200`.
- `--index` (string) — Index name prefix. Equivalent env var: `OPENSEARCH_INDEX`. Default: `re3data-idx`.
- `--alias` (string) — Alias name to swap. Equivalent env var: `OPENSEARCH_ALIAS`. Default: `re3data`.
- `--batch-size` (number) — Bulk batch size for OpenSearch. Default: `100`.
- `--limit` (number) — Limit the number of repositories processed (helpful for testing).
- `--dry-run` (flag) — Do not create index, do not update aliases or delete old indices; instead print the actions that would be taken.
- `--verbose` (flag) — More logging.

Environment variables
- `RE3DATA_API_BASE` — change the re3data API base URL (default `https://www.re3data.org/api/v1`).
- `OPENSEARCH_NODE` — OpenSearch endpoint (overridable via `--node`).
- `OPENSEARCH_INDEX` — Index prefix (overridable via `--index`).
- `OPENSEARCH_ALIAS` — Alias name (overridable via `--alias`).
- `OPENSEARCH_BATCH_SIZE` — Batch size default (overridable via `--batch-size`).

Examples

1) Dry-run: show what will happen (safe):

```bash
# Dry-run: processes only 1 repo, prints alias actions and does not create indices
npm run re3data:sync -- --dry-run --limit=1 --verbose
```

Output will include a selected new index name and alias actions (e.g., remove old prefix indices then add alias to new index).

2) Real run: index data and swap alias (destructive changes to OpenSearch indices):

```bash
# Note: Ensure OPENSEARCH_NODE is reachable and writable. This will create an index and delete old ones.
npm run re3data:sync -- --limit=0 --node=http://localhost:9200 --index=re3data-idx --alias=re3data
```

- `--limit=0` means no artificial limit — the script will process all repositories returned by the API. Use caution when running without `--dry-run`.

3) Use environment variables instead of CLI options:

```bash
export OPENSEARCH_NODE=http://localhost:9200
export OPENSEARCH_INDEX=re3data-idx
export OPENSEARCH_ALIAS=re3data
npm run re3data:sync -- --dry-run --limit=10 --verbose
```

Integration / dry-run test
- The script's `--dry-run` option acts as an integration smoke test: it will select a next index name, fetch the repository list, prepare documents, and print the alias actions it would perform.
- For a repeatable integration test that does not touch a live OpenSearch instance, run with `--dry-run` and `--limit` small.

Notes & best practices
- The script attempts to be defensive: when swapping aliases it only removes alias from indices that start with the configured prefix to avoid touching unrelated indices.
- Cleanup removes all old prefix-matching indices after alias swap. If you'd prefer to keep the previous index for quick rollback, update `swapAliasToNewIndex` to preserve the most recent previous index (or implement a `--keep-old N` option).
- Running the full script (no `--dry-run`) will create and delete indices in OpenSearch. Ensure you have backups or are operating on a staging cluster if you want to be cautious.

Troubleshooting
- "Index creation failed" or OpenSearch errors: Verify `OPENSEARCH_NODE` is correct and reachable. Check OpenSearch logs for details.
- If `--dry-run` shows alias actions that reference unexpected indices, verify the `--index` prefix and existing indices in OpenSearch.
