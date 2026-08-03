# Run Trivy to check for vulnerabilities in the filesystem
echo "Running Trivy high/critical vulnerability scan..."
trivy fs --exit-code 1 --skip-dirs docker/mysql --skip-dirs docker/ --severity HIGH,CRITICAL . || {
  echo "Trivy found high/critical vulnerabilities. Commit aborted."
  exit 1
}
