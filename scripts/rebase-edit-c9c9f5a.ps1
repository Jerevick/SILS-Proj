# Git rebase todo editor: change "pick c9c9f5a" to "edit c9c9f5a"
param([string]$TodoPath = $args[0])
$content = Get-Content $TodoPath -Raw
$content = $content -replace '^pick c9c9f5a ', 'edit c9c9f5a '
Set-Content $TodoPath $content -NoNewline
