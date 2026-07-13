import { createPublicClient, encodeAbiParameters, encodeFunctionData, encodePacked, fallback, hashTypedData, http } from 'viem';
import { gnosis } from 'viem/chains';

export const publicClient = createPublicClient({
	chain: gnosis,
	transport: fallback([
		http('https://rpc.gnosischain.com'),
		http('https://rpc2.gnosischain.com')
	])
});

export const EURE_ADDRESS         = '0xcb444e90d8198415266c6a2724b7900fb12fc56e' as const;
export const USDC_E_ADDRESS       = '0x2a22f9c3b484c3629090feed35f17ff8f88f76f0' as const;
export const AAVE_POOL            = '0xb50201558B00496A145fE76f7424749556E326D8' as const;
export const CIRCLES_HUB_V2       = '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8' as const;
export const TIP_RECIPIENT        = '0x15BE89708053Cbc405F29095ECf803D51b5812C7' as const;
export const YIELDPOT_GROUP    = '0xA7b485Eae7EC8793f29C1ebb268455705c5B67AF' as const;
export const YIELDPOT_TREASURY = '0x5C36Ed9663742c791bE6eDB993847c306Cb8f4b3' as const;

// ── CoW Protocol ─────────────────────────────────────────────────────────────
export const COW_SETTLEMENT    = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41' as const;
export const COW_VAULT_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110' as const;
export const WBTC_ADDRESS      = '0x8e5bbbb09ed1ebde8674cda39a0c169401db4252' as const;
export const WETH_ADDRESS      = '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1' as const;
export const GNO_ADDRESS       = '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb' as const;
export const SDAI_ADDRESS      = '0xaf204776c7245bF4147c2612BF6e5972Ee483701' as const;
export const COW_TOKEN_ADDRESS = '0x177127622c4A00F3d409B75571e12cB3c8973d3c' as const;
export const AAVE_TOKEN_ADDRESS = '0xDF613aF6B44a31299E48131e9347F034347E2F00' as const;

const COW_SETTLEMENT_ABI = [{
	name: 'setPreSignature',
	type: 'function',
	stateMutability: 'nonpayable',
	inputs: [
		{ name: 'orderUid', type: 'bytes' },
		{ name: 'signed',   type: 'bool'  }
	],
	outputs: []
}] as const;

export interface CoWOrderFields {
	sellToken:         `0x${string}`;
	buyToken:          `0x${string}`;
	receiver:          `0x${string}`;
	sellAmount:        bigint;
	buyAmount:         bigint;
	validTo:           number;
	appData:           `0x${string}`;
	feeAmount:         bigint;
	kind:              string;
	partiallyFillable: boolean;
	sellTokenBalance:  string;
	buyTokenBalance:   string;
}

export function encodeCoWPresign(orderUid: `0x${string}`): `0x${string}` {
	return encodeFunctionData({
		abi: COW_SETTLEMENT_ABI,
		functionName: 'setPreSignature',
		args: [orderUid, true]
	});
}

export function hashCoWOrder(order: CoWOrderFields): `0x${string}` {
	return hashTypedData({
		domain: {
			name: 'Gnosis Protocol',
			version: 'v2',
			chainId: 100,
			verifyingContract: COW_SETTLEMENT
		},
		types: {
			Order: [
				{ name: 'sellToken',        type: 'address' },
				{ name: 'buyToken',         type: 'address' },
				{ name: 'receiver',         type: 'address' },
				{ name: 'sellAmount',       type: 'uint256' },
				{ name: 'buyAmount',        type: 'uint256' },
				{ name: 'validTo',          type: 'uint32'  },
				{ name: 'appData',          type: 'bytes32' },
				{ name: 'feeAmount',        type: 'uint256' },
				{ name: 'orderKind',        type: 'string'  },
				{ name: 'partiallyFillable',type: 'bool'    },
				{ name: 'sellTokenBalance', type: 'string'  },
				{ name: 'buyTokenBalance',  type: 'string'  }
			]
		},
		primaryType: 'Order',
		message: {
			sellToken:         order.sellToken,
			buyToken:          order.buyToken,
			receiver:          order.receiver,
			sellAmount:        order.sellAmount,
			buyAmount:         order.buyAmount,
			validTo:           order.validTo,
			appData:           order.appData,
			feeAmount:         order.feeAmount,
			orderKind:         order.kind,
			partiallyFillable: order.partiallyFillable,
			sellTokenBalance:  order.sellTokenBalance,
			buyTokenBalance:   order.buyTokenBalance
		}
	});
}

