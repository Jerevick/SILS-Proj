# Git rebase todo editor: change "pick f4ef9ce" to "edit f4ef9ce" so we can fix the secret
param([string]$TodoPath = $args[0])
$content = Get-Content $TodoPath -Raw
$content = $content -replace '^pick f4ef9ce ', 'edit f4ef9ce '
Set-Content $TodoPath $content -NoNewline
