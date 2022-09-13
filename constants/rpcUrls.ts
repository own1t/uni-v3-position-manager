import { ChainId } from "./enums";
import { Mapping } from "./types";

require("dotenv").config()

export const RPC_URL: Mapping<string> = {
	[ChainId.MAINNET]: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
	[ChainId.OPTIMISM]: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
	[ChainId.POLYGON]: `https://polygon-mainnet.g.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
	[ChainId.ARBITRUM]: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
	[ChainId.CELO]: `https://forno.celo.org`,
}
