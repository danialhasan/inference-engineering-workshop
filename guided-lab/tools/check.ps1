# Pre-event setup check for Windows PowerShell 5+. Changes nothing on your machine.
# NOT tested by the author (no Windows machine was available). The Setup tab in the lab runs the same checks.
# Usage: powershell -ExecutionPolicy Bypass -File tools\check.ps1 [-Base http://127.0.0.1:11434] [-Model qwen2.5:1.5b]
param([string]$Base = "http://127.0.0.1:11434", [string]$Model = "qwen2.5:1.5b")
$fail = $false
Write-Host "Inference workshop setup check"
Write-Host "  server: $Base   model: $Model"
try {
  $v = Invoke-RestMethod -Uri "$Base/api/version" -TimeoutSec 5
  Write-Host "  [ok]   server answers, version $($v.version)"
} catch {
  Write-Host "  [FAIL] no answer from $Base. Start Ollama from the Start menu and try again."
  $fail = $true
}
if (-not $fail) {
  $tags = Invoke-RestMethod -Uri "$Base/api/tags" -TimeoutSec 5
  if ($tags.models | Where-Object { $_.name -eq $Model }) {
    Write-Host "  [ok]   $Model is installed"
  } else {
    Write-Host "  [FAIL] $Model is not installed. With a good connection run: ollama pull $Model   (about 1 GB)"
    $fail = $true
  }
}
if (-not $fail) {
  $body = @{ model = $Model; prompt = "Count from one to twenty in words."; stream = $false; options = @{ num_predict = 32; temperature = 0 } } | ConvertTo-Json -Depth 4
  try {
    $r = Invoke-RestMethod -Uri "$Base/api/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 180
    $tps = [math]::Round($r.eval_count / ($r.eval_duration / 1e9))
    Write-Host "  [ok]   $($r.eval_count) tokens at $tps tokens per second, measured on this laptop just now"
  } catch {
    Write-Host "  [FAIL] generation failed: $($_.Exception.Message)"
    $fail = $true
  }
}
if ((Get-Command py -ErrorAction SilentlyContinue) -or (Get-Command python -ErrorAction SilentlyContinue) -or (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  [ok]   Python or Node found (start.bat will use it)"
} else {
  Write-Host "  [FAIL] neither Python nor Node found; the live lab page cannot be served. Recorded data still works."
  $fail = $true
}
if ($fail) {
  Write-Host "NOT READY for the live path. Fix the FAIL lines while you have a good connection, or use recorded data on the day."
  exit 1
} else {
  Write-Host "READY for the live path. Switch Wi-Fi off and run this once more to prove it works offline."
}
