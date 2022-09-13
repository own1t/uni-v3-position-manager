// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/IMulticall.sol";

abstract contract Multicall {
    function multicall(bytes[] calldata calls)
        public
        payable
        returns (bytes[] memory returnData)
    {
        uint256 length = calls.length;
        returnData = new bytes[](length);

        for (uint256 i; i < length; ) {
            bool success;

            (success, returnData[i]) = address(this).delegatecall(calls[i]);

            if (!success) revert(getRevertMsg(returnData[i]));

            unchecked {
                i = i + 1;
            }
        }
    }

    function getRevertMsg(bytes memory returnData)
        internal
        pure
        returns (string memory)
    {
        if (returnData.length < 68) return "tx reverted silently";

        assembly {
            returnData := add(returnData, 0x04)
        }

        return abi.decode(returnData, (string));
    }
}
