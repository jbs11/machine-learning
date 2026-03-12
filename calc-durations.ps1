Get-ChildItem 'C:\Users\Stephen\OneDrive\Desktop\Cursor Projects\Machine Learning\public\audio' -Filter *.wav |
Sort-Object Name |
ForEach-Object {
  $bytes       = [System.IO.File]::ReadAllBytes($_.FullName)
  $sampleRate  = [BitConverter]::ToInt32($bytes, 24)
  $channels    = [BitConverter]::ToInt16($bytes, 22)
  $bitsPerSamp = [BitConverter]::ToInt16($bytes, 34)
  $bytesPerSec = $sampleRate * ($bitsPerSamp / 8) * $channels
  $dataBytes   = $bytes.Length - 46
  $durationSec = $dataBytes / $bytesPerSec
  $frames      = [int][Math]::Ceiling($durationSec * 30)
  Write-Host "$($_.Name) -> $frames frames ($([Math]::Round($durationSec,2))s)"
}
