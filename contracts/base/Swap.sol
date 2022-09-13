// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/ISwap.sol";
import "../libraries/Path.sol";
import "../libraries/SafeCast.sol";
import "../libraries/TickMath.sol";
import "./Payments.sol";

abstract contract Swap is ISwap, Payments {
    using Path for bytes;

    error InsufficientAmountOut();
    error InvalidPool();

    struct SwapCallbackData {
        bytes path;
        address payer;
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        require(amount0Delta > 0 || amount1Delta > 0);

        SwapCallbackData memory decoded = abi.decode(data, (SwapCallbackData));

        (address tokenIn, address tokenOut, uint24 fee) = decoded
            .path
            .decodeFirstPool();

        address pool = getPoolAddress(tokenIn, tokenOut, fee);

        if (msg.sender != pool) revert InvalidPool();

        pay(
            tokenIn,
            decoded.payer,
            pool,
            amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta)
        );
    }

    function _swap(
        uint256 amountIn,
        address recipient,
        SwapCallbackData memory data
    ) private returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = data
            .path
            .decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = getPool(tokenIn, tokenOut, fee).swap(
            recipient != address(0) ? recipient : address(this),
            zeroForOne,
            SafeCast.toInt256(amountIn),
            zeroForOne
                ? TickMath.MIN_SQRT_RATIO + 1
                : TickMath.MAX_SQRT_RATIO - 1,
            abi.encode(data)
        );

        amountOut = uint256(-(zeroForOne ? amount1 : amount0));
    }

    function exactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) public payable returns (uint256 amountOut) {
        bool alreadyPaid;

        if (amountIn == 0) {
            alreadyPaid = true;
            amountIn = _balance(tokenIn);
        }

        amountOut = _swap(
            amountIn,
            recipient,
            SwapCallbackData({
                path: abi.encodePacked(tokenIn, fee, tokenOut),
                payer: alreadyPaid ? address(this) : msg.sender
            })
        );

        if (amountOutMin > amountOut) revert InsufficientAmountOut();
    }

    function exactInput(
        bytes memory path,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) public payable returns (uint256 amountOut) {
        bool alreadyPaid;

        if (amountIn == 0) {
            alreadyPaid = true;
            (address tokenIn, , ) = path.decodeFirstPool();
            amountIn = _balance(tokenIn);
        }

        address payer = alreadyPaid ? address(this) : msg.sender;

        while (true) {
            bool hasMultiplePools = path.hasMultiplePools();

            amountIn = _swap(
                amountIn,
                hasMultiplePools ? address(this) : recipient,
                SwapCallbackData({path: path.getFirstPool(), payer: payer})
            );

            if (hasMultiplePools) {
                payer = address(this);
                path = path.skipToken();
            } else {
                amountOut = amountIn;
                break;
            }
        }

        if (amountOutMin > amountOut) revert InsufficientAmountOut();
    }
}