export function computeCoWOrderUid(
	orderHash: `0x${string}`,
	owner: `0x${string}`,
	validTo: number
): `0x${string}` {
	return encodePacked(['bytes32', 'address', 'uint32'], [orderHash, owner, validTo]);
}

const CIRCLES_HUB_V2_ABI = [
	{
		name: 'groupMint',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: '_group',             type: 'address'   },
			{ name: '_collateralAvatars', type: 'address[]' },
			{ name: '_amounts',           type: 'uint256[]' },
			{ name: '_data',              type: 'bytes'     }
		],
		outputs: []
	},
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
	{
		name: 'setApprovalForAll',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'operator', type: 'address' },
			{ name: 'approved', type: 'bool'    }
		],
		outputs: []
	},
	{
		name: 'safeBatchTransferFrom',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: '_from',   type: 'address'   },
			{ name: '_to',     type: 'address'   },
			{ name: '_ids',    type: 'uint256[]' },
			{ name: '_values', type: 'uint256[]' },
			{ name: '_data',   type: 'bytes'     }
		],
		outputs: []
	},
] as const;

// ── Gnosis Safe ──────────────────────────────────────────────────────────────

const SAFE_ABI = [
	{
		name: 'nonce',
		type: 'function',
		stateMutability: 'view',
		inputs: [],
		outputs: [{ name: '', type: 'uint256' }]
	},
	{
		name: 'approveHash',
		type: 'function',
		stateMutability: 'nonpayable',
		inputs: [{ name: 'hashToApprove', type: 'bytes32' }],
		outputs: []
	},
	{
		name: 'execTransaction',
		type: 'function',
		stateMutability: 'payable',
		inputs: [
			{ name: 'to',             type: 'address' },
			{ name: 'value',          type: 'uint256' },
			{ name: 'data',           type: 'bytes'   },
			{ name: 'operation',      type: 'uint8'   },
			{ name: 'safeTxGas',      type: 'uint256' },
			{ name: 'baseGas',        type: 'uint256' },
			{ name: 'gasPrice',       type: 'uint256' },
			{ name: 'gasToken',       type: 'address' },
			{ name: 'refundReceiver', type: 'address' },
			{ name: 'signatures',     type: 'bytes'   }
		],
		outputs: [{ name: 'success', type: 'bool' }]
	},
] as const;

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const;

export async function getTreasuryNonce(safeAddress: `0x${string}`): Promise<bigint> {
	return publicClient.readContract({ address: safeAddress, abi: SAFE_ABI, functionName: 'nonce' });
}

export function computeSafeTxHash(
	safeAddress: `0x${string}`,
	to: `0x${string}`,
	data: `0x${string}`,
	nonce: bigint
): `0x${string}` {
	return hashTypedData({
		domain: { chainId: 100, verifyingContract: safeAddress },
		types: {
			SafeTx: [
				{ name: 'to',             type: 'address' },
				{ name: 'value',          type: 'uint256' },
				{ name: 'data',           type: 'bytes'   },
				{ name: 'operation',      type: 'uint8'   },
				{ name: 'safeTxGas',      type: 'uint256' },
				{ name: 'baseGas',        type: 'uint256' },
				{ name: 'gasPrice',       type: 'uint256' },
				{ name: 'gasToken',       type: 'address' },
				{ name: 'refundReceiver', type: 'address' },
				{ name: 'nonce',          type: 'uint256' },
			]
		},
		primaryType: 'SafeTx',
		message: {
			to, value: 0n, data, operation: 0,
			safeTxGas: 0n, baseGas: 0n, gasPrice: 0n,
			gasToken: ZERO_ADDR, refundReceiver: ZERO_ADDR,
			nonce
		}
	});
}

