# Git rebase todo editor: change "pick b7e5097" to "edit b7e5097"
param([string]$TodoPath = $args[0])
$content = Get-Content $TodoPath -Raw
$content = $content -replace '^pick b7e5097 ', 'edit b7e5097 '
Set-Content $TodoPath $content -NoNewline
