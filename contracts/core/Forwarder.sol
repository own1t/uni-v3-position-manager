// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/external/Uniswap/INonfungiblePositionManager.sol";
import "../interfaces/IForwarder.sol";
import "../base/Multicall.sol";
import "../base/Payments.sol";

abstract contract Forwarder is IForwarder, Multicall, Payments {
    error InsufficientAmounts();
    error SlippageCheck();

    function mint(MintParams memory params)
        public
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        if (!params.prepaid) {
            pull(params.token0, params.amount0Desired);
            pull(params.token1, params.amount1Desired);
        } else {
            params.amount0Desired = _balance(params.token0);
            params.amount1Desired = _balance(params.token1);
        }

        if (params.amount0Desired == 0 && params.amount1Desired == 0)
            revert InsufficientAmounts();

        approveIfNeeded(params.token0, nft);
        approveIfNeeded(params.token1, nft);

        bytes memory returnData = forwardToNFT(
            abi.encodeWithSelector(
                INonfungiblePositionManager.mint.selector,
                INonfungiblePositionManager.MintParams({
                    token0: params.token0,
                    token1: params.token1,
                    fee: params.fee,
                    tickLower: params.tickLower,
                    tickUpper: params.tickUpper,
                    amount0Desired: params.amount0Desired,
                    amount1Desired: params.amount1Desired,
                    amount0Min: params.amount0Min,
                    amount1Min: params.amount1Min,
                    deadline: params.deadline,
                    recipient: address(this)
                })
            )
        );

        (tokenId, liquidity, amount0, amount1) = abi.decode(
            returnData,
            (uint256, uint128, uint256, uint256)
        );

        if (params.amount0Min > amount0 || params.amount1Min > amount1)
            revert SlippageCheck();

        _addPosition(params.recipient, tokenId);

        if (params.amount0Desired > amount0) {
            refund(
                params.token0,
                params.amount0Desired - amount0,
                params.recipient
            );
        }

        if (params.amount1Desired > amount1) {
            refund(
                params.token1,
                params.amount1Desired - amount1,
                params.recipient
            );
        }

        refundETH();
    }

    function increaseLiquidity(IncreaseLiquidityParams memory params)
        public
        payable
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        _checkOwner(params.tokenId);

        if (params.amount0Desired == 0 && params.amount1Desired == 0)
            revert InsufficientAmounts();

        (, , address token0, address token1, , , , , , , , ) = getPositionData(
            params.tokenId
        );

        pull(token0, params.amount0Desired);
        pull(token1, params.amount1Desired);

        approveIfNeeded(token0, nft);
        approveIfNeeded(token1, nft);

        bytes memory returnData = forwardToNFT(
            abi.encodeWithSelector(
                INonfungiblePositionManager.increaseLiquidity.selector,
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: params.tokenId,
                    amount0Desired: params.amount0Desired,
                    amount1Desired: params.amount1Desired,
                    amount0Min: params.amount0Min,
                    amount1Min: params.amount1Min,
                    deadline: params.deadline
                })
            )
        );

        (liquidity, amount0, amount1) = abi.decode(
            returnData,
            (uint128, uint256, uint256)
        );

        if (params.amount0Min > amount0 || params.amount1Min > amount1)
            revert SlippageCheck();

        if (params.amount0Desired > amount0) {
            refund(token0, params.amount0Desired - amount0, msg.sender);
        }

        if (params.amount1Desired > amount1) {
            refund(token1, params.amount1Desired - amount1, msg.sender);
        }

        refundETH();
    }

    function decreaseLiquidity(DecreaseLiquidityParams memory params)
        public
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        _checkOwner(params.tokenId);

        bytes memory returnData = forwardToNFT(
            abi.encodeWithSelector(
                INonfungiblePositionManager.decreaseLiquidity.selector,
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: params.tokenId,
                    liquidity: params.liquidity,
                    amount0Min: params.amount0Min,
                    amount1Min: params.amount1Min,
                    deadline: params.deadline
                })
            )
        );

        (amount0, amount1) = abi.decode(returnData, (uint256, uint256));
    }

    function collect(CollectParams memory params)
        public
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        _checkOwner(params.tokenId);

        bytes memory returnData = forwardToNFT(
            abi.encodeWithSelector(
                INonfungiblePositionManager.collect.selector,
                INonfungiblePositionManager.CollectParams({
                    tokenId: params.tokenId,
                    recipient: params.recipient,
                    amount0Max: params.amount0Max == 0
                        ? type(uint128).max
                        : params.amount0Max,
                    amount1Max: params.amount1Max == 0
                        ? type(uint128).max
                        : params.amount1Max
                })
            )
        );

        (amount0, amount1) = abi.decode(returnData, (uint256, uint256));
    }

    function burn(uint256 tokenId) public payable {
        _checkOwner(tokenId);

        _clearPosition(msg.sender, tokenId);

        forwardToNFT(
            abi.encodeWithSelector(
                INonfungiblePositionManager.burn.selector,
                tokenId
            )
        );
    }

    function forwardToNFT(bytes memory data)
        public
        payable
        returns (bytes memory returnData)
    {
        bool success;
        (success, returnData) = nft.call(data);

        if (!success) {
            assembly {
                returnData := add(returnData, 0x04)
            }

            revert(getRevertMsg(returnData));
        }
    }

    function getPositionData(uint256 tokenId)
        public
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        return INonfungiblePositionManager(nft).positions(tokenId);
    }

    function _addPosition(address account, uint256 tokenId) internal virtual;

    function _clearPosition(address account, uint256 tokenId) internal virtual;

    function _checkOwner(uint256 tokenId) internal view virtual;
}
