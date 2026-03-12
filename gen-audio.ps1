Add-Type -AssemblyName System.Runtime.WindowsRuntime

# WinRT async helper
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($WinRtTask, [Type]$ResultType) {
    $m = $asTaskGeneric.MakeGenericMethod($ResultType)
    $t = $m.Invoke($null, @($WinRtTask))
    $t.Wait(-1) | Out-Null
    $t.Result
}

# Load WinRT types
[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage, ContentType=WindowsRuntime]

$synth = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()

# Select best male neural voice
$voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
$voice  = ($voices | Where-Object { $_.DisplayName -like "*Mark*"  } | Select-Object -First 1)
if (-not $voice) {
    $voice = ($voices | Where-Object { $_.DisplayName -like "*David*" } | Select-Object -First 1)
}
if (-not $voice) {
    $voice = ($voices | Where-Object { $_.Gender -eq [Windows.Media.SpeechSynthesis.VoiceGender]::Male } | Select-Object -First 1)
}
if ($voice) { $synth.Voice = $voice; Write-Host "Voice: $($voice.DisplayName)" }
else { Write-Host "Using default voice" }

# Natural pace -- no artificial pitch shift (lets the neural voice's natural prosody through)
$synth.Options.SpeakingRate = 0.90
$synth.Options.AudioPitch   = 0.0

$dir = "$PSScriptRoot\public\audio"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# SSML template: strategic <break> tags at natural breath/clause boundaries
# This is what makes the voice sound human -- pauses where a real speaker would pause
$H = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><prosody rate='0.9'>"
$F = "</prosody></speak>"

