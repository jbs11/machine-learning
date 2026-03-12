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

[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage, ContentType=WindowsRuntime]

$synth = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()

# Select best available voice — prefer Mark to match ML Dashboard audio
$voices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
$voice  = ($voices | Where-Object { $_.DisplayName -like "*Mark*"  } | Select-Object -First 1)
if (-not $voice) { $voice = ($voices | Where-Object { $_.DisplayName -like "*David*" } | Select-Object -First 1) }
if (-not $voice) { $voice = ($voices | Where-Object { $_.Gender -eq [Windows.Media.SpeechSynthesis.VoiceGender]::Male } | Select-Object -First 1) }
if ($voice) { $synth.Voice = $voice; Write-Host "Voice: $($voice.DisplayName)" }
else { Write-Host "Using default voice" }

$synth.Options.SpeakingRate = 0.90
$synth.Options.AudioPitch   = 0.0

$dir = "$PSScriptRoot\public\audio"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$H = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><prosody rate='0.9'>"
$F = "</prosody></speak>"

$clips = @(

  # ── MODULE 1 ──────────────────────────────────────────────────────────────

  @{file="course-1-1"; ssml="$H
Welcome to Module 1, Lesson 1. <break time='300ms'/>
How Financial Markets Work. <break time='500ms'/>
A financial market is simply a place where buyers and sellers agree on a price for an asset. <break time='250ms'/>
Every price you see, <break time='100ms'/> whether it's a stock, <break time='100ms'/> a bond, <break time='100ms'/> or a futures contract, <break time='150ms'/> is set by supply and demand happening in real time. <break time='350ms'/>
Buyers post bids, <break time='100ms'/> the highest price they are willing to pay. <break time='200ms'/>
Sellers post asks, <break time='100ms'/> the lowest price they will accept. <break time='200ms'/>
When a bid meets an ask, <break time='150ms'/> a trade executes and a price is discovered. <break time='400ms'/>
Markets exist for stocks, <break time='100ms'/> bonds, <break time='100ms'/> commodities, <break time='100ms'/> currencies, <break time='100ms'/> and derivatives. <break time='350ms'/>
The major participants are retail traders like yourself, <break time='200ms'/> institutional investors like pension funds and mutual funds, <break time='200ms'/> aggressive hedge funds, <break time='150ms'/> and market makers who provide liquidity around the clock. <break time='400ms'/>
Market makers are always on the other side of your trade. <break time='200ms'/>
They profit from the bid-ask spread regardless of direction. <break time='400ms'/>
The key insight for every trader: <break time='250ms'/> markets are price-discovery mechanisms. <break time='200ms'/>
They reflect everything known about an asset at any given moment. <break time='350ms'/>
Understanding who is trading, <break time='150ms'/> and more importantly why they are trading, <break time='150ms'/> is your first real competitive edge. <break time='500ms'/>
In this module we will build the foundational knowledge that every profitable trader needs before touching a single indicator or algorithm.
$F"},

  @{file="course-1-2"; ssml="$H
Lesson 1.2. <break time='300ms'/>
Market Participants. <break time='200ms'/> Who are you actually trading against? <break time='500ms'/>
Most retail traders assume they are competing against other retail traders. <break time='300ms'/>
The reality is very different. <break time='400ms'/>
Retail traders account for roughly ten percent of daily equity volume. <break time='300ms'/>
The remaining ninety percent comes from institutions, <break time='150ms'/> high-frequency traders, <break time='150ms'/> and market makers. <break time='500ms'/>
Institutional investors, <break time='150ms'/> pension funds, <break time='100ms'/> mutual funds, <break time='100ms'/> and insurance companies, <break time='150ms'/> operate with long time horizons and massive capital. <break time='300ms'/>
Hedge funds are the most dangerous counterparty. <break time='200ms'/>
They are aggressive, <break time='100ms'/> leveraged, <break time='100ms'/> and actively short-sell individual stocks and indices. <break time='400ms'/>
Market makers provide liquidity by always being willing to buy or sell. <break time='250ms'/>
They profit from the spread between bid and ask, <break time='200ms'/> and they never lose over time. <break time='400ms'/>
Here is what this means for your trading. <break time='300ms'/>
Large institutions cannot hide their activity. <break time='250ms'/>
When a fund needs to accumulate a billion-dollar position, <break time='200ms'/> they must buy over days or weeks. <break time='250ms'/>
Their footprints appear in volume, <break time='150ms'/> order flow, <break time='150ms'/> and price structure. <break time='400ms'/>
Your job is to detect those footprints and align with institutional direction. <break time='250ms'/>
Do not fight the institutions. <break time='200ms'/>
Trade alongside them.
$F"},

  @{file="course-1-3"; ssml="$H
Lesson 1.3. <break time='300ms'/>
Order Types and Order Flow. <break time='500ms'/>
Before placing a single trade, <break time='150ms'/> you must master the four essential order types. <break time='500ms'/>
First, <break time='150ms'/> the market order. <break time='200ms'/>
A market order executes immediately at the best available price. <break time='250ms'/>
It is fast, <break time='100ms'/> but you surrender price control entirely. <break time='400ms'/>
Second, <break time='150ms'/> the limit order. <break time='200ms'/>
A limit order fills only at your specified price or better. <break time='250ms'/>
You control the price, <break time='100ms'/> but not the timing of execution. <break time='400ms'/>
Third, <break time='150ms'/> the stop order. <break time='200ms'/>
A stop order becomes a market order when price reaches your trigger level. <break time='250ms'/>
This is the foundation of every stop-loss strategy. <break time='400ms'/>
Fourth, <break time='150ms'/> the stop-limit order. <break time='200ms'/>
This combines a stop trigger with a limit price. <break time='250ms'/>
You get price protection, <break time='100ms'/> but execution is not guaranteed. <break time='500ms'/>
When you place an order, <break time='150ms'/> it travels through your broker to the exchange matching engine in milliseconds. <break time='300ms'/>
The engine pairs buyers and sellers by price and time priority. <break time='350ms'/>
Large institutional orders frequently trade in dark pools, <break time='200ms'/> off-exchange venues designed to minimize market impact. <break time='400ms'/>
The practical rule for every trader: <break time='250ms'/>
Always use limit orders for your entries. <break time='250ms'/>
Never give away your price unnecessarily with a market order.
$F"},

  @{file="course-1-4"; ssml="$H
Lesson 1.4. <break time='300ms'/>
Reading Price Charts. <break time='200ms'/> O H L C V and Candlesticks. <break time='500ms'/>
Price charts are the universal language of trading. <break time='300ms'/>
Every candlestick tells you five things about that time period. <break time='400ms'/>
Open, <break time='150ms'/> the first traded price. <break time='250ms'/>
High, <break time='150ms'/> the highest price reached. <break time='250ms'/>
Low, <break time='150ms'/> the lowest price reached. <break time='250ms'/>
Close, <break time='150ms'/> the final traded price. <break time='250ms'/>
And Volume, <break time='150ms'/> the total shares or contracts traded. <break time='500ms'/>
A green candle means the close was above the open. <break time='200ms'/>
Buyers won that period. <break time='300ms'/>
A red candle means the close was below the open. <break time='200ms'/>
Sellers were in control. <break time='400ms'/>
The body of the candle shows the open-to-close range. <break time='250ms'/>
The wicks show how far price moved and was rejected. <break time='400ms'/>
An uptrend is a series of higher highs and higher lows. <break time='300ms'/>
A downtrend is lower highs and lower lows. <break time='300ms'/>
A range is price bouncing between a support floor and a resistance ceiling. <break time='300ms'/>
A breakout occurs when price escapes the range, <break time='150ms'/> ideally on high volume. <break time='500ms'/>
The close is the single most important data point on any candle. <break time='250ms'/>
It represents the final consensus between buyers and sellers. <break time='400ms'/>
Start with the daily timeframe to understand the bigger picture, <break time='200ms'/>
then zoom into smaller timeframes for your entries.
$F"},

  @{file="course-1-5"; ssml="$H
Lesson 1.5. <break time='300ms'/>
Understanding Options. <break time='200ms'/> Calls, Puts, and the Greeks. <break time='500ms'/>
An options contract gives you the right, <break time='150ms'/> but not the obligation, <break time='150ms'/> to buy or sell an asset at a specific price before expiration. <break time='400ms'/>
A call option gives you the right to buy. <break time='250ms'/>
You profit when the underlying price rises. <break time='350ms'/>
A put option gives you the right to sell. <break time='250ms'/>
You profit when the underlying price falls. <break time='400ms'/>
In both cases, <break time='150ms'/> you pay a premium upfront. <break time='200ms'/>
That premium is your maximum possible loss. <break time='400ms'/>
Now let us cover the five Greeks, <break time='200ms'/> the sensitivity measures every options trader must know. <break time='400ms'/>
Delta measures how much the option price moves per one-dollar move in the underlying. <break time='350ms'/>
An at-the-money call has a delta of approximately fifty cents. <break time='400ms'/>
Gamma measures how fast delta changes. <break time='250ms'/>
Gamma is highest for at-the-money options near expiration. <break time='400ms'/>
Theta is daily time decay. <break time='250ms'/>
Options lose value every single day you hold them. <break time='300ms'/>
Theta works against buyers and in favor of sellers. <break time='400ms'/>
Vega measures sensitivity to implied volatility. <break time='250ms'/>
When implied volatility rises, <break time='100ms'/> option prices rise for buyers. <break time='300ms'/>
When volatility collapses after an event, <break time='200ms'/> premiums can drop dramatically. <break time='500ms'/>
The key rule: <break time='250ms'/>
Match your options strategy precisely to your market outlook. <break time='200ms'/>
Calls for bullish views. <break time='150ms'/> Puts for bearish views.
$F"},

  @{file="course-1-6"; ssml="$H
Lesson 1.6. <break time='300ms'/>
Key Market Times and Calendar Events. <break time='500ms'/>
When you trade matters as much as what you trade. <break time='500ms'/>
The regular United States equity session runs from nine-thirty in the morning to four in the afternoon, Eastern Time. <break time='400ms'/>
The highest volume and volatility occur in two windows. <break time='300ms'/>
The first is the opening hour, <break time='150ms'/> nine-thirty to ten-thirty. <break time='300ms'/>
The second is the final hour, <break time='150ms'/> three to four in the afternoon. <break time='400ms'/>
Pre-market trading begins at four in the morning. <break time='250ms'/>
It is thin, <break time='100ms'/> news-driven, <break time='100ms'/> and prone to sharp reversals. <break time='350ms'/>
After-hours trading runs until eight in the evening <break time='200ms'/> and is primarily used for earnings reactions. <break time='500ms'/>
Now for calendar events, <break time='200ms'/> which are critical for options traders. <break time='400ms'/>
Federal Open Market Committee meetings move the entire equity market in seconds. <break time='350ms'/>
C P I and P P I inflation releases drive rate expectations and sector rotations. <break time='350ms'/>
Non-Farm Payrolls are released every first Friday of the month <break time='200ms'/> and can cause significant gaps at the open. <break time='400ms'/>
Earnings seasons drive large moves in individual stocks. <break time='300ms'/>
Options premiums expand before major events as implied volatility rises. <break time='300ms'/>
And they collapse immediately after the event, <break time='150ms'/> a phenomenon called volatility crush. <break time='400ms'/>
Check the economic calendar every morning. <break time='250ms'/>
Avoid the first fifteen minutes of the regular session <break time='200ms'/> unless you have a well-tested edge at the open.
$F"},

  @{file="course-1-7"; ssml="$H
Lesson 1.7. <break time='300ms'/>
Risk Management Fundamentals. <break time='500ms'/>
Risk management is the single factor that separates traders who build lasting careers <break time='200ms'/> from those who blow up their accounts. <break time='500ms'/>
The core rule is simple. <break time='300ms'/>
Never risk more than one to two percent of your account on a single trade. <break time='400ms'/>
Always define your stop-loss level before you enter the trade. <break time='250ms'/>
Not after. <break time='200ms'/> Before. <break time='500ms'/>
Position sizing is calculated as follows. <break time='300ms'/>
Take your account size and multiply by your risk percentage. <break time='300ms'/>
That gives you your maximum dollar loss. <break time='300ms'/>
Divide that by the distance from your entry price to your stop price. <break time='300ms'/>
The result is the number of shares to buy. <break time='500ms'/>
For example: <break time='250ms'/>
A twenty-five thousand dollar account risking one percent gives you two hundred fifty dollars of maximum loss. <break time='300ms'/>
If your stop is four dollars and twenty cents below your entry, <break time='200ms'/> you buy fifty-nine shares. <break time='400ms'/>
Now for reward-to-risk ratio. <break time='300ms'/>
A minimum two-to-one ratio means you risk one dollar to make two. <break time='250ms'/>
At that ratio, <break time='150ms'/> you only need to be right thirty-four percent of the time to be profitable. <break time='400ms'/>
Track your average win size versus your average loss size. <break time='250ms'/>
That ratio matters far more than your win percentage. <break time='400ms'/>
Protect your capital first. <break time='200ms'/> Profits follow from survival.
$F"},

  # ── MODULE 2 ──────────────────────────────────────────────────────────────

  @{file="course-2-1"; ssml="$H
Welcome to Module 2. <break time='300ms'/>
Environment Setup. <break time='200ms'/> Python, <break time='100ms'/> Jupyter, <break time='100ms'/> and V S Code. <break time='500ms'/>
Before writing a single line of code, <break time='200ms'/> your development environment needs to be properly configured. <break time='400ms'/>
Install Python 3.10 or later from python.org. <break time='300ms'/>
Then create a virtual environment for your project using python dash m venv. <break time='300ms'/>
A virtual environment keeps each project's dependencies completely isolated. <break time='250ms'/>
This prevents conflicts between library versions across different projects. <break time='500ms'/>
Next, install the core trading and machine learning stack. <break time='300ms'/>
You need pandas for data manipulation, <break time='150ms'/> numpy for numerical computing, <break time='150ms'/> yfinance for free market data, <break time='200ms'/> matplotlib for charting, <break time='150ms'/> scikit-learn for machine learning algorithms, <break time='150ms'/> and xgboost for our primary model. <break time='400ms'/>
For your development environment, <break time='200ms'/> use Jupyter Notebook for research and exploration. <break time='250ms'/>
It lets you run code cell by cell and see results immediately. <break time='300ms'/>
Use V S Code for production scripts with full debugging and Git integration. <break time='400ms'/>
Set up Git version control from day one. <break time='250ms'/>
Commit your code after every working session. <break time='250ms'/>
A clean, <break time='100ms'/> reproducible environment is the foundation of professional quantitative work.
$F"},

  @{file="course-2-2"; ssml="$H
Lesson 2.2. <break time='300ms'/>
Python Basics for Traders. <break time='500ms'/>
You only need about twenty percent of Python <break time='150ms'/> to accomplish eighty percent of trading and machine learning work. <break time='400ms'/>
Let us cover what matters. <break time='400ms'/>
Variables store your data. <break time='250ms'/>
A price is a float. <break time='150ms'/> A ticker symbol is a string. <break time='150ms'/> Share count is an integer. <break time='150ms'/> A directional flag is a boolean. <break time='400ms'/>
Lists hold sequences of values. <break time='250ms'/>
Think of a list as a column of closing prices. <break time='250ms'/>
Index zero is the oldest price. <break time='150ms'/> Index negative one is the most recent. <break time='400ms'/>
Dictionaries hold key-value pairs. <break time='250ms'/>
Perfect for storing position data <break time='150ms'/> where keys are field names and values are the data. <break time='400ms'/>
Control flow, <break time='150ms'/> meaning if-else logic and for loops, <break time='200ms'/> lets you make decisions and process data row by row. <break time='400ms'/>
Functions wrap reusable logic. <break time='250ms'/>
Write a moving average function once and use it everywhere in your codebase. <break time='400ms'/>
List comprehensions transform data concisely. <break time='250ms'/>
Computing daily returns from a list of prices in a single line <break time='200ms'/> is both readable and fast. <break time='400ms'/>
The most important mindset shift for traders learning Python: <break time='300ms'/>
Prices are just lists. <break time='200ms'/> Returns are math on those lists. <break time='200ms'/> Your trading strategy is just logic applied to that math.
$F"},

  @{file="course-2-3"; ssml="$H
Lesson 2.3. <break time='300ms'/>
Pandas. <break time='200ms'/> The Trader's Data Engine. <break time='500ms'/>
If Python is the language of trading, <break time='200ms'/> pandas is the grammar. <break time='400ms'/>
A pandas DataFrame is a two-dimensional table <break time='200ms'/> where rows are time periods and columns are your O H L C V data. <break time='400ms'/>
The DatetimeIndex handles all time-series operations natively. <break time='250ms'/>
Slicing by date range, <break time='100ms'/> resampling to different frequencies, <break time='150ms'/> and aligning multiple datasets by date <break time='150ms'/> all happen with clean, readable code. <break time='500ms'/>
The operations you will use constantly: <break time='400ms'/>
pct_change calculates daily returns in one line. <break time='350ms'/>
rolling of twenty, <break time='100ms'/> dot mean, <break time='100ms'/> computes a twenty-day moving average. <break time='350ms'/>
Boolean indexing filters rows by any condition. <break time='250ms'/>
For example, <break time='150ms'/> finding every day where volume exceeds the twenty-day average. <break time='400ms'/>
shift of one moves all data forward one period. <break time='250ms'/>
This is critical for preventing lookahead bias in your models. <break time='400ms'/>
dropna removes rows where indicator values are missing, <break time='200ms'/> which always happens at the beginning of rolling window calculations. <break time='400ms'/>
Always call dropna after computing your indicators. <break time='250ms'/>
Never feed NaN values into a machine learning model.
$F"},

  @{file="course-2-4"; ssml="$H
Lesson 2.4. <break time='300ms'/>
Fetching Live Market Data with yfinance. <break time='500ms'/>
Free, reliable market data is one pip install away. <break time='400ms'/>
The yfinance library wraps the Yahoo Finance data feed <break time='200ms'/> and gives you historical O H L C V data for stocks, <break time='100ms'/> E T Fs, <break time='100ms'/> indices, <break time='100ms'/> futures, <break time='100ms'/> crypto, <break time='100ms'/> and forex pairs. <break time='400ms'/>
The primary function is yf dot download. <break time='300ms'/>
Pass a symbol or list of symbols, <break time='150ms'/> a period like one year, <break time='150ms'/> and optionally an interval for intraday data. <break time='400ms'/>
Always set auto_adjust to True. <break time='300ms'/>
This gives you split and dividend-adjusted prices automatically, <break time='200ms'/> which is essential for any multi-year analysis. <break time='400ms'/>
After downloading, <break time='200ms'/> immediately save the data to a C S V or Parquet file. <break time='250ms'/>
Never re-fetch the same data during development. <break time='250ms'/>
It is slow and wastes your rate limit. <break time='400ms'/>
Always verify your download with df dot info and df dot head. <break time='300ms'/>
Check for missing values before doing anything else. <break time='400ms'/>
One important limitation: <break time='300ms'/>
yfinance data is fifteen to twenty minutes delayed. <break time='250ms'/>
It is excellent for daily and swing trading models, <break time='200ms'/>
but not suitable for intraday or high-frequency strategies.
$F"},

  @{file="course-2-5"; ssml="$H
Lesson 2.5. <break time='300ms'/>
NumPy for Numerical Finance. <break time='500ms'/>
NumPy is the mathematical backbone of every quantitative trading system. <break time='400ms'/>
NumPy arrays are C-optimized. <break time='250ms'/>
Operations on NumPy arrays run one hundred times faster than equivalent Python loops <break time='200ms'/> when working with large datasets. <break time='400ms'/>
The most important concept for financial modeling: <break time='300ms'/>
log returns. <break time='300ms'/>
Log returns are the natural logarithm of today's price divided by yesterday's price. <break time='300ms'/>
They are more statistically stable than percentage returns <break time='200ms'/> and are preferred for all machine learning features. <break time='500ms'/>
To annualize daily volatility, <break time='200ms'/> multiply the daily standard deviation by the square root of two hundred fifty-two. <break time='300ms'/>
Two hundred fifty-two is the number of trading days in a year. <break time='400ms'/>
For Value at Risk, <break time='200ms'/> use numpy's percentile function on your returns array. <break time='300ms'/>
The fifth percentile gives you the daily loss you should not exceed <break time='200ms'/> with ninety-five percent confidence. <break time='400ms'/>
numpy's corrcoef function computes the correlation matrix between assets. <break time='300ms'/>
Use this to identify diversification opportunities in your portfolio. <break time='400ms'/>
And numpy where is your vectorized if-else. <break time='250ms'/>
Use it to generate buy and sell signals across entire price series <break time='200ms'/> without writing a single for loop.
$F"},

  @{file="course-2-6"; ssml="$H
Lesson 2.6. <break time='300ms'/>
Data Cleaning and Preprocessing. <break time='500ms'/>
Industry professionals say eighty percent of machine learning work is data preparation. <break time='250ms'/>
In finance, <break time='100ms'/> it is closer to ninety. <break time='500ms'/>
Real market data has four common problems. <break time='400ms'/>
First, <break time='150ms'/> missing trading days from holidays and exchange halts. <break time='350ms'/>
Second, <break time='150ms'/> corporate actions like stock splits <break time='200ms'/> that make raw prices look like sudden crashes. <break time='350ms'/>
Third, <break time='150ms'/> duplicate rows from A P I glitches and timestamp collisions. <break time='350ms'/>
Fourth, <break time='150ms'/> outliers from flash crashes and data entry errors <break time='200ms'/> that create extreme values your model will treat as real signals. <break time='500ms'/>
The fixes are straightforward. <break time='300ms'/>
Use forward-fill to fill small gaps with the last known price. <break time='300ms'/>
Use drop duplicates to remove duplicate timestamps. <break time='300ms'/>
Always use auto-adjusted prices to handle splits automatically. <break time='300ms'/>
Clip extreme daily returns beyond fifteen percent in either direction. <break time='400ms'/>
Most importantly, <break time='200ms'/> build all of this into a reusable cleaning function. <break time='250ms'/>
Run every single dataset through this function before touching it. <break time='300ms'/>
Data quality is your competitive edge. <break time='250ms'/>
Garbage in means garbage out, <break time='150ms'/> every time.
$F"},

  @{file="course-2-7"; ssml="$H
Lesson 2.7. <break time='300ms'/>
Visualization. <break time='200ms'/> Charting Market Data. <break time='500ms'/>
A chart reveals in seconds what a spreadsheet hides in rows. <break time='400ms'/>
For Python charting, <break time='200ms'/> you have four main options. <break time='400ms'/>
Matplotlib is the standard library for static, publication-quality charts. <break time='350ms'/>
Plotly creates interactive charts with zoom, <break time='100ms'/> hover, <break time='100ms'/> and export functionality, <break time='150ms'/> which are ideal for analysis and dashboards. <break time='350ms'/>
mplfinance generates candlestick charts with volume bars in two lines of code, <break time='200ms'/> specifically designed for financial data. <break time='350ms'/>
Seaborn excels at statistical visualizations <break time='200ms'/> like correlation heatmaps and return distribution plots. <break time='500ms'/>
The essential charts every trader-programmer should build: <break time='400ms'/>
A price chart overlaid with two moving averages to identify the current trend. <break time='350ms'/>
A returns histogram to see the shape of your distribution, <break time='150ms'/> including fat tails. <break time='350ms'/>
A correlation heatmap to understand which assets move together. <break time='350ms'/>
And a rolling volatility chart to distinguish calm regimes from choppy ones. <break time='400ms'/>
One professional habit: <break time='300ms'/>
Always label your axes and add descriptive titles. <break time='250ms'/>
Six months from now, <break time='150ms'/> you will not remember what an unlabeled chart was showing.
$F"},

  @{file="course-2-8"; ssml="$H
Lesson 2.8. <break time='300ms'/>
Module 2 Capstone Project. <break time='200ms'/>
Build a Market Data Pipeline. <break time='500ms'/>
This is the most practically valuable lesson in Module 2. <break time='400ms'/>
You are going to build a reusable data pipeline, <break time='200ms'/> the infrastructure that every future machine learning project will run on. <break time='500ms'/>
The pipeline takes a list of symbols and a time period as inputs. <break time='300ms'/>
It fetches and cleans the data for each symbol. <break time='250ms'/>
It computes basic derived features: <break time='200ms'/> daily returns, <break time='100ms'/> five-day returns, <break time='100ms'/> the twenty-day moving average, <break time='150ms'/> and volume ratio versus the twenty-day average. <break time='350ms'/>
It returns a dictionary of clean DataFrames, <break time='200ms'/> one per symbol, <break time='150ms'/> ready for feature engineering in Module 3. <break time='500ms'/>
Once built, <break time='200ms'/> extend your pipeline further. <break time='300ms'/>
Save to Parquet files for ten-times faster reads compared to CSV. <break time='300ms'/>
Schedule it with Windows Task Scheduler for daily automatic updates. <break time='300ms'/>
Add a data quality assertion that fails loudly if any NaN values are present. <break time='300ms'/>
Log every download with a timestamp. <break time='400ms'/>
A great data pipeline is the single most valuable piece of infrastructure <break time='200ms'/> you will ever build for your trading system. <break time='300ms'/>
Build it once. <break time='150ms'/> Test it well. <break time='150ms'/> Reuse it forever.
$F"},

  # ── MODULE 3 ──────────────────────────────────────────────────────────────

  @{file="course-3-1"; ssml="$H
Welcome to Module 3. <break time='300ms'/>
Moving Averages. <break time='200ms'/> S M A, <break time='100ms'/> E M A, <break time='100ms'/> and V W A P. <break time='500ms'/>
Moving averages are the oldest and most widely used technical indicators. <break time='300ms'/>
There is a reason every professional trader monitors them. <break time='400ms'/>
A Simple Moving Average gives equal weight to every period in the lookback window. <break time='300ms'/>
A twenty-day S M A sums the last twenty closing prices and divides by twenty. <break time='300ms'/>
It is smooth and clean but slow to react to new price action. <break time='400ms'/>
An Exponential Moving Average gives progressively more weight to recent prices. <break time='300ms'/>
This makes it faster and more responsive to changes in momentum. <break time='400ms'/>
V W A P, <break time='150ms'/> Volume-Weighted Average Price, <break time='200ms'/> is the institutional benchmark for intraday trading. <break time='300ms'/>
When price is above V W A P, <break time='200ms'/> institutions are broadly in a buying posture. <break time='300ms'/>
When price is below V W A P, <break time='200ms'/> the tone shifts to selling. <break time='500ms'/>
Key periods to monitor: <break time='300ms'/>
The nine-period E M A for short-term momentum. <break time='250ms'/>
The twenty and fifty-day S M A for medium-term trend. <break time='250ms'/>
And the two hundred-day S M A for long-term market direction. <break time='400ms'/>
The Golden Cross, <break time='150ms'/> where the fifty-day crosses above the two hundred-day, <break time='200ms'/> is one of the most watched bullish signals in all of markets. <break time='300ms'/>
The Death Cross is the inverse and signals a potential bear trend.
$F"},

  @{file="course-3-2"; ssml="$H
Lesson 3.2. <break time='300ms'/>
Momentum Indicators. <break time='200ms'/> R S I and M A C D. <break time='500ms'/>
Momentum tells you not just where price is, <break time='150ms'/> but how fast it is moving there <break time='150ms'/> and whether that speed is accelerating or decelerating. <break time='500ms'/>
R S I, <break time='150ms'/> the Relative Strength Index, <break time='200ms'/> measures the speed of recent price changes on a zero to one hundred scale. <break time='400ms'/>
Above seventy is considered potentially overbought. <break time='250ms'/>
Below thirty is considered potentially oversold. <break time='350ms'/>
But the most powerful R S I signal is divergence. <break time='300ms'/>
When price makes a new high but R S I does not, <break time='200ms'/> it signals that upside momentum is weakening. <break time='250ms'/>
This often precedes a meaningful reversal. <break time='500ms'/>
M A C D, <break time='150ms'/> Moving Average Convergence Divergence, <break time='200ms'/> measures the relationship between two exponential moving averages. <break time='400ms'/>
The M A C D line is the twelve-period E M A minus the twenty-six-period E M A. <break time='350ms'/>
The signal line is a nine-period E M A of the M A C D itself. <break time='350ms'/>
The histogram shows the distance between them, <break time='200ms'/> revealing the acceleration of momentum. <break time='400ms'/>
When M A C D crosses above the signal line with a rising histogram, <break time='250ms'/> it confirms upside momentum. <break time='400ms'/>
Critical rule: <break time='250ms'/>
Always use R S I and M A C D together for confirmation. <break time='250ms'/>
Never trade on a single indicator in isolation.
$F"},

  @{file="course-3-3"; ssml="$H
Lesson 3.3. <break time='300ms'/>
Volatility. <break time='200ms'/> Bollinger Bands and A T R. <break time='500ms'/>
Volatility is not your enemy. <break time='300ms'/>
Volatility is the source of every trading opportunity. <break time='400ms'/>
Bollinger Bands place a twenty-day simple moving average at the center <break time='200ms'/> with upper and lower bands set at two standard deviations above and below. <break time='400ms'/>
In volatile markets, <break time='150ms'/> the bands widen. <break time='250ms'/>
In calm markets, <break time='150ms'/> they narrow. <break time='300ms'/>
When the bands compress to their tightest historical point, <break time='200ms'/> this is called the Bollinger Band Squeeze. <break time='300ms'/>
Energy is building for a significant directional move. <break time='250ms'/>
The direction is not predetermined. <break time='200ms'/> Use other signals to confirm. <break time='500ms'/>
A T R, <break time='150ms'/> Average True Range, <break time='200ms'/> measures the average size of price candles over fourteen periods. <break time='350ms'/>
For a long trade, <break time='150ms'/> set your stop-loss at entry minus two times the A T R. <break time='300ms'/>
This automatically widens in volatile conditions <break time='200ms'/> and tightens when markets are calm. <break time='300ms'/>
It is far superior to fixed dollar stops. <break time='400ms'/>
High A T R environments signal dangerous, <break time='100ms'/> choppy conditions. <break time='250ms'/>
Reduce your position size accordingly. <break time='300ms'/>
Low A T R environments often precede powerful breakouts. <break time='250ms'/>
Watch the Bollinger Band Squeeze and prepare for the expansion.
$F"},

  @{file="course-3-4"; ssml="$H
Lesson 3.4. <break time='300ms'/>
Volume Analysis. <break time='500ms'/>
Volume is the only truly leading indicator <break time='200ms'/> because it is completely independent of price. <break time='400ms'/>
Price tells you what happened. <break time='250ms'/>
Volume tells you who made it happen <break time='150ms'/> and how committed they were. <break time='500ms'/>
High volume on an up day means institutions are accumulating. <break time='250ms'/>
They are buying with conviction, <break time='150ms'/> and they expect the price to go higher. <break time='400ms'/>
High volume on a down day means distribution. <break time='250ms'/>
Institutions are selling with urgency. <break time='400ms'/>
Low volume moves in either direction are weak and likely to reverse. <break time='300ms'/>
Never trust a breakout that happens on below-average volume. <break time='500ms'/>
On-Balance Volume tracks cumulative institutional flow over time. <break time='350ms'/>
When O B V rises while price is flat or falling, <break time='250ms'/> it signals that accumulation is happening quietly beneath the surface. <break time='350ms'/>
When O B V falls while price holds steady, <break time='250ms'/> distribution is occurring. <break time='300ms'/>
Both are early warning signals before price makes its move. <break time='400ms'/>
Volume ratio compares today's volume to the twenty-day average. <break time='300ms'/>
A ratio above two indicates unusual institutional participation. <break time='300ms'/>
That is a signal worth investigating. <break time='400ms'/>
Use volume as your first filter for every potential trade. <break time='250ms'/>
No volume means no conviction. <break time='200ms'/>
No conviction means no trade.
$F"},

  @{file="course-3-5"; ssml="$H
Lesson 3.5. <break time='300ms'/>
Building the Full Feature Matrix. <break time='500ms'/>
Your feature matrix is the language you use to teach a machine <break time='200ms'/> what the market looks like at any given moment. <break time='500ms'/>
In machine learning, <break time='150ms'/> features are the input variables your model learns patterns from. <break time='350ms'/>
Each row in the matrix is one trading day. <break time='300ms'/>
Each column is one computed feature, <break time='200ms'/> such as the five-day return, <break time='100ms'/> R S I fourteen, <break time='100ms'/> M A C D histogram, <break time='100ms'/> A T R, <break time='100ms'/> or volume ratio. <break time='400ms'/>
Your features fall into four categories. <break time='400ms'/>
Price features: lookback returns over one, five, and twenty days, <break time='200ms'/> and price relative to moving averages. <break time='350ms'/>
Momentum features: R S I, <break time='100ms'/> M A C D histogram, <break time='100ms'/> and rate of change. <break time='350ms'/>
Volatility features: A T R, <break time='100ms'/> Bollinger Band width, <break time='100ms'/> and rolling standard deviation. <break time='350ms'/>
Volume features: O B V change, <break time='100ms'/> volume ratio, <break time='100ms'/> and relative volume trend. <break time='500ms'/>
Aim for ten to twenty high-quality, <break time='150ms'/> uncorrelated features. <break time='300ms'/>
More features is not better. <break time='250ms'/>
Correlated features like R S I and Stochastic add noise rather than signal. <break time='300ms'/>
They cause your model to overweight those concepts <break time='200ms'/> and generalize poorly to new data.
$F"},

  @{file="course-3-6"; ssml="$H
Lesson 3.6. <break time='300ms'/>
Normalization, <break time='100ms'/> Scaling, <break time='100ms'/> and Stationarity. <break time='500ms'/>
This is one of the most important and most frequently overlooked lessons in machine learning. <break time='400ms'/>
Raw prices are non-stationary. <break time='300ms'/>
They trend indefinitely in one direction over years and decades. <break time='350ms'/>
A model trained on price levels from twenty-twenty <break time='200ms'/> will fail completely when applied to twenty-twenty-four prices. <break time='300ms'/>
The scales are simply incompatible. <break time='500ms'/>
The solution: <break time='300ms'/>
Use returns, <break time='100ms'/> not prices, <break time='100ms'/> as your primary input features. <break time='300ms'/>
Returns are approximately stationary over time. <break time='400ms'/>
Standard scaling transforms each feature to zero mean and unit variance. <break time='350ms'/>
This prevents features on different scales <break time='200ms'/> from unfairly dominating the model's learning. <break time='500ms'/>
The critical rule, <break time='200ms'/> and this cannot be overstated: <break time='300ms'/>
Fit your scaler only on the training data. <break time='300ms'/>
Then use transform, <break time='150ms'/> never fit, <break time='150ms'/> on the validation and test data. <break time='400ms'/>
Fitting on test data is a form of data leakage. <break time='250ms'/>
It will make your model appear more accurate than it actually is. <break time='300ms'/>
The appearance will vanish the moment you trade it live. <break time='400ms'/>
Use scikit-learn's Pipeline class to enforce correct scaling automatically <break time='200ms'/> across all cross-validation folds.
$F"},

  @{file="course-3-7"; ssml="$H
Lesson 3.7. <break time='300ms'/>
Target Engineering. <break time='200ms'/> What Are You Predicting? <break time='500ms'/>
This is the single most important decision in your entire machine learning project. <break time='400ms'/>
Everything else flows from how you define your target variable. <break time='500ms'/>
You have three main choices. <break time='400ms'/>
Regression targets predict the actual return as a continuous number. <break time='300ms'/>
Binary classification targets predict direction only. <break time='250ms'/>
One for up, <break time='100ms'/> zero for down. <break time='350ms'/>
Threshold classification targets predict whether a meaningful move will occur. <break time='300ms'/>
For example, <break time='150ms'/> will the return exceed half a percent in the next five days? <break time='500ms'/>
For most beginners, <break time='200ms'/> binary classification is the right starting point. <break time='300ms'/>
It is simpler to evaluate and easier to convert into actionable trade signals. <break time='400ms'/>
To create it: <break time='300ms'/>
Compute the next period's return using pct_change shifted by negative one. <break time='300ms'/>
Then convert to binary by checking whether the return is greater than zero. <break time='400ms'/>
Critical step: <break time='300ms'/>
After adding your target column, <break time='200ms'/> drop the last rows where the target value is NaN. <break time='300ms'/>
Those rows look forward past your available data <break time='200ms'/> and will corrupt your model if included. <break time='400ms'/>
Higher thresholds produce fewer but higher-quality signals. <break time='250ms'/>
Think carefully about what you are predicting <break time='200ms'/> before writing a single line of model code.
$F"},

  # ── MODULE 4 ──────────────────────────────────────────────────────────────

  @{file="course-4-1"; ssml="$H
Welcome to Module 4. <break time='300ms'/>
Machine Learning Overview. <break time='500ms'/>
Machine learning algorithms learn patterns from historical data <break time='200ms'/> without being explicitly programmed with trading rules. <break time='400ms'/>
They find statistical relationships in thousands of data points simultaneously, <break time='200ms'/> at a scale no human trader can replicate manually. <break time='500ms'/>
We focus on supervised learning. <break time='300ms'/>
Given a matrix of features X, <break time='150ms'/> predict a target variable Y. <break time='400ms'/>
The machine learning trading pipeline has five layers. <break time='400ms'/>
First, <break time='150ms'/> define the problem precisely. <break time='300ms'/>
Second, <break time='150ms'/> engineer features from your market data. <break time='300ms'/>
Third, <break time='150ms'/> train and validate the model using walk-forward methodology. <break time='300ms'/>
Fourth, <break time='150ms'/> generate trading signals and backtest with realistic costs. <break time='300ms'/>
Fifth, <break time='150ms'/> deploy the model live and monitor for performance decay. <break time='500ms'/>
A critical insight for traders entering machine learning: <break time='300ms'/>
Start simple. <break time='300ms'/>
A well-validated logistic regression often outperforms a complex neural network <break time='200ms'/> on financial data. <break time='300ms'/>
Complexity without validation is just expensive overfitting. <break time='400ms'/>
Machine learning does not replace trading judgment. <break time='250ms'/>
It scales and systematizes that judgment <break time='200ms'/> across thousands of instruments and years of history.
$F"},

  @{file="course-4-2"; ssml="$H
Lesson 4.2. <break time='300ms'/>
Linear and Logistic Regression. <break time='500ms'/>
Always start with the simplest model. <break time='400ms'/>
Linear regression predicts a continuous value, <break time='150ms'/> the expected return as a number. <break time='300ms'/>
It is a linear combination of your input features, <break time='200ms'/> and the learned coefficients tell you exactly how much each feature contributes to the prediction. <break time='400ms'/>
Evaluate it with R-squared, <break time='100ms'/> mean absolute error, <break time='100ms'/> and root mean squared error. <break time='400ms'/>
Logistic regression predicts the probability of a binary outcome: <break time='200ms'/> up or down. <break time='300ms'/>
Despite the name, <break time='150ms'/> it is a classifier, <break time='100ms'/> not a regression model. <break time='350ms'/>
It outputs a probability between zero and one. <break time='300ms'/>
Convert it to a trading signal using a threshold of point five, <break time='200ms'/> or tune the threshold to maximize your specific metric. <break time='500ms'/>
Logistic regression has three major advantages for trading. <break time='400ms'/>
It is fast to train and validate. <break time='300ms'/>
It is fully interpretable. <break time='250ms'/>
And its coefficients directly reveal which features are actually predictive. <break time='400ms'/>
Here is the professional test: <break time='300ms'/>
If you cannot beat a well-regularized logistic regression with your features, <break time='200ms'/> your feature engineering needs more work. <break time='200ms'/>
Adding model complexity will not fix poor features.
$F"}

)

Write-Host "`nGenerating $($clips.Count) course audio files...`n"

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
        $kb = [math]::Round($size / 1024)
        Write-Host "  OK  $($c.file).wav  ($kb KB)"
    } catch {
        Write-Host "  ERR $($c.file): $($_.Exception.Message)"
    }
}

$synth.Dispose()
Write-Host "`nDone. Files saved to: $dir"
