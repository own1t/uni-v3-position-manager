// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

library PositionKey {
    function compute(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, tickLower, tickUpper));
    }
}
