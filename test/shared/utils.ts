import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber, BigNumberish, constants, utils } from "ethers";
import { ethers, network } from "hardhat";
import { ChainId, NATIVE_ADDRESS, RPC_URL, TokenModel, WRAPPED_NATIVE_ADDRESS } from "../../constants";


export const switchChains = async (chainId: ChainId, blockNumber?: number) => {
	const jsonRpcUrl = RPC_URL[chainId]

	await network.provider.request({
		method: "hardhat_reset",
		params: [
			{
				chainId: chainId,
				forking:
					blockNumber ? {
						jsonRpcUrl: jsonRpcUrl,
						blockNumber: blockNumber,
					} : {
						jsonRpcUrl: jsonRpcUrl,
					},
			},
		],
	})
}

export const seedTokens = async (tokenAddress: string, whaleAddress: string, recipient: string, seedAmount: BigNumber) => {
	await impersonateAccount(whaleAddress)
	await setBalance(whaleAddress, parseUnits("1"))

	const whale = ethers.provider.getSigner(whaleAddress)
	const token = await ethers.getContractAt("IERC20Metadata", tokenAddress, whale)

	const tx = await token.transfer(recipient, seedAmount)
	const receipt = await tx.wait()

	return receipt
}

export const sortTokens = <T extends string | TokenModel>(tokens: T[]): T[] => {
	return tokens.sort(
		(tokenA, tokenB) => utils.getAddress(typeof tokenA === "string" ? tokenA : tokenA.address) < utils.getAddress(typeof tokenB === "string" ? tokenB : tokenB.address) ? -1 : 1
	)
}

export const getTokenBalance = async (tokenAddress: string, account: string) => {
	const token = await ethers.getContractAt("IERC20Metadata", tokenAddress)

	const balance = await token.balanceOf(account)

	return balance
}

export const approve = async (tokenAddress: string, spender: string, signer: SignerWithAddress, amount?: BigNumber) => {
	const token = await ethers.getContractAt("IERC20Metadata", tokenAddress, signer)

	const tx = await token.approve(spender, amount ?? constants.MaxUint256)
	const receipt = await tx.wait()

	return receipt
}

export const isSameAddress = (addressA: string, addressB: string) => {
	return utils.getAddress(addressA) === utils.getAddress(addressB)
}

export const isNative = (tokenAddress: string) => {
	return isSameAddress(tokenAddress, NATIVE_ADDRESS)
}

export const isWrappedNative = (tokenAddress: string) => {
	return Object.values(WRAPPED_NATIVE_ADDRESS).includes(utils.getAddress(tokenAddress))
}

export const formatUnits = (value: BigNumberish, unit?: number) => {
	return utils.formatUnits(value, unit)
}

export const parseUnits = (value: BigNumberish, unit?: number) => {
	return utils.parseUnits(value.toString(), unit)
}
