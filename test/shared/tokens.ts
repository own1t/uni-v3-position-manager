import { DAI_ADDRESS, LINK_ADDRESS, UNI_ADDRESS, USDC_ADDRESS, USDT_ADDRESS, WBTC_ADDRESS, WETH_ADDRESS } from "../../constants/addresses";
import { ChainId } from "../../constants/enums";
import { TokenModel } from "../../constants/types";


export const getStableList = (chainId: ChainId = ChainId.MAINNET): { dai: TokenModel, usdc: TokenModel, usdt: TokenModel } => {
	const dai = {
		chainId: chainId,
		address: DAI_ADDRESS[chainId],
		name: "Dai Stablecoin",
		symbol: "DAI",
		decimals: 18,
	}

	const usdc = {
		chainId: chainId,
		address: USDC_ADDRESS[chainId],
		name: "USDCoin",
		symbol: "USDC",
		decimals: 6,
	}

	const usdt = {
		chainId: chainId,
		address: USDT_ADDRESS[chainId],
		name: "Tether USD",
		symbol: "USDT",
		decimals: 6,
	}

	return { dai, usdc, usdt }
}

export const getTokenList = (chainId: ChainId = ChainId.MAINNET): {
	wbtc: TokenModel, weth: TokenModel, link: TokenModel, uni: TokenModel
} => {

	const wbtc = {
		chainId: chainId,
		address: WBTC_ADDRESS[chainId],
		name: "Wrapped BTC",
		symbol: "WBTC",
		decimals: 8,
	}

	const weth = {
		chainId: chainId,
		address: WETH_ADDRESS[chainId],
		name: "Wrapped Ether",
		symbol: "WETH",
		decimals: 18,
	}

	const link = {
		chainId: chainId,
		address: LINK_ADDRESS[chainId],
		name: "ChainLink Token",
		symbol: "LINK",
		decimals: 18,
	}

	const uni = {
		chainId: chainId,
		address: UNI_ADDRESS[chainId],
		name: "Uniswap",
		symbol: "UNI",
		decimals: 18,
	}

	return { wbtc, weth, link, uni }
}
