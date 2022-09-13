import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import chalk from "chalk";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

import { ChainId, PoolFee, TokenModel, UNISWAP_V3_CONTRACTS, USDC_ADDRESS, WETH_ADDRESS } from "../constants";
import { decodePath, encodePath } from "./shared/path";
import { getStableList, getTokenList } from "./shared/tokens";
import { formatUnits, parseUnits, switchChains } from "./shared/utils";


const setPaths = (paths: { tokens: TokenModel[], fees: PoolFee[], baseAmount: BigNumber }[]) => {
	return paths.map(({ tokens, fees, baseAmount }) => ({
		path: encodePath(tokens.map((token) => token.address), fees),
		baseToken: tokens[0],
		routeToken: tokens[1],
		quoteToken: tokens[tokens.length - 1],
		baseAmount
	}))
}

const ccb = (value: any) => chalk.cyanBright(value.toString())

describe("UniswapV3Oracle", () => {
	const chainId = ChainId.MAINNET

	before(async () => {
		await switchChains(chainId)
	})

	const createFixture = async () => {
		const [deployer] = await ethers.getSigners()

		const quoter = await ethers.getContractAt("IQuoter", UNISWAP_V3_CONTRACTS.QUOTER)

		const OracleDeployer = await ethers.getContractFactory("UniswapV3Oracle", deployer)
		const oracle = await OracleDeployer.deploy(WETH_ADDRESS[chainId], USDC_ADDRESS[chainId], UNISWAP_V3_CONTRACTS.FACTORY)

		const { dai, usdc, usdt } = getStableList(chainId)
		const { link, uni, wbtc, weth } = getTokenList(chainId)

		const data = [
			{ tokens: [usdc, weth, wbtc], fees: [PoolFee.MEDIUM, PoolFee.MEDIUM], baseAmount: parseUnits("50000", usdc.decimals) },
			{ tokens: [wbtc, weth, usdc], fees: [PoolFee.MEDIUM, PoolFee.MEDIUM], baseAmount: parseUnits("2.5", wbtc.decimals) },
			{ tokens: [usdt, weth, wbtc], fees: [PoolFee.MEDIUM, PoolFee.MEDIUM], baseAmount: parseUnits("50000", usdt.decimals) },
			{ tokens: [dai, weth, wbtc], fees: [PoolFee.MEDIUM, PoolFee.MEDIUM], baseAmount: parseUnits("50000", dai.decimals) },
			{ tokens: [uni, weth, wbtc], fees: [PoolFee.MEDIUM, PoolFee.MEDIUM], baseAmount: parseUnits("75000", uni.decimals) },
			{ tokens: [uni, weth, link], fees: [PoolFee.MEDIUM, PoolFee.MEDIUM], baseAmount: parseUnits("75000", uni.decimals) },
			{ tokens: [uni, weth, usdc], fees: [PoolFee.MEDIUM, PoolFee.MEDIUM], baseAmount: parseUnits("75000", uni.decimals) },
		]

		const paths = setPaths(data)

		return { paths, oracle, quoter }
	}

	it("getAmountsOut", async () => {
		const { paths, oracle, quoter } = await loadFixture(createFixture)

		await Promise.all(
			paths.map(async ({ path, baseToken, routeToken, quoteToken, baseAmount }) => {
				const pool = decodePath(path)

				expect(baseToken.address).to.be.eq(pool.tokens[0])
				expect(routeToken.address).to.be.eq(pool.tokens[1])
				expect(quoteToken.address).to.be.eq(pool.tokens[2])

				const amountsOut = await oracle.getAmountsOut(path, 1, baseAmount)
				amountsOut.forEach((value) => expect(value).to.be.gt(0))
				const amountOut = amountsOut[amountsOut.length - 1]

				const quoterAmountOut = await quoter.callStatic.quoteExactInput(path, baseAmount)

				const delta = amountOut.mul(1000).div(10000)

				expect(amountOut).to.be.closeTo(quoterAmountOut, delta)

				if (process.env.LOG_RESULTS === "true") {
					console.log(``)
					console.log(`====================================================================================================`)
					console.log(``)

					console.log(`BaseToken: ${ccb(baseToken.symbol)} | ${ccb(baseToken.address)}`)
					console.log(`RouteToken: ${ccb(routeToken.symbol)} | ${ccb(routeToken.address)}`)
					console.log(`QuoteToken: ${ccb(quoteToken.symbol)} | ${ccb(quoteToken.address)}`)

					console.log(``)
					console.log(`Oracle Result: ${ccb(formatUnits(amountOut, quoteToken.decimals))}`)
					console.log(`Quoter Result: ${ccb(formatUnits(quoterAmountOut, quoteToken.decimals))}`)

					console.log(``)
					console.log(`====================================================================================================`)
					console.log(``)
				}
			})
		)
	})
})