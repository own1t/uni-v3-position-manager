import { utils } from "ethers";
import { PoolFee } from "../../constants";


const ADDR_SIZE = 20
const FEE_SIZE = 3
const OFFSET = ADDR_SIZE + FEE_SIZE
const DATA_SIZE = OFFSET + ADDR_SIZE

export const encodePath = (tokens: string[], fees: PoolFee[]) => {
	if (tokens.length - 1 !== fees.length) throw new Error(`invalid path length`)

	let path = "0x"
	for (let i = 0; i < fees.length; i++) {
		path += tokens[i].slice(2)
		path += fees[i].toString(16).padStart(2 * FEE_SIZE, "0")
	}

	path += tokens[tokens.length - 1].slice(2)

	return path.toLowerCase()
}

export const decodePath = (path: string) => {
	let data = Buffer.from(path.slice(2), "hex")

	let tokens: string[] = []
	let fees: number[] = []
	let i = 0
	let dstToken: string = ""

	while (data.length >= DATA_SIZE) {
		const { tokenA, tokenB, fee } = decodeFirstPool(data)
		dstToken = tokenB
		tokens = [...tokens, tokenA]
		fees = [...fees, fee]
		data = data.slice((i + 1) * OFFSET)
		i += 1
	}

	tokens = [...tokens, dstToken]

	return { tokens, fees }
}

export const decodeFirstPool = (path: Buffer) => {
	const _tokenA = path.slice(0, ADDR_SIZE)
	const tokenA = utils.getAddress("0x" + _tokenA.toString("hex"))

	const _fee = path.slice(ADDR_SIZE, OFFSET)
	const fee = _fee.readUIntBE(0, FEE_SIZE)

	const _tokenB = path.slice(OFFSET, DATA_SIZE)
	const tokenB = utils.getAddress("0x" + _tokenB.toString("hex"))

	return { tokenA, tokenB, fee }
}
