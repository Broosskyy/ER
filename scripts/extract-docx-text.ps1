param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [int]$MaxChars = 12000
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path $Path)) {
  Write-Output "NOT_FOUND: $Path"
  exit 1
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' } | Select-Object -First 1
if (-not $entry) {
  $zip.Dispose()
  Write-Output "NO_DOCUMENT_XML: $Path"
  exit 1
}

$reader = New-Object System.IO.StreamReader($entry.Open())
$xml = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()

$matches = [regex]::Matches($xml, '<w:t[^>]*>([^<]*)</w:t>')
$text = ($matches | ForEach-Object { $_.Groups[1].Value }) -join ' '
$text = [regex]::Replace($text, '\s+', ' ').Trim()

if ($text.Length -gt $MaxChars) {
  $text = $text.Substring(0, $MaxChars)
}

Write-Output "=== $Path ==="
Write-Output $text
