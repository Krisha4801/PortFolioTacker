// fetchHistoricalData.js
// Fetches historical index data from Yahoo Finance via CORS proxies
// Results are cached in localStorage to avoid re-fetching on every render

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

// Yahoo Finance symbols
const SYMBOLS = {
    sensex: '^BSESN',
    nifty: '^NSEI',
    sp500: '^GSPC',
};

// Map graphPeriod → Yahoo Finance range & interval
const PERIOD_CONFIG = {
    '1D': { range: '1d', interval: '5m' },
    '1W': { range: '5d', interval: '1d' },
    '1M': { range: '1mo', interval: '1d' },
    '3M': { range: '3mo', interval: '1d' },
    '6M': { range: '6mo', interval: '1wk' },
    '1Y': { range: '1y', interval: '1wk' },
    '3Y': { range: '3y', interval: '1mo' },
    '5Y': { range: '5y', interval: '1mo' },
    '7Y': { range: '10y', interval: '1mo' },
    '10Y': { range: '10y', interval: '1mo' },
    'All': { range: '10y', interval: '1mo' },
};

// Build the raw Yahoo Finance URL (not encoded here — each proxy handles encoding itself)
const yahooUrl = (symbol, range, interval) =>
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;

// Try multiple CORS proxies in sequence until one works
const fetchWithProxies = async (targetUrl) => {
    const proxies = [
        // corsproxy.io — fastest, try first
        {
            name: 'corsproxy.io',
            build: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
            parse: async (res) => res.json()
        },
        // allorigins — fallback, wraps response in { contents: "..." }
        {
            name: 'allorigins',
            build: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            parse: async (res) => {
                const wrapper = await res.json();
                return JSON.parse(wrapper.contents);
            }
        },
        // thingproxy — last resort
        {
            name: 'thingproxy',
            build: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
            parse: async (res) => res.json()
        },
    ];
    for (const proxy of proxies) {
        try {
            const proxyUrl = proxy.build(targetUrl);
            console.log(`  Trying proxy: ${proxy.name}`);
            const res = await fetch(proxyUrl, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) {
                console.warn(`  ${proxy.name} responded ${res.status}, skipping`);
                continue;
            }
            const data = await proxy.parse(res);
            if (data?.chart?.result?.[0]) {
                console.log(`  ✅ ${proxy.name} succeeded`);
                return data;
            }
            console.warn(`  ${proxy.name} returned unexpected structure, skipping`);
        } catch (e) {
            console.warn(`  ${proxy.name} failed: ${e.message}`);
        }
    }

    throw new Error('All CORS proxies failed for: ' + targetUrl);
};

/**
 * Fetch historical closes for one Yahoo Finance symbol.
 * Returns an array of { date: 'YYYY-MM-DD', close: number }
 */
const fetchYahooHistory = async (symbol, range, interval) => {
    const cacheKey = `yhist_${symbol}_${range}_${interval}`;

    // Return cached data if still fresh
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION_MS) {
                console.log(`✅ Using cached index data: ${symbol} (${range})`);
                return data;
            }
        }
    } catch (_) { }

    console.log(`🔄 Fetching index data: ${symbol} (${range})...`);
    const url = yahooUrl(symbol, range, interval);
    const json = await fetchWithProxies(url);

    const chart = json?.chart?.result?.[0];
    if (!chart) throw new Error(`No chart data returned for ${symbol}`);

    const timestamps = chart.timestamp || [];
    const closes = chart.indicators?.quote?.[0]?.close || [];

    const data = timestamps
        .map((ts, i) => ({
            date: new Date(ts * 1000).toISOString().split('T')[0],
            close: closes[i] ?? null,
        }))
        .filter(d => d.close !== null);

    if (data.length === 0) throw new Error(`Empty price series for ${symbol}`);

    // Cache it
    try {
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        console.log(`✅ Fetched & cached ${data.length} data points for ${symbol}`);
    } catch (_) { }

    return data;
};

/**
 * Fetch all requested index histories for a given period.
 * Returns { sensex, nifty, sp500 } — each is an array of { date, close } or null on failure.
 */
export const fetchIndexHistories = async (graphPeriod, toggles) => {
    const config = PERIOD_CONFIG[graphPeriod] || PERIOD_CONFIG['1Y'];
    const results = {};

    await Promise.all(
        Object.entries(SYMBOLS).map(async ([key, symbol]) => {
            if (!toggles[key]) {
                results[key] = null;
                return;
            }
            try {
                results[key] = await fetchYahooHistory(symbol, config.range, config.interval);
            } catch (e) {
                console.warn(`⚠️ Could not fetch ${key} (${symbol}):`, e.message);
                results[key] = null;
            }
        })
    );

    return results;
};

/**
 * Normalise a series so the first value = 100.
 * Lets you compare % growth of portfolio vs indices on the same axis.
 */
export const normalise = (series) => {
    if (!series || series.length === 0) return [];
    const base = series[0].close;
    if (!base || base === 0) return series.map(d => ({ ...d, close: 100 }));
    return series.map(d => ({
        ...d,
        close: parseFloat(((d.close / base) * 100).toFixed(2))
    }));
};