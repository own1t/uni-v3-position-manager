# Uniswap V3 Position Manager

add .env before running tests

```shell

ALCHEMY_API_KEY=YOUR_API_KEY

LOG_RESULTS=false

```

to run tests

```shell

# to run tests for UniswapV3Oracle
npm test ./test/oracle.ts

# to run tests for PositionManager (creates both put and call positions on ETH-Stable pools)
npm test ./test/index/ts

```
