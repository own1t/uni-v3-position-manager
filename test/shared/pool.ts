import { utils } from "ethers";
import { ethers } from "hardhat";
import { ChainId, PoolFee, TICK_SPACING, TokenModel, UNISWAP_V3_CONTRACTS, UNISWAP_V3_CONTRACTS_CELO } from "../../constants";
import { getNearestUsableTick } from "./tick";
import { isWrappedNative, sortTokens } from "./utils";


const POOL_INIT_CODE_HASH = "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54"

export const computePoolAddress = (tokenA: string, tokenB: string, fee: PoolFee, chainId: ChainId = ChainId.MAINNET): string => {
	const factoryAddress = chainId === ChainId.CELO
		? UNISWAP_V3_CONTRACTS_CELO.FACTORY
		: UNISWAP_V3_CONTRACTS.FACTORY

	const [token0, token1] = sortTokens([tokenA, tokenB])

	const salt = utils.keccak256(
		utils.defaultAbiCoder.encode(
			["address", "address", "uint24"],
			[token0, token1, fee]
		)
	)

	const poolAddress = utils.getCreate2Address(factoryAddress, salt, POOL_INIT_CODE_HASH)

	return poolAddress
}

export const getPoolState = async (tokenA: TokenModel, tokenB: TokenModel, fee: PoolFee) => {
	const [token0, token1] = tokenA.address < tokenB.address ? [tokenA, tokenB] : [tokenB, tokenA]

	const poolAddress = computePoolAddress(token0.address, token1.address, fee)
	const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddress)

	const slot0 = await pool.slot0()

	const tickSpacing = TICK_SPACING[fee]
	const tickCurrent = slot0.tick
	const tick = getNearestUsableTick(tickCurrent, tickSpacing)

	const zeroForOne = isWrappedNative(token0.address)
	const invertPrice = !zeroForOne

	return {
		pool,
		token0,
		token1,
		tickSpacing,
		tickCurrent,
		tick,
		zeroForOne,
		invertPrice
	}
}
