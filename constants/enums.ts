export enum ChainId {
	MAINNET = 1,
	MAINNET_FORK = 31337,
	OPTIMISM = 10,
	POLYGON = 137,
	ARBITRUM = 42161,
	CELO = 42220,
}

export enum PoolFee {
	LOWEST = 100,
	LOW = 500,
	MEDIUM = 3000,
	HIGH = 10000
}

export enum PoolType {
	STABLE,
	TOKEN,
}

export enum PositionType {
	CALL,
	PUT,
	PLAIN,
}

export const TICK_SPACING: { [amount in PoolFee]: number } = {
	[PoolFee.LOWEST]: 1,
	[PoolFee.LOW]: 10,
	[PoolFee.MEDIUM]: 60,
	[PoolFee.HIGH]: 200,
}
