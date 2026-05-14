export interface TokenPrices {
	ethUsd: number;
	usdToEur: number;
}

let cached: TokenPrices | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchTokenPrices(): Promise<TokenPrices> {
	if (cached && Date.now() - cacheTs < CACHE_TTL_MS) return cached;

	const [llamaRes, fxRes] = await Promise.all([
		fetch('https://coins.llama.fi/prices/current/coingecko:ethereum'),
		fetch('https://api.frankfurter.app/latest?from=USD&to=EUR')
	]);

	const llama = await llamaRes.json();
	const fx = await fxRes.json();

	const prices: TokenPrices = {
		ethUsd:   llama.coins?.['coingecko:ethereum']?.price ?? 2500,
		usdToEur: fx.rates?.EUR ?? 0.92
	};

	cached = prices;
	cacheTs = Date.now();
	return prices;
}
