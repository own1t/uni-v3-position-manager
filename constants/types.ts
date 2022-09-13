import { BigNumberish } from "ethers";
import { PoolFee, PositionType } from "./enums";


export type Mapping<T> = { [key: string | number]: T }

export type Strict<Type> = {
	[Property in keyof Type]-?: Type[Property]
}

export interface TokenModel {
	chainId: number
	address: string
	name: string
	symbol: string
	decimals: number
}

export interface TestTokenModel extends TokenModel {
	amount: BigNumberish
}

export interface UniswapV3Config {
	FACTORY: string
	NFT: string
	QUOTER: string
	QUOTER_V2?: string
	ROUTER: string
	ROUTER02?: string
	STAKER?: string
	TICK_LENS: string
}

export interface OpenPositionParams {
	positionType: PositionType
	token0: string
	token1: string
	fee: PoolFee
	tickLower: number
	tickUpper: number
	amount0In: BigNumberish
	amount1In: BigNumberish
	amount0Desired: BigNumberish
	amount1Desired: BigNumberish
	amount0Min: BigNumberish
	amount1Min: BigNumberish
	deadline: BigNumberish
	recipient: string
}

export interface ClosePositionParams {
	tokenId: BigNumberish
	recipient: string
	deadline: BigNumberish
}

export interface IncreaseLiquidityParams {
	tokenId: BigNumberish
	amount0Desired: BigNumberish
	amount1Desired: BigNumberish
	amount0Min: BigNumberish
	amount1Min: BigNumberish
	deadline: BigNumberish
}

export interface DecreaseLiquidityParams {
	tokenId: BigNumberish
	liquidity: BigNumberish
	amount0Min: BigNumberish
	amount1Min: BigNumberish
	deadline: BigNumberish
}

export interface CollectParams {
	tokenId: BigNumberish
	recipient: string
	amount0Max: BigNumberish
	amount1Max: BigNumberish
}