export function encodeApproveHash(hash: `0x${string}`): `0x${string}` {
	return encodeFunctionData({ abi: SAFE_ABI, functionName: 'approveHash', args: [hash] });
}

export function encodeExecWithApprovedHash(
	to: `0x${string}`,
	data: `0x${string}`,
	approver: `0x${string}`
): `0x${string}` {
	// Pre-approved hash signature format: r=approver (32 bytes), s=0 (32 bytes), v=1
	const sig = (`0x` +
		approver.slice(2).toLowerCase().padStart(64, '0') +
		'0'.repeat(64) +
		'01'
	) as `0x${string}`;
	return encodeFunctionData({
		abi: SAFE_ABI,
		functionName: 'execTransaction',
		args: [to, 0n, data, 0, 0n, 0n, 0n, ZERO_ADDR, ZERO_ADDR, sig]
	});
}

export function encodeHubBatchTransfer(
	from: `0x${string}`,
	to: `0x${string}`,
	ids: bigint[],
	values: bigint[]
): `0x${string}` {
	return encodeFunctionData({
		abi: CIRCLES_HUB_V2_ABI,
		functionName: 'safeBatchTransferFrom',
		args: [from, to, ids, values, '0x']
	});
}

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

export function encodeTrust(receiver: `0x${string}`): `0x${string}` {
	return encodeFunctionData({
		abi: CIRCLES_HUB_V2_ABI,
		functionName: 'trust',
		args: [receiver, BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFF')]
	});
}

export function encodeSetApprovalForAll(operator: `0x${string}`, approved: boolean): `0x${string}` {
	return encodeFunctionData({
		abi: CIRCLES_HUB_V2_ABI,
		functionName: 'setApprovalForAll',
		args: [operator, approved]
	});
}

export function encodeGroupMint(
	group: `0x${string}`,
	collateralAvatar: `0x${string}`,
	amount: bigint
): `0x${string}` {
	return encodeFunctionData({
		abi: CIRCLES_HUB_V2_ABI,
		functionName: 'groupMint',
		args: [group, [collateralAvatar], [amount], '0x']
	});
}

export function encodeCirclesTip(from: `0x${string}`, tokenId: bigint, staticAmount: bigint): `0x${string}` {
	return encodeFunctionData({
		abi: CIRCLES_HUB_V2_ABI,
		functionName: 'safeTransferFrom',
		args: [from, TIP_RECIPIENT, tokenId, staticAmount, '0x']
	});
}

export const BALANCER_VAULT      = '0xBA12222222228d8Ba445958a75a0704d566BF2C8' as const;
export const SYIELDPOT_ADDRESS   = '0x7b9f2c39eb73752d83a3cd2421a65e102e1919cd' as const;
export const YIELDPOT_POOL_ID    = '0xe6ab0a7cb5cc84420914f772200b921d57d6c7de00020000000000000000047a' as const;
export const YIELDPOT_POOL_BPT   = '0xe6ab0a7cb5cc84420914f772200b921d57d6c7de' as const;

const BALANCER_VAULT_ABI = [
	{
		name: 'swap',
		type: 'function',
		stateMutability: 'payable',
		inputs: [
			{
				name: 'singleSwap', type: 'tuple',
				components: [
					{ name: 'poolId',   type: 'bytes32' },
					{ name: 'kind',     type: 'uint8'   },
					{ name: 'assetIn',  type: 'address' },
					{ name: 'assetOut', type: 'address' },
					{ name: 'amount',   type: 'uint256' },
					{ name: 'userData', type: 'bytes'   }
				]
			},
			{
				name: 'funds', type: 'tuple',
				components: [
					{ name: 'sender',              type: 'address' },
					{ name: 'fromInternalBalance', type: 'bool'    },
					{ name: 'recipient',           type: 'address' },
					{ name: 'toInternalBalance',   type: 'bool'    }
				]
			},
			{ name: 'limit',    type: 'uint256' },
			{ name: 'deadline', type: 'uint256' }
		],
		outputs: [{ name: 'amountCalculated', type: 'uint256' }]
	}
] as const;

export function encodeBalancerSwap(
	assetIn: `0x${string}`,
	assetOut: `0x${string}`,
	amount: bigint,
	address: `0x${string}`
): `0x${string}` {
	return encodeFunctionData({
		abi: BALANCER_VAULT_ABI,
		functionName: 'swap',
		args: [
			{
				poolId:   YIELDPOT_POOL_ID,
				kind:     0,
				assetIn,
				assetOut,
				amount,
				userData: '0x'
			},
			{
				sender:              address,
				fromInternalBalance: false,
				recipient:           address,
				toInternalBalance:   false
			},
			0n,
			BigInt(Math.floor(Date.now() / 1000) + 3600)
		]
	});
}

// Wrap ERC-1155 YIELDPOT_GROUP CRC → s-YIELDPOT ERC-20 (type 1 = Inflationary)
export function encodeHubWrap(avatar: `0x${string}`, amount: bigint): `0x${string}` {
	return encodeFunctionData({
		abi: [{
			name: 'wrap', type: 'function', stateMutability: 'nonpayable',
			inputs: [
				{ name: '_avatar', type: 'address' },
				{ name: '_amount', type: 'uint256' },
				{ name: '_type',   type: 'uint8'   }
			],
			outputs: [{ name: '', type: 'address' }]
		}] as const,
		functionName: 'wrap',
		args: [avatar, amount, 1]
	});
}

export const LBPSTARTER_ADDRESS = '0x5A3022551721095E9a01e97a2f91eA579947f42e' as const;

export function encodeWithdrawLeftovers(destination: `0x${string}`): `0x${string}` {
	return encodeFunctionData({
		abi: [{
			name: 'withdrawLeftovers', type: 'function', stateMutability: 'nonpayable',
			inputs: [{ name: 'destination', type: 'address' }], outputs: []
		}] as const,
		functionName: 'withdrawLeftovers',
		args: [destination]
	});
}

const BALANCER_EXIT_ABI = [{
	name: 'exitPool',
	type: 'function',
	stateMutability: 'nonpayable',
	inputs: [
		{ name: 'poolId',    type: 'bytes32'  },
		{ name: 'sender',    type: 'address'  },
		{ name: 'recipient', type: 'address'  },
		{
			name: 'request', type: 'tuple',
			components: [
				{ name: 'assets',           type: 'address[]' },
				{ name: 'minAmountsOut',    type: 'uint256[]' },
				{ name: 'userData',         type: 'bytes'     },
				{ name: 'toInternalBalance',type: 'bool'      },
			]
		}
	],
	outputs: []
}] as const;

// Proportional exit: burns all BPT and returns USDC.e + s-YIELDPOT pro-rata
export function encodeExitPool(sender: `0x${string}`, bptAmount: bigint): `0x${string}` {
	const userData = encodeAbiParameters(
		[{ type: 'uint256' }, { type: 'uint256' }],
		[1n, bptAmount] // EXACT_BPT_IN_FOR_TOKENS_OUT = 1
	);
	return encodeFunctionData({
		abi: BALANCER_EXIT_ABI,
		functionName: 'exitPool',
		args: [
			YIELDPOT_POOL_ID,
			sender,
			sender,
			{
				assets:           [USDC_E_ADDRESS, SYIELDPOT_ADDRESS],
				minAmountsOut:    [0n, 0n],
				userData,
				toInternalBalance: false
			}
		]
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

export function encodeERC20Approve(spender: `0x${string}`, amount: bigint): `0x${string}` {
	return encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [spender, amount] });
}
