import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import { ChainId, RPC_URL } from "./constants";

dotenv.config()

const accounts = {
	mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk"
}

const config: HardhatUserConfig = {
	solidity: {
		compilers: [
			{
				version: "0.8.10",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				}
			}
		],
	},
	namedAccounts: {
		deployer: {
			default: 0,
		}
	},
	networks: {
		hardhat: {
			forking: {
				url: RPC_URL[ChainId.MAINNET],
			},
			initialBaseFeePerGas: 0,
			allowUnlimitedContractSize: true,
			blockGasLimit: 0x1fffffffffffff,
			gas: 12000000,
		},
		mainnet: {
			url: RPC_URL[ChainId.MAINNET],
			chainId: ChainId.MAINNET,
			accounts,
			live: true,
			saveDeployments: true,
		},
		optimism: {
			url: RPC_URL[ChainId.OPTIMISM],
			chainId: ChainId.OPTIMISM,
			accounts,
			live: true,
			saveDeployments: true,
		},
		polygon: {
			url: RPC_URL[ChainId.POLYGON],
			chainId: ChainId.POLYGON,
			accounts,
			live: true,
			saveDeployments: true,
		},
		arbitrum: {
			url: RPC_URL[ChainId.ARBITRUM],
			chainId: ChainId.ARBITRUM,
			accounts,
			live: true,
			saveDeployments: true,
		},
		celo: {
			url: RPC_URL[ChainId.CELO],
			chainId: ChainId.CELO,
			accounts,
			live: true,
			saveDeployments: true,
		},
	},
	gasReporter: {
		enabled: true,
		currency: "USD",
	},
	mocha: {
		timeout: 500000,
	},
	contractSizer: {
		alphaSort: true,
		disambiguatePaths: false,
		runOnCompile: true,
		strict: true,
		only: [],
		except: [],
	}
};

export default config;
