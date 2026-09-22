# Type-check the codebase under strict mode, but only fail on errors in the
# files listed in tsconfig.strict.json's "include" (tsc still walks their
# transitive dependencies, so errors from not-yet-migrated files are expected
# and filtered out here).
echo "Running strict TypeScript check on files listed in tsconfig.strict.json..."

PATTERN_FILE=$(mktemp)
grep -v '^\s*//' tsconfig.strict.json | jq -r '.include[]' > "$PATTERN_FILE"

MATCHES=$(npx tsc --project tsconfig.strict.json --noEmit 2>&1 | grep -F -f "$PATTERN_FILE")
rm -f "$PATTERN_FILE"

if [ -n "$MATCHES" ]; then
  echo "$MATCHES"
  echo "❌ Strict mode errors found in one or more included files."
  exit 1
fi

echo "✅ No strict mode errors in included files."
