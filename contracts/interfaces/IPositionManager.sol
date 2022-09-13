// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IPositionManager {
    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);

    event OracleUpdated(
        address indexed previousOracle,
        address indexed newOracle
    );

    enum PositionType {
        CALL,
        PUT
    }

    struct OpenPositionParams {
        PositionType positionType;
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0In;
        uint256 amount1In;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
        address recipient;
    }

    function openPosition(OpenPositionParams memory params)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    struct ClosePositionParams {
        uint256 tokenId;
        address recipient;
        uint256 deadline;
    }

    function closePosition(ClosePositionParams memory params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    function withdrawNFT(uint256 tokenId) external payable;
}
