// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IMulticall {
    function multicall(bytes[] memory calls)
        external
        payable
        returns (bytes[] memory returnData);
}