$clips = @(
  @{file="nn-01"; ssml="$H Neural networks are computing systems <break time='150ms'/> modeled after the human brain, <break time='200ms'/> transforming raw inputs into intelligent predictions through layers of interconnected neurons. $F"},
  @{file="nn-02"; ssml="$H Every artificial neuron receives a set of inputs, <break time='100ms'/> multiplies each by a learned weight, <break time='100ms'/> and passes the sum through an activation function <break time='100ms'/> to produce an output signal. $F"},
  @{file="nn-03"; ssml="$H Neurons are organized in layers. <break time='300ms'/> Input layers capture raw data, <break time='150ms'/> while deep hidden layers progressively extract abstract features, <break time='150ms'/> and the output layer delivers final predictions. $F"},
  @{file="nn-04"; ssml="$H During a forward pass, <break time='100ms'/> data flows through each layer in sequence, <break time='100ms'/> as neurons apply their weights and activations, <break time='100ms'/> transforming the signal from one representation to the next. $F"},
  @{file="nn-05"; ssml="$H Training adjusts every weight using backpropagation, <break time='150ms'/> by measuring the prediction error, <break time='100ms'/> then propagating gradients backward through the network, <break time='150ms'/> to minimize loss with each step. $F"},
  @{file="nn-06"; ssml="$H Neural networks power some of the most impactful technologies today, <break time='200ms'/> driving breakthroughs in image recognition, <break time='100ms'/> natural language translation, <break time='100ms'/> and intelligent voice assistants. $F"},
  @{file="nn-07"; ssml="$H Neural networks are the cornerstone of modern artificial intelligence, <break time='200ms'/> making deep learning possible across science, <break time='100ms'/> engineering, <break time='100ms'/> medicine, <break time='100ms'/> and global commerce. $F"},
  @{file="ml-01"; ssml="$H Machine learning is a branch of artificial intelligence <break time='150ms'/> that empowers systems to learn directly from data, <break time='200ms'/> discovering patterns without being explicitly programmed. $F"},
  @{file="ml-02"; ssml="$H Instead of hand-coded rules, <break time='150ms'/> machine learning models train on labeled examples <break time='100ms'/> and generalize their knowledge to make accurate predictions <break time='150ms'/> on data they have never seen before. $F"},
  @{file="ml-03"; ssml="$H There are three core learning paradigms. <break time='350ms'/> Supervised learning trains on labeled examples. <break time='250ms'/> Unsupervised learning discovers hidden structure. <break time='250ms'/> And reinforcement learning optimizes actions through reward. $F"},
  @{file="ml-04"; ssml="$H The machine learning workflow moves from data collection, <break time='100ms'/> through feature engineering, <break time='100ms'/> to model training, <break time='100ms'/> then evaluation, <break time='100ms'/> and finally deployment into production. $F"},
  @{file="ml-05"; ssml="$H Powerful algorithms span from linear regression for continuous prediction, <break time='150ms'/> to decision trees, <break time='100ms'/> random forests, <break time='100ms'/> support vector machines, <break time='100ms'/> and deep neural networks for complex tasks. $F"},
  @{file="ml-06"; ssml="$H Machine learning drives the recommendation engines behind streaming services, <break time='200ms'/> the fraud detection systems protecting financial networks, <break time='200ms'/> and the diagnostic tools advancing modern medicine. $F"},
  @{file="ml-07"; ssml="$H Machine learning is reshaping every industry <break time='150ms'/> by automating intelligent decisions at scale, <break time='150ms'/> and unlocking capabilities once thought to require human expertise. $F"},
  @{file="trade-01"; ssml="$H Machine learning is revolutionizing quantitative trading <break time='200ms'/> by detecting subtle price patterns across massive datasets, <break time='200ms'/> that remain invisible to even the most experienced human traders. $F"},
  @{file="trade-02"; ssml="$H The S and P Five Hundred delivers decades of daily market data, <break time='200ms'/> tracking open, <break time='75ms'/> high, <break time='75ms'/> low, <break time='75ms'/> close, <break time='75ms'/> and volume for every trading session with precision. $F"},
  @{file="trade-03"; ssml="$H Feature engineering transforms raw price action into predictive signals, <break time='200ms'/> computing moving averages, <break time='100ms'/> relative strength indicators, <break time='100ms'/> Bollinger Bands, <break time='100ms'/> and M A C D crossovers. $F"},
  @{file="trade-04"; ssml="$H Classification models tackle market direction <break time='150ms'/> by forecasting whether the next session will close higher, <break time='200ms'/> learning subtle patterns from years of historical price behavior. $F"},
  @{file="trade-05"; ssml="$H Regression models estimate the magnitude of expected price movement, <break time='200ms'/> enabling precise position sizing, <break time='100ms'/> dynamic leverage control, <break time='100ms'/> and systematic risk management across a diversified portfolio. $F"},
  @{file="trade-06"; ssml="$H Long Short-Term Memory networks model sequential market dynamics <break time='200ms'/> by capturing dependencies across hundreds of prior trading sessions, <break time='200ms'/> to anticipate near-term price trajectories. $F"},
  @{file="trade-07"; ssml="$H Backtested across a full decade of S and P Five Hundred data, <break time='250ms'/> these machine learning strategies deliver consistent risk-adjusted returns, <break time='200ms'/> with a Sharpe ratio exceeding one point five. $F"}
)

foreach ($c in $clips) {
    try {
        $stream  = Await ($synth.SynthesizeSsmlToStreamAsync($c.ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
        $size    = [uint32]$stream.Size
        $reader  = [Windows.Storage.Streams.DataReader]::new($stream)
        $loaded  = Await ($reader.LoadAsync($size)) ([uint32])
        $bytes   = [byte[]]::new($size)
        $reader.ReadBytes($bytes)
        $outPath = "$dir\$($c.file).wav"
        [System.IO.File]::WriteAllBytes($outPath, $bytes)
        $reader.Dispose()
        $stream.Dispose()
        Write-Host "Generated: $($c.file).wav  ($size bytes)"
    } catch {
        Write-Host "ERROR on $($c.file): $($_.Exception.Message)"
    }
}

$synth.Dispose()
Write-Host "Done."
