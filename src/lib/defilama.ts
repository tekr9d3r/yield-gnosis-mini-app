interface LlamaPool {
	project: string;
	chain: string;
	symbol: string;
	apy: number;
	tvlUsd: number;
	underlyingTokens?: string[];
}

interface LlamaResponse {
	data: LlamaPool[];
}

export interface PoolData {
	apy: number;
	tvl: number;
}

let cachedPools: Map<string, PoolData> | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const WATCHED_ADDRESSES = new Set([
	'0xcb444e90d8198415266c6a2724b7900fb12fc56e', // EURe
	'0x2a22f9c3b484c3629090feed35f17ff8f88f76f0', // USDC.e
	'0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', // WXDAI
	'0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1'  // WETH
]);

export async function fetchAaveApys(): Promise<Map<string, PoolData>> {
	const now = Date.now();
	if (cachedPools && now - cacheTs < CACHE_TTL_MS) return cachedPools;

	const res = await fetch('https://yields.llama.fi/pools');
	if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);

	const json: LlamaResponse = await res.json();

	const poolMap = new Map<string, PoolData>();

	for (const pool of json.data) {
		if (pool.project.toLowerCase() !== 'aave-v3') continue;
		if (pool.chain.toLowerCase() !== 'gnosis') continue;
		if (!pool.underlyingTokens?.length) continue;

		for (const token of pool.underlyingTokens) {
			const addr = token.toLowerCase();
			if (WATCHED_ADDRESSES.has(addr) && !poolMap.has(addr)) {
				poolMap.set(addr, { apy: pool.apy, tvl: pool.tvlUsd });
			}
		}
	}

	cachedPools = poolMap;
	cacheTs = now;
	return poolMap;
}
