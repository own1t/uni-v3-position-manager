import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import chalk from "chalk";
import { ethers } from "hardhat";
import { BigNumberish, constants } from "ethers";

import { UNISWAP_V3_CONTRACTS, UNISWAP_V3_CONTRACTS_CELO, WHALE } from "../constants/addresses";
import { ChainId, PoolFee, PositionType } from "../constants/enums";
import { IncreaseLiquidityParams, OpenPositionParams, TokenModel } from "../constants/types";

import { getPositionRange } from "./shared/tick";
import { getPoolState } from "./shared/pool";
import { getStableList, getTokenList } from "./shared/tokens";
import { approve, formatUnits, getTokenBalance, isWrappedNative, parseUnits, seedTokens, switchChains } from "./shared/utils";

import { INonfungiblePositionManager, IQuoter, ISwapRouter, PositionManager, UniswapV3Oracle } from "../typechain-types";

const ccb = (value: any) => chalk.cyanBright(value.toString())

describe("PositionManager", () => {
	let blockNumber: number = 12697265
	let chainId: ChainId = ChainId.MAINNET

	let deployer: SignerWithAddress,
		trader0: SignerWithAddress,
		trader1: SignerWithAddress,
		trader2: SignerWithAddress

	let nft: INonfungiblePositionManager
	let router: ISwapRouter
	let quoter: IQuoter

	let weth: TokenModel,
		wbtc: TokenModel,
		uni: TokenModel,
		link: TokenModel

	let dai: TokenModel,
		usdc: TokenModel,
		usdt: TokenModel

	let oracle: UniswapV3Oracle
	let positionManager: PositionManager

	let trades: {
		trader: SignerWithAddress,
		token0: TokenModel,
		token1: TokenModel,
		whale: string
	}[]

	before(async () => {
		await switchChains(chainId, blockNumber);
	})

	beforeEach(async () => {
		; ({
			trader0, trader1, trader2,
			dai, usdc, usdt,
			link, uni, wbtc, weth,
			nft, quoter, router,
			oracle,
			positionManager,
		} = await loadFixture(createFixture))

		trades = [
			{
				trader: trader0,
				token0: dai,
				token1: weth,
				whale: WHALE.DAI,
			},
			{
				trader: trader1,
				token0: usdc,
				token1: weth,
				whale: WHALE.USDC,
			},
			{
				trader: trader2,
				token0: weth,
				token1: usdt,
				whale: WHALE.USDT,
			},
		]
	})

	const uniswapV3Fixtures = async (chainId: ChainId = ChainId.MAINNET) => {
		const uniswapConfig = chainId !== ChainId.CELO ? UNISWAP_V3_CONTRACTS : UNISWAP_V3_CONTRACTS_CELO

		const [factory, nft, quoter, router,] = await Promise.all([
			ethers.getContractAt("IUniswapV3Factory", uniswapConfig.FACTORY),
			ethers.getContractAt("INonfungiblePositionManager", uniswapConfig.NFT),
			ethers.getContractAt("IQuoter", uniswapConfig.QUOTER),
			ethers.getContractAt("ISwapRouter", uniswapConfig.ROUTER),
		])

		return { factory, nft, quoter, router }
	}

	const createFixture = async () => {
		const [deployer, trader0, trader1, trader2] = await ethers.getSigners()

		const { dai, usdc, usdt } = getStableList(chainId)
		const { link, uni, wbtc, weth } = getTokenList(chainId)
		const { factory, nft, quoter, router } = await uniswapV3Fixtures(chainId)

		const OracleDeployer = await ethers.getContractFactory("UniswapV3Oracle", deployer)
		const oracle = await OracleDeployer.deploy(weth.address, usdc.address, factory.address)

		const PositionManagerDeployer = await ethers.getContractFactory("PositionManager", deployer)
		const positionManager = await PositionManagerDeployer.deploy(weth.address, factory.address, nft.address, oracle.address)

		return {
			deployer, trader0, trader1, trader2,
			dai, usdc, usdt,
			link, uni, wbtc, weth,
			nft, quoter, router,
			oracle,
			positionManager,
		}
	}

	const openPosition = async (
		positionType: PositionType,
		tokenA: TokenModel,
		tokenB: TokenModel,
		fee: PoolFee,
		whale: string,
		trader: SignerWithAddress,
		seedBefore: boolean
	) => {

		// set up pool

		const { token0, token1, tickSpacing, tickCurrent, tick, invertPrice, zeroForOne } = await getPoolState(tokenA, tokenB, fee)

		const token = zeroForOne ? token1 : token0
		const ethAmount = parseUnits("10")
		const tokenAmount = await oracle.ethForToken(token.address, fee, 1, ethAmount)

		let amount0: BigNumberish, amount1: BigNumberish

		// set up position range

		const { priceCurrent, prices, ticks } = getPositionRange(positionType, token0, token1, tickSpacing, tick, invertPrice)

		// seed and approve tokens

		if (seedBefore) {
			await seedTokens(token.address, whale, trader.address, tokenAmount)
			await approve(token.address, positionManager.address, trader)
		}

		const tokenBalance = await getTokenBalance(token.address, trader.address)

		// construct params

		switch (positionType) {
			case PositionType.CALL:
				;[amount0, amount1] = zeroForOne ? [ethAmount, 0] : [0, ethAmount]
				break

			case PositionType.PUT:
				;[amount0, amount1] = zeroForOne ? [0, tokenBalance] : [tokenBalance, 0]
				break

			case PositionType.PLAIN:
				;[amount0, amount1] = zeroForOne ? [ethAmount, tokenBalance] : [tokenBalance, ethAmount]
				break

			default:
				throw new Error(`invalid position type`)
		}

		const { liquidity: liquidityExpected, amount0: amount0Desired, amount1: amount1Desired } = await positionManager.computeLiquidityAmounts(
			positionType,
			tickCurrent,
			ticks[0],
			ticks[1],
			amount0,
			amount1,
		)

		const params: OpenPositionParams = {
			positionType,
			token0: token0.address,
			token1: token1.address,
			fee: fee,
			tickLower: ticks[0],
			tickUpper: ticks[1],
			amount0In: amount0Desired,
			amount1In: amount1Desired,
			amount0Desired: amount0Desired,
			amount1Desired: amount1Desired,
			amount0Min: 0,
			amount1Min: 0,
			deadline: constants.MaxUint256,
			recipient: trader.address,
		}

		// open new position

		await positionManager.connect(trader).openPosition(params, { value: zeroForOne ? amount0Desired : amount1Desired })

		const positionsCount = (await positionManager.positionsOf(trader.address)).toNumber()
		const positions = await positionManager.getAccountPositions(trader.address)
		const tokenId = positions[positionsCount - 1]

		const positionOwner = await nft.ownerOf(tokenId)
		const positionData = await positionManager.getPositionData(tokenId)

		const { token0: token0Address, token1: token1Address, fee: poolFee, liquidity, tickLower, tickUpper } = positionData

		const [ethBalance, balance0, balance1] = await Promise.all([
			ethers.provider.getBalance(positionManager.address),
			getTokenBalance(token0.address, positionManager.address),
			getTokenBalance(token1.address, positionManager.address),
		])

		expect(positionOwner).to.be.eq(positionManager.address)
		expect(token0Address).to.be.eq(token0.address)
		expect(token1Address).to.be.eq(token1.address)
		expect(poolFee).to.be.eq(fee)
		expect(tickLower).to.be.eq(ticks[0])
		expect(tickUpper).to.be.eq(ticks[1])
		expect(liquidity).to.be.gt(0)
		expect(ethBalance).to.be.eq(0)
		expect(balance0).to.be.eq(0)
		expect(balance1).to.be.eq(0)

		if (process.env.LOG_RESULTS === "true") {
			console.log(``)
			console.log(`====================================================================================================`)
			console.log(``)
			console.log(`Opened ${ccb(PositionType[positionType])} Position on ${ccb(`${token0.symbol}-${token1.symbol} (${fee / 10000}%)`)} Pool (UNI-V3 NFT ID: ${ccb(tokenId.toString())})`)
			console.log(``)
			console.log(`Current Tick: ${ccb(tickCurrent)}`)
			console.log(`Position Ticks: ${ccb([tickLower, tickUpper])}`)
			console.log(`Current Price: ${ccb(priceCurrent)}`)
			console.log(`Position Prices: ${ccb(prices)}`)
			console.log(`Liquidity: ${ccb(liquidity.toString())}`)
			console.log(`Amounts: ${ccb([formatUnits(amount0, token0.decimals), formatUnits(amount1, token1.decimals)])}`)
			console.log(`Token0 Balance: ${ccb(formatUnits(balance0, token0.decimals))}`)
			console.log(`Token0 Balance: ${ccb(formatUnits(balance1, token1.decimals))}`)
			console.log(``)
			console.log(`====================================================================================================`)
			console.log(``)
		}

		return tokenId
	}

	it(`openPosition`, async () => {
		await Promise.all(
			trades.map(async (data) => {
				await openPosition(PositionType.PUT, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, true)
				await openPosition(PositionType.CALL, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, false)
			})
		)
	})

	it(`increaseLiquidity`, async () => {
		await Promise.all(
			trades.map(async (data) => {
				const putId = await openPosition(PositionType.PUT, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, true)
				const callId = await openPosition(PositionType.CALL, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, false)

				const putDataBefore = await positionManager.getPositionData(putId)
				const callDataBefore = await positionManager.getPositionData(callId)

				const zeroForOne = isWrappedNative(data.token0.address)
				const token = zeroForOne ? data.token1 : data.token0
				const ethAmount = parseUnits("10")
				const tokenAmount = await oracle.ethForToken(token.address, PoolFee.MEDIUM, 1, ethAmount)

				await seedTokens(token.address, data.whale, data.trader.address, tokenAmount)

				const tokenBalance = await getTokenBalance(token.address, data.trader.address)

				const [amount0Desired, amount1Desired] = zeroForOne ? [ethAmount, tokenBalance] : [tokenBalance, ethAmount]

				const putParams: IncreaseLiquidityParams = {
					tokenId: putId,
					amount0Desired,
					amount1Desired,
					amount0Min: 0,
					amount1Min: 0,
					deadline: constants.MaxUint256,
				}

				const callParams: IncreaseLiquidityParams = {
					tokenId: callId,
					amount0Desired: zeroForOne ? ethAmount : 0,
					amount1Desired: zeroForOne ? 0 : ethAmount,
					amount0Min: 0,
					amount1Min: 0,
					deadline: constants.MaxUint256,
				}

				await positionManager.connect(data.trader).increaseLiquidity(putParams, { value: ethAmount })
				await positionManager.connect(data.trader).increaseLiquidity(callParams, { value: ethAmount })

				const putDataAfter = await positionManager.getPositionData(putId)
				const callDataAfter = await positionManager.getPositionData(callId)

				expect(putDataAfter.liquidity).to.be.gt(putDataBefore.liquidity)
				expect(callDataAfter.liquidity).to.be.gt(callDataBefore.liquidity)
			})
		)
	})

	it(`decreaseLiquidity`, async () => {
		await Promise.all(
			trades.map(async (data) => {
				const putId = await openPosition(PositionType.PUT, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, true)
				const callId = await openPosition(PositionType.CALL, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, false)

				const putDataBefore = await positionManager.getPositionData(putId)
				const callDataBefore = await positionManager.getPositionData(callId)

				await positionManager.connect(data.trader).decreaseLiquidity({
					tokenId: putId,
					liquidity: putDataBefore.liquidity.div(2),
					amount0Min: 0,
					amount1Min: 0,
					deadline: constants.MaxUint256
				})

				await positionManager.connect(data.trader).decreaseLiquidity({
					tokenId: callId,
					liquidity: callDataBefore.liquidity.div(2),
					amount0Min: 0,
					amount1Min: 0,
					deadline: constants.MaxUint256
				})

				const putDataAfter = await positionManager.getPositionData(putId)
				const callDataAfter = await positionManager.getPositionData(callId)

				const tokenBalancesBefore = await Promise.all([
					getTokenBalance(data.token0.address, data.trader.address),
					getTokenBalance(data.token1.address, data.trader.address),
				])

				await positionManager.connect(data.trader).collect({
					tokenId: putId,
					recipient: data.trader.address,
					amount0Max: 0,
					amount1Max: 0,
				})

				await positionManager.connect(data.trader).collect({
					tokenId: callId,
					recipient: data.trader.address,
					amount0Max: 0,
					amount1Max: 0,
				})

				const tokenBalancesAfter = await Promise.all([
					getTokenBalance(data.token0.address, data.trader.address),
					getTokenBalance(data.token1.address, data.trader.address),
				])

				expect(putDataBefore.liquidity).to.be.gt(putDataAfter.liquidity)
				expect(callDataBefore.liquidity).to.be.gt(callDataAfter.liquidity)
				expect(tokenBalancesAfter[0] && tokenBalancesAfter[1]).to.be.gt(0)
				expect(tokenBalancesAfter[0]).to.be.gt(tokenBalancesBefore[0])
				expect(tokenBalancesAfter[1]).to.be.gt(tokenBalancesBefore[1])
			})
		)
	})

	it(`withdrawNFT`, async () => {
		await Promise.all(
			trades.map(async (data) => {
				const putId = await openPosition(PositionType.PUT, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, true)
				const callId = await openPosition(PositionType.CALL, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, false)

				await positionManager.connect(data.trader).withdrawNFT(putId)
				await positionManager.connect(data.trader).withdrawNFT(callId)

				const [putOwner, callOwner, positionsCount] = await Promise.all([
					nft.ownerOf(putId),
					nft.ownerOf(callId),
					positionManager.positionsOf(data.trader.address)
				])

				expect(putOwner && callOwner).to.be.eq(data.trader.address)
				expect(positionsCount).to.be.eq(0)
			})
		)
	})

	it(`closePosition`, async () => {
		await Promise.all(
			trades.map(async (data) => {
				const putId = await openPosition(PositionType.PUT, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, true)
				const callId = await openPosition(PositionType.CALL, data.token0, data.token1, PoolFee.MEDIUM, data.whale, data.trader, false)

				const tokenBalancesBefore = await Promise.all([
					getTokenBalance(data.token0.address, data.trader.address),
					getTokenBalance(data.token1.address, data.trader.address),
				])

				const positionsCountBefore = await positionManager.positionsOf(data.trader.address)

				await positionManager.connect(data.trader).closePosition(
					{
						tokenId: putId,
						recipient: data.trader.address,
						deadline: constants.MaxUint256
					}
				)
				await positionManager.connect(data.trader).closePosition(
					{
						tokenId: callId,
						recipient: data.trader.address,
						deadline: constants.MaxUint256
					}
				)

				const tokenBalancesAfter = await Promise.all([
					getTokenBalance(data.token0.address, data.trader.address),
					getTokenBalance(data.token1.address, data.trader.address),
				])

				const positionsCountAfter = await positionManager.positionsOf(data.trader.address)

				expect(tokenBalancesAfter[0] && tokenBalancesAfter[1]).to.be.gt(0)
				expect(tokenBalancesAfter[0]).to.be.gt(tokenBalancesBefore[0])
				expect(tokenBalancesAfter[1]).to.be.gt(tokenBalancesBefore[1])
				expect(positionsCountAfter).to.be.eq(0)
				expect(positionsCountBefore).to.be.gt(positionsCountAfter)
			})
		)
	})

	const openPositionWithSwap = async (
		positionType: PositionType,
		tokenA: TokenModel,
		tokenB: TokenModel,
		fee: PoolFee,
		trader: SignerWithAddress,
	) => {
		const { pool, token0, token1, tickSpacing, tickCurrent, tick, invertPrice, zeroForOne } = await getPoolState(tokenA, tokenB, fee)

		const token = zeroForOne ? token1 : token0
		const ethAmount = parseUnits("10")
		const tokenAmount = await oracle.ethForToken(token.address, fee, 1, ethAmount)

		const { priceCurrent, prices, ticks } = getPositionRange(positionType, token0, token1, tickSpacing, tick, invertPrice)

		let amount0: BigNumberish, amount1: BigNumberish, amount0In: BigNumberish, amount1In: BigNumberish

		switch (positionType) {
			case PositionType.CALL:
				;[amount0In, amount1In] = zeroForOne ? [ethAmount, 0] : [0, ethAmount]
				amount0 = amount0In
				amount1 = amount1In
				break

			case PositionType.PUT:
				;[amount0In, amount1In] = zeroForOne ? [ethAmount, 0] : [0, ethAmount]
				amount0 = zeroForOne ? 0 : tokenAmount
				amount1 = zeroForOne ? tokenAmount : 0
				break

			case PositionType.PLAIN:
				;[amount0In, amount1In] = zeroForOne ? [ethAmount, tokenAmount] : [tokenAmount, ethAmount]
				amount0 = amount0In
				amount1 = amount1In
				break

			default:
				throw new Error(`invalid position type`)
		}

		const { liquidity: liquidityExpected, amount0: amount0Desired, amount1: amount1Desired } = await positionManager.computeLiquidityAmounts(
			positionType,
			tick,
			ticks[0],
			ticks[1],
			amount0,
			amount1,
		)

		const params: OpenPositionParams = {
			positionType,
			token0: token0.address,
			token1: token1.address,
			fee: fee,
			tickLower: ticks[0],
			tickUpper: ticks[1],
			amount0In: amount0In,
			amount1In: amount1In,
			amount0Desired: amount0Desired,
			amount1Desired: amount1Desired,
			amount0Min: 0,
			amount1Min: 0,
			deadline: constants.MaxUint256,
			recipient: trader.address,
		}

		await positionManager.connect(trader).openPositionWithSwap(params, { value: ethAmount })

		const positionsCount = (await positionManager.positionsOf(trader.address)).toNumber()
		const positions = await positionManager.getAccountPositions(trader.address)
		const tokenId = positions[positionsCount - 1]

		const positionOwner = await nft.ownerOf(tokenId)
		const positionData = await positionManager.getPositionData(tokenId)

		const { token0: token0Address, token1: token1Address, fee: poolFee, liquidity, tickLower, tickUpper } = positionData

		const [ethBalance, balance0, balance1] = await Promise.all([
			ethers.provider.getBalance(positionManager.address),
			getTokenBalance(token0.address, positionManager.address),
			getTokenBalance(token1.address, positionManager.address),
		])

		expect(positionOwner).to.be.eq(positionManager.address)
		expect(token0Address).to.be.eq(token0.address)
		expect(token1Address).to.be.eq(token1.address)
		expect(poolFee).to.be.eq(fee)
		expect(tickLower).to.be.eq(ticks[0])
		expect(tickUpper).to.be.eq(ticks[1])
		expect(liquidity).to.be.gt(0)
		expect(ethBalance).to.be.eq(0)
		expect(balance0).to.be.eq(0)
		expect(balance1).to.be.eq(0)

		if (process.env.LOG_RESULTS === "true") {
			console.log(``)
			console.log(`====================================================================================================`)
			console.log(``)
			console.log(`Opened ${ccb(PositionType[positionType])} Position on ${ccb(`${token0.symbol}-${token1.symbol} (${fee / 10000}%)`)} Pool (UNI-V3 NFT ID: ${ccb(tokenId.toString())})`)
			console.log(``)
			console.log(`Current Tick: ${ccb(tickCurrent)}`)
			console.log(`Position Ticks: ${ccb([tickLower, tickUpper])}`)
			console.log(`Current Price: ${ccb(priceCurrent)}`)
			console.log(`Position Prices: ${ccb(prices)}`)
			console.log(`Liquidity: ${ccb(liquidity.toString())}`)
			console.log(`Amounts: ${ccb([formatUnits(amount0, token0.decimals), formatUnits(amount1, token1.decimals)])}`)
			console.log(``)
			console.log(`Token0 Balance: ${ccb(formatUnits(balance0, token0.decimals))}`)
			console.log(`Token0 Balance: ${ccb(formatUnits(balance1, token1.decimals))}`)
			console.log(``)
			console.log(`====================================================================================================`)
			console.log(``)
		}

		return tokenId
	}

	it(`openPositionWithSwap`, async () => {
		await Promise.all(
			trades.map(async (data) => {
				await openPositionWithSwap(PositionType.PUT, data.token0, data.token1, PoolFee.MEDIUM, data.trader)
				await openPositionWithSwap(PositionType.CALL, data.token0, data.token1, PoolFee.MEDIUM, data.trader)
			})
		)
	})
})
