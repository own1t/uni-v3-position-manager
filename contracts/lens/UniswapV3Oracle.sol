// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/external/Uniswap/IUniswapV3Pool.sol";
import "../interfaces/external/IERC20Metadata.sol";
import "../interfaces/IUniswapV3Oracle.sol";
import "../libraries/FullMath.sol";
import "../libraries/Path.sol";
import "../libraries/PoolAddress.sol";
import "../libraries/SafeCast.sol";
import "../libraries/TickMath.sol";

contract UniswapV3Oracle is IUniswapV3Oracle {
    using Path for bytes;

    error InvalidPeriod();
    error ObservationFailed();

    address public immutable WETH;
    address public immutable USDC;
    address public immutable UNISWAP_V3_FACTORY;

    uint24 public immutable defaultPoolFee = 3000;
    uint32 public immutable defaultPeriod = 3600; // 1 hour

    constructor(
        address weth,
        address usdc,
        address factory
    ) {
        WETH = weth;
        USDC = usdc;
        UNISWAP_V3_FACTORY = factory;
    }

    function getPoolAddress(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (address) {
        return
            PoolAddress.computeAddress(
                UNISWAP_V3_FACTORY,
                PoolAddress.getPoolKey(tokenA, tokenB, fee)
            );
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) public view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(getPoolAddress(tokenA, tokenB, fee));
    }

    function tokenForEth(
        address baseToken,
        uint24 fee,
        uint32 period,
        uint256 baseAmount
    ) public view returns (uint256 quoteAmount) {
        return quote(baseToken, WETH, fee, period, baseAmount);
    }

    function ethForToken(
        address quoteToken,
        uint24 fee,
        uint32 period,
        uint256 baseAmount
    ) public view returns (uint256 quoteAmount) {
        return quote(WETH, quoteToken, fee, period, baseAmount);
    }

    function getAmountsOut(
        bytes memory path,
        uint32 period,
        uint256 baseAmount
    ) external view returns (uint256[] memory amounts) {
        address baseToken;
        address quoteToken;
        uint24 fee;
        uint256 i;
        uint256 length = path.numPools() + 1;

        amounts = new uint256[](length);
        amounts[0] = baseAmount;

        while (true) {
            bool hasMultiplePools = path.hasMultiplePools();

            (baseToken, quoteToken, fee) = path.decodeFirstPool();

            amounts[i + 1] = quote(
                baseToken,
                quoteToken,
                fee,
                period,
                amounts[i]
            );

            if (hasMultiplePools) {
                path = path.skipToken();
            } else {
                break;
            }

            unchecked {
                i = i + 1;
            }
        }
    }

    function getSpotPrice(
        address baseToken,
        address quoteToken,
        uint24 fee
    ) external view returns (uint256 price) {
        return
            quoteSpot(
                baseToken,
                quoteToken,
                fee,
                1 * 10**IERC20Metadata(baseToken).decimals()
            );
    }

    function getTwapPrice(
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint32 period
    ) external view returns (uint256 price) {
        return
            quoteTwap(
                baseToken,
                quoteToken,
                fee,
                period,
                1 * 10**IERC20Metadata(baseToken).decimals()
            );
    }

    function getPriceInUsd(
        address token,
        uint24 fee,
        uint32 period
    ) public view returns (uint256 price) {
        // ETH -> USDC
        if (token == WETH) return getEthPrice(fee, period);

        // token -> ETH
        uint256 priceInEth = getPriceInEth(token, fee, period);

        // ETH -> USDC
        return quoteTwap(WETH, USDC, defaultPoolFee, period, priceInEth);
    }

    function getPriceInUsd(address token)
        external
        view
        returns (uint256 price)
    {
        return getPriceInUsd(token, defaultPoolFee, 0);
    }

    function getPriceInEth(
        address token,
        uint24 fee,
        uint32 period
    ) public view returns (uint256 price) {
        return
            quoteTwap(
                token,
                WETH,
                fee,
                period,
                1 * 10**IERC20Metadata(token).decimals()
            );
    }

    function getPriceInEth(address token)
        external
        view
        returns (uint256 price)
    {
        return getPriceInEth(token, defaultPoolFee, 0);
    }

    function getEthPrice(uint24 fee, uint32 period)
        public
        view
        returns (uint256 ethPrice)
    {
        return quoteTwap(WETH, USDC, fee, period, 1 ether);
    }

    function getEthPrice() external view returns (uint256 ethPrice) {
        return getEthPrice(defaultPoolFee, 0);
    }

    function quoteSpot(
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint256 baseAmount
    ) public view returns (uint256 quoteAmount) {
        int24 spotTick = getSpotTick(getPool(baseToken, quoteToken, fee));
        return convert(baseToken < quoteToken, spotTick, baseAmount);
    }

    function quoteTwap(
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint32 period,
        uint256 baseAmount
    ) public view returns (uint256 quoteAmount) {
        int24 twapTick = getTwapTick(
            getPool(baseToken, quoteToken, fee),
            period != 0 ? period : defaultPeriod
        );

        return convert(baseToken < quoteToken, twapTick, baseAmount);
    }

    function quote(
        address baseToken,
        address quoteToken,
        uint24 fee,
        uint32 period,
        uint256 baseAmount
    ) public view returns (uint256 quoteAmount) {
        if (period == 0) {
            return quoteSpot(baseToken, quoteToken, fee, baseAmount);
        }

        int24 minTick;

        (int24 spotTick, int24 twapTick) = getTicks(
            getPool(baseToken, quoteToken, fee),
            period
        );

        if (baseToken < quoteToken) {
            minTick = spotTick < twapTick ? spotTick : twapTick;
        } else {
            minTick = spotTick > twapTick ? spotTick : twapTick;
        }

        return convert(baseToken < quoteToken, minTick, baseAmount);
    }

    function getTicks(IUniswapV3Pool pool, uint32 period)
        public
        view
        returns (int24 spot, int24 twap)
    {
        spot = getSpotTick(pool);
        twap = getTwapTick(pool, period != 0 ? period : defaultPeriod);
    }

    function getSpotTick(IUniswapV3Pool pool) private view returns (int24) {
        (
            ,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            ,
            ,

        ) = pool.slot0();

        if (observationCardinality < 2) revert ObservationFailed();

        (uint32 observationTimestamp, int56 tickCumulative, , ) = pool
            .observations(observationIndex);

        if (observationTimestamp != uint32(block.timestamp)) return tick;

        uint256 prevIndex = (uint256(observationIndex) +
            observationCardinality -
            1) % observationCardinality;

        (
            uint32 prevObservationTimestamp,
            int56 prevTickCumulative,
            ,
            bool prevInitialized
        ) = pool.observations(prevIndex);

        if (!prevInitialized) revert ObservationFailed();

        uint32 delta = observationTimestamp - prevObservationTimestamp;

        return
            int24(
                (tickCumulative - int56(uint56(prevTickCumulative))) /
                    int56(uint56(delta))
            );
    }

    function getTwapTick(IUniswapV3Pool pool, uint32 period)
        private
        view
        returns (int24 tick)
    {
        if (period == 0) revert InvalidPeriod();

        uint32[] memory periods = new uint32[](2);
        periods[0] = period;
        periods[1] = 0;

        (int56[] memory tickCumulatives, ) = pool.observe(periods);
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

        tick = int24(tickCumulativesDelta / int56(uint56(period)));

        if (
            tickCumulativesDelta < 0 &&
            (tickCumulativesDelta % int56(uint56(period)) != 0)
        ) {
            unchecked {
                tick = tick - 1;
            }
        }
    }

    function convert(
        bool zeroForOne,
        int24 tick,
        uint256 value
    ) private pure returns (uint256) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

        // 160 + 160 - 64 = 256; 96 + 96 - 64 = 128
        uint256 ratioX128 = FullMath.mulDiv(
            sqrtRatioX96,
            sqrtRatioX96,
            1 << 64
        );

        return
            zeroForOne
                ? FullMath.mulDiv(ratioX128, value, 1 << 128)
                : FullMath.mulDiv(1 << 128, value, ratioX128);
    }
}
