// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/external/Uniswap/INonfungiblePositionManager.sol";
import "../interfaces/external/IERC721Receiver.sol";
import "../interfaces/IPositionManager.sol";
import "../interfaces/IUniswapV3Oracle.sol";
import "../libraries/LiquidityAmounts.sol";
import "../libraries/ReentrancyGuard.sol";
import "../libraries/TickMath.sol";
import "../base/SelfPermit.sol";
import "../base/Swap.sol";
import "./Forwarder.sol";

contract PositionManager is
    IPositionManager,
    Forwarder,
    ReentrancyGuard,
    SelfPermit,
    Swap
{
    error InvalidOwner();
    error InvalidToken();

    mapping(address => uint256[]) public accountPositions;
    mapping(uint256 => address) public ownerOf;

    IUniswapV3Oracle public oracle;
    address public owner;

    constructor(
        address _weth,
        address _factory,
        address _nft,
        address _oracle
    ) ImmutableState(_weth, _factory, _nft) {
        owner = msg.sender;
        emit OwnerUpdated(address(0), msg.sender);

        oracle = IUniswapV3Oracle(_oracle);
        emit OracleUpdated(address(0), _oracle);
    }

    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external returns (bytes4) {
        if (msg.sender != nft) revert InvalidToken();

        _addPosition(from, tokenId);

        return this.onERC721Received.selector;
    }

    function openPosition(OpenPositionParams calldata params)
        public
        payable
        lock
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        (uint160 sqrtRatioX96, , , , , , ) = getPool(
            params.token0,
            params.token1,
            params.fee
        ).slot0();

        (, amount0, amount1) = _computeLiquidityAmounts(
            params.positionType,
            sqrtRatioX96,
            TickMath.getSqrtRatioAtTick(params.tickLower),
            TickMath.getSqrtRatioAtTick(params.tickUpper),
            params.amount0Desired,
            params.amount1Desired
        );

        (tokenId, liquidity, amount0, amount1) = mint(
            MintParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                prepaid: false,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                deadline: params.deadline,
                recipient: params.recipient
            })
        );
    }

    function openPositionWithSwap(OpenPositionParams calldata params)
        public
        payable
        lock
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        (uint160 sqrtRatioX96, , , , , , ) = getPool(
            params.token0,
            params.token1,
            params.fee
        ).slot0();

        if (
            params.amount0In > params.amount0Desired ||
            params.amount1In > params.amount1Desired
        ) {
            bool zeroForOne = params.amount0In > params.amount0Desired;

            if (zeroForOne) {
                amount1 = exactInputSingle(
                    params.token0,
                    params.token1,
                    params.fee,
                    params.amount0In - params.amount0Desired,
                    0,
                    address(this)
                );
            } else {
                amount0 = exactInputSingle(
                    params.token1,
                    params.token0,
                    params.fee,
                    params.amount1In - params.amount1Desired,
                    0,
                    address(this)
                );
            }
        }

        (, amount0, amount1) = _computeLiquidityAmounts(
            params.positionType,
            sqrtRatioX96,
            TickMath.getSqrtRatioAtTick(params.tickLower),
            TickMath.getSqrtRatioAtTick(params.tickUpper),
            amount0,
            amount1
        );

        if (params.token0 == WETH || params.token1 == WETH)
            wrap(address(this).balance);

        (tokenId, liquidity, amount0, amount1) = mint(
            MintParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                prepaid: true,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                deadline: params.deadline,
                recipient: params.recipient
            })
        );
    }

    function closePosition(ClosePositionParams memory params)
        public
        payable
        lock
        returns (uint256 amount0, uint256 amount1)
    {
        _checkOwner(params.tokenId);

        _clearPosition(msg.sender, params.tokenId);

        (, , , , , , , uint128 liquidity, , , , ) = getPositionData(
            params.tokenId
        );

        forwardToNFT(
            abi.encodeWithSelector(
                INonfungiblePositionManager.decreaseLiquidity.selector,
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: params.tokenId,
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: params.deadline
                })
            )
        );

        bytes memory returnData = forwardToNFT(
            abi.encodeWithSelector(
                INonfungiblePositionManager.collect.selector,
                INonfungiblePositionManager.CollectParams({
                    tokenId: params.tokenId,
                    recipient: params.recipient,
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                })
            )
        );

        (amount0, amount1) = abi.decode(returnData, (uint256, uint256));

        forwardToNFT(
            abi.encodeWithSelector(
                INonfungiblePositionManager.burn.selector,
                params.tokenId
            )
        );
    }

    function withdrawNFT(uint256 tokenId) public payable lock {
        _checkOwner(tokenId);

        _clearPosition(msg.sender, tokenId);

        INonfungiblePositionManager(nft).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );
    }

    function getAccountPositions(address account)
        public
        view
        returns (uint256[] memory)
    {
        return accountPositions[account];
    }

    function positionsOf(address account) public view returns (uint256) {
        return accountPositions[account].length;
    }

    function computeLiquidityAmounts(
        PositionType positionType,
        int24 tickCurrent,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    )
        external
        pure
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        return
            _computeLiquidityAmounts(
                positionType,
                TickMath.getSqrtRatioAtTick(tickCurrent),
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                amount0Desired,
                amount1Desired
            );
    }

    function _addPosition(address account, uint256 tokenId)
        internal
        virtual
        override
    {
        accountPositions[account].push(tokenId);
        ownerOf[tokenId] = account;
    }

    function _clearPosition(address account, uint256 tokenId)
        internal
        virtual
        override
    {
        uint256[] memory _positions = accountPositions[account];
        uint8 length = uint8(_positions.length);
        uint256 tokenIndex = length;

        for (uint8 i; i < length; ) {
            if (_positions[i] == tokenId) {
                tokenIndex = i;
                break;
            }

            unchecked {
                i = i + 1;
            }
        }

        if (tokenIndex == length) revert InvalidToken();

        uint256[] storage positions = accountPositions[account];
        positions[tokenIndex] = positions[positions.length - 1];
        positions.pop();

        delete ownerOf[tokenId];
    }

    function _checkOwner(uint256 tokenId) internal view virtual override {
        if (msg.sender != ownerOf[tokenId]) revert InvalidOwner();
    }

    function _computeLiquidityAmounts(
        PositionType positionType,
        uint160 sqrtRatioX96,
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint256 amount0Desired,
        uint256 amount1Desired
    )
        internal
        pure
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        if (amount0Desired != 0 && amount1Desired == 0) {
            liquidity = LiquidityAmounts.getLiquidityForAmount0(
                positionType == PositionType.PUT ? sqrtRatioX96 : sqrtRatioAX96,
                sqrtRatioBX96,
                amount0Desired
            );
        } else if (amount0Desired == 0 && amount1Desired != 0) {
            liquidity = LiquidityAmounts.getLiquidityForAmount1(
                sqrtRatioAX96,
                positionType == PositionType.PUT ? sqrtRatioX96 : sqrtRatioBX96,
                amount1Desired
            );
        } else {
            liquidity = LiquidityAmounts.getLiquidityForAmounts(
                sqrtRatioX96,
                sqrtRatioAX96,
                sqrtRatioBX96,
                amount0Desired,
                amount1Desired
            );
        }

        (amount0, amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtRatioX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            liquidity
        );
    }

    function setOwner(address newOwner) external {
        require(msg.sender == owner);

        emit OwnerUpdated(msg.sender, newOwner);

        owner = newOwner;
    }

    function setOracle(address newOracle) external {
        require(msg.sender == owner);

        emit OracleUpdated(address(oracle), newOracle);

        oracle = IUniswapV3Oracle(newOracle);
    }
}
