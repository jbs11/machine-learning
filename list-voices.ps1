Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
Write-Host "=== SAPI5 Voices ==="
$synth.GetInstalledVoices() | ForEach-Object {
  Write-Host "$($_.VoiceInfo.Name) | $($_.VoiceInfo.Gender) | $($_.VoiceInfo.Culture)"
}
$synth.Dispose()

Write-Host ""
Write-Host "=== WinRT Neural Voices ==="
try {
  [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime] | Out-Null
  $voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
  $voices | ForEach-Object { Write-Host "$($_.DisplayName) | $($_.Gender) | $($_.Language)" }
} catch {
  Write-Host "WinRT not available: $($_.Exception.Message)"
}
