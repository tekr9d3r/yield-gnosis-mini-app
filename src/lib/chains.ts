import { createPublicClient, encodeFunctionData, fallback, http } from 'viem';
import { gnosis } from 'viem/chains';

export const publicClient = createPublicClient({
	chain: gnosis,
	transport: fallback([
		http('https://rpc.gnosischain.com'),
		http('https://rpc2.gnosischain.com')
	])
});

export const EURE_ADDRESS         = '0xcb444e90d8198415266c6a2724b7900fb12fc56e' as const;
export const AAVE_POOL            = '0xb50201558B00496A145fE76f7424749556E326D8' as const;
export const CIRCLES_HUB_V2       = '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8' as const;
export const TIP_RECIPIENT        = '0x15BE89708053Cbc405F29095ECf803D51b5812C7' as const;
export const YIELDPOT_GROUP    = '0xA7b485Eae7EC8793f29C1ebb268455705c5B67AF' as const;
export const YIELDPOT_TREASURY = '0x5C36Ed9663742c791bE6eDB993847c306Cb8f4b3' as const;

const CIRCLES_HUB_V2_ABI = [
	{
		name: 'safeTransferFrom',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: '_from',  type: 'address' },
			{ name: '_to',    type: 'address' },
			{ name: '_id',    type: 'uint256' },
			{ name: '_value', type: 'uint256' },
			{ name: '_data',  type: 'bytes'   }
		],
		outputs: []
	},
	{
		name: 'balanceOf',
		type: 'function',
		stateMutability: 'view',
		inputs: [
			{ name: 'account', type: 'address' },
			{ name: 'id',      type: 'uint256' }
		],
		outputs: [{ name: '', type: 'uint256' }]
	},
	{
		name: 'trust',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: '_trustReceiver', type: 'address' },
			{ name: '_expiry',        type: 'uint96'  }
		],
		outputs: []
	},
] as const;

export async function getPersonalCrcBalance(address: `0x${string}`): Promise<number> {
	const raw = await publicClient.readContract({
		address: CIRCLES_HUB_V2,
		abi: CIRCLES_HUB_V2_ABI,
		functionName: 'balanceOf',
		args: [address, BigInt(address)]
	});
	return parseFloat((Number(raw) / 1e18).toFixed(6));
}


export function encodeSupportGroup(group: `0x${string}`): `0x${string}` {
	return encodeFunctionData({
		abi: CIRCLES_HUB_V2_ABI,
		functionName: 'trust',
		args: [group, BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFF')]
	});
}

export function encodeCirclesTip(from: `0x${string}`, tokenId: bigint, staticAmount: bigint): `0x${string}` {
	return encodeFunctionData({
		abi: CIRCLES_HUB_V2_ABI,
		functionName: 'safeTransferFrom',
		args: [from, TIP_RECIPIENT, tokenId, staticAmount, '0x']
	});
}

export const ERC20_ABI = [
	{
		name: 'balanceOf',
		type: 'function',
		stateMutability: 'view',
		inputs: [{ name: 'account', type: 'address' }],
		outputs: [{ name: '', type: 'uint256' }]
	},
	{
		name: 'approve',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'spender', type: 'address' },
			{ name: 'amount', type: 'uint256' }
		],
		outputs: [{ name: '', type: 'bool' }]
	},
	{
		name: 'allowance',
		type: 'function',
		stateMutability: 'view',
		inputs: [
			{ name: 'owner', type: 'address' },
			{ name: 'spender', type: 'address' }
		],
		outputs: [{ name: '', type: 'uint256' }]
	}
] as const;

export const AAVE_POOL_ABI = [
	{
		name: 'supply',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'asset', type: 'address' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'onBehalfOf', type: 'address' },
			{ name: 'referralCode', type: 'uint16' }
		],
		outputs: []
	},
	{
		name: 'withdraw',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'asset', type: 'address' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'to', type: 'address' }
		],
		outputs: [{ name: '', type: 'uint256' }]
	},
	{
		name: 'getReserveData',
		type: 'function',
		stateMutability: 'view',
		inputs: [{ name: 'asset', type: 'address' }],
		outputs: [
			{
				name: '',
				type: 'tuple',
				components: [
					{
						name: 'configuration',
						type: 'tuple',
						components: [{ name: 'data', type: 'uint256' }]
					},
					{ name: 'liquidityIndex', type: 'uint128' },
					{ name: 'currentLiquidityRate', type: 'uint128' },
					{ name: 'variableBorrowIndex', type: 'uint128' },
					{ name: 'currentVariableBorrowRate', type: 'uint128' },
					{ name: 'currentStableBorrowRate', type: 'uint128' },
					{ name: 'lastUpdateTimestamp', type: 'uint40' },
					{ name: 'id', type: 'uint16' },
					{ name: 'aTokenAddress', type: 'address' },
					{ name: 'stableDebtTokenAddress', type: 'address' },
					{ name: 'variableDebtTokenAddress', type: 'address' },
					{ name: 'interestRateStrategyAddress', type: 'address' },
					{ name: 'accruedToTreasury', type: 'uint128' },
					{ name: 'unbacked', type: 'uint128' },
					{ name: 'isolationModeTotalDebt', type: 'uint128' }
				]
			}
		]
	}
] as const;
