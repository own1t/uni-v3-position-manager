// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/external/Uniswap/IUniswapV3Pool.sol";
import "../libraries/PoolAddress.sol";

abstract contract ImmutableState {
    address public immutable WETH;
    address public immutable factory;
    address public immutable nft;

    constructor(
        address _weth,
        address _factory,
        address _nft
    ) {
        WETH = _weth;
        factory = _factory;
        nft = _nft;
    }

    function getPoolAddress(
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal view returns (address) {
        return
            PoolAddress.computeAddress(
                factory,
                PoolAddress.getPoolKey(tokenA, tokenB, fee)
            );
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(getPoolAddress(tokenA, tokenB, fee));
    }
}
