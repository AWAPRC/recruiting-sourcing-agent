# push.ps1 - one-command push for the recruiting-sourcing-agent repo
# Run this from inside the repo folder: .\push.ps1

Write-Host "Adding changes..."
git add -A

$staged = git diff --cached --name-only
if ($staged) {
    git commit -m "Update data $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
} else {
    Write-Host "Nothing to commit."
}

Write-Host "Pulling latest..."
git pull

Write-Host "Pushing..."
git push

Write-Host "Done. Now go run the workflow in GitHub Actions."
