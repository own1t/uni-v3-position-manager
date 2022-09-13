// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IUniswapV3Oracle {
    function UNISWAP_V3_FACTORY() external view returns (address);

    function WETH() external view returns (address);

    function USDC() external view returns (address);

    function getAmountsOut(
        bytes memory path,
        uint32 period,
        uint256 baseAmount
    ) external view returns (uint256[] memory amounts);

    function quote(
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint32 period,
        uint256 baseAmount
    ) external view returns (uint256 quoteAmount);

    function quoteSpot(
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint256 baseAmount
    ) external view returns (uint256 quoteAmount);

    function quoteTwap(
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint32 period,
        uint256 baseAmount
    ) external view returns (uint256 quoteAmount);

    function getSpotPrice(
        address baseToken,
        address quoteToken,
        uint24 fee
    ) external view returns (uint256);

    function getTwapPrice(
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint32 period
    ) external view returns (uint256);
}
