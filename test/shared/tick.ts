import bn from "bignumber.js";
import Decimal from "decimal.js";
import { PositionType, TokenModel } from "../../constants";

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

const Q96 = new bn(2).pow(96)
const BASE_TICK = 1.0001
const MIN_TICK = -887272
const MAX_TICK = -MIN_TICK

export const baseLog = (x: number, y: number) => {
	return Math.log(y) / Math.log(x)
}

export const encodeSqrtRatioX96 = (price: number | string | bn) => {
	return new bn(price).sqrt().multipliedBy(new bn(2).pow(96)).integerValue(3);
}

export const formatSqrtRatioX96 = (sqrtRatioX96: bn, decimals0: number, decimals1: number) => {
	Decimal.set({ toExpPos: 9_999_999, toExpNeg: -9_999_999 })

	let ratio = new Decimal(((parseInt(sqrtRatioX96.toString()) / 2 ** 96) ** 2).toString())

	if (decimals1 < decimals0) {
		ratio = ratio.mul(new bn(10).pow(decimals0 - decimals1).toString())
	} else {
		ratio = ratio.div(new bn(10).pow(decimals1 - decimals0).toString())
	}

	return parseFloat(ratio.toString())
}

export const expandDecimals = (n: number, decimals: number) => {
	return new bn(n).multipliedBy(new bn(10).pow(decimals));
}

export const getMinTick = (tickSpacing: number) => {
	return Math.ceil(-887272 / tickSpacing) * tickSpacing
}

export const getMaxTick = (tickSpacing: number) => {
	return Math.floor(887272 / tickSpacing) * tickSpacing
}

export const getNearestUsableTick = (tick: number, tickSpacing: number) => {
	const rounded = Math.round(tick / tickSpacing) * tickSpacing

	if (rounded < MIN_TICK) return rounded + tickSpacing
	else if (rounded > MAX_TICK) return rounded - tickSpacing
	else return rounded
}

export const getPriceFromTick = (tick: number, decimals0: number, decimals1: number) => {
	const sqrtRatioX96 = new bn(Math.pow(Math.sqrt(BASE_TICK), tick)).multipliedBy(Q96)

	const price = formatSqrtRatioX96(sqrtRatioX96, decimals0, decimals1)

	return { x: price, y: 1 / price }
}

export const getTickFromPrice = (price: number, decimals0: number, decimals1: number, invertPrice: boolean, tickSpacing?: number) => {
	let denominator: bn, numerator: bn

	if (invertPrice) {
		denominator = expandDecimals(1, decimals1)
		numerator = expandDecimals(price, decimals0)
	} else {
		denominator = expandDecimals(price, decimals1)
		numerator = expandDecimals(1, decimals0)
	}

	denominator = encodeSqrtRatioX96(denominator)
	numerator = encodeSqrtRatioX96(numerator)

	const sqrtRatioX96 = mulDiv(denominator, Q96, numerator).div(Q96).toNumber()

	const tick = Math.round(baseLog(Math.sqrt(BASE_TICK), sqrtRatioX96))

	return tickSpacing ? getNearestUsableTick(tick, tickSpacing) : tick
}

export const mulDiv = (x: bn, y: bn, denominator: bn) => {
	return x.multipliedBy(y).div(denominator)
}

export const getPositionRange = (
	positionType: PositionType,
	token0: TokenModel,
	token1: TokenModel,
	tickSpacing: number,
	tick: number,
	invertPrice: boolean
) => {
	const price = getPriceFromTick(tick, token0.decimals, token1.decimals)
	const priceCurrent = !invertPrice ? price.x : price.y
	const priceNext = priceCurrent * (1 + (tickSpacing / 10000))

	let midPrice: number
	let prices: [number, number]

	switch (positionType) {
		case PositionType.CALL:
			midPrice = priceCurrent * 1.15
			prices = [midPrice * 1.15, priceNext]
			break

		case PositionType.PUT:
			midPrice = priceCurrent * .9
			prices = [midPrice * .9, priceNext]
			break

		default:
			throw new Error(`invalid position type`)
	}

	prices = prices.sort((a, b) => a - b)

	const ticks = [
		getTickFromPrice(prices[0], token0.decimals, token1.decimals, invertPrice, tickSpacing),
		getTickFromPrice(prices[1], token0.decimals, token1.decimals, invertPrice, tickSpacing),
	].sort((a, b) => a - b)

	return { priceCurrent, prices, ticks }
}
