# Replace real Anthropic key with placeholder in .env.example (used during git rebase edit)
# Uses a pattern so no real key is ever stored in this file.
$path = "apps/web/.env.example"
if (Test-Path $path) {
  $content = Get-Content $path -Raw
  $content = $content -replace 'sk-ant-api03-[^"]+', 'sk-ant-xxx'
  Set-Content $path $content -NoNewline
}
