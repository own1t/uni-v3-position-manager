// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ISwap {
    function exactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external payable returns (uint256 amountOut);

    function exactInput(
        bytes memory path,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external payable returns (uint256 amountOut);
}
