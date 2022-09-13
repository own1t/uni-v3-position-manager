// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./Strings.sol";

library SafeERC20 {
    error SafeApproveFailed();
    error SafeTransferFailed();
    error SafeTransferNativeFailed();
    error SafeTransferFromFailed();
    error SafeTransferFromNativeFailed();

    string private constant UNKNOWN = "???";

    function safeApprove(
        address token,
        address spender,
        uint256 value
    ) internal {
        if (isNative(token)) return;

        bool success;

        assembly {
            if iszero(token) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0x095ea7b300000000000000000000000000000000000000000000000000000000
            )
            mstore(add(ptr, 0x4), spender)
            mstore(add(ptr, 0x24), value)

            success := and(
                or(
                    and(eq(mload(0), 0x1), gt(returndatasize(), 0x1f)),
                    iszero(returndatasize())
                ),
                call(gas(), token, 0, ptr, 0x44, 0, 0x20)
            )
        }

        if (!success) revert SafeApproveFailed();
    }

    function safeTransfer(
        address token,
        address to,
        uint256 value
    ) internal {
        if (!isNative(token)) _safeTransfer(token, to, value);
        else safeTransferNative(to, value);
    }

    function _safeTransfer(
        address token,
        address to,
        uint256 value
    ) private {
        bool success;

        assembly {
            if or(iszero(token), iszero(value)) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0xa9059cbb00000000000000000000000000000000000000000000000000000000
            )
            mstore(add(ptr, 0x4), to)
            mstore(add(ptr, 0x24), value)

            success := and(
                or(
                    and(eq(mload(0), 0x1), gt(returndatasize(), 0x1f)),
                    iszero(returndatasize())
                ),
                call(gas(), token, 0, ptr, 0x44, 0, 0x20)
            )
        }

        if (!success) revert SafeTransferFailed();
    }

    function safeTransferNative(address to, uint256 value) internal {
        bool success;

        assembly {
            if or(iszero(to), iszero(value)) {
                revert(0, 0)
            }

            success := call(gas(), to, value, 0, 0, 0, 0)
        }

        if (!success) revert SafeTransferNativeFailed();
    }

    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value
    ) internal {
        if (isNative(token)) {
            if (msg.value < value) revert SafeTransferFromNativeFailed();
            return;
        }

        bool success;

        assembly {
            if or(iszero(token), iszero(value)) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0x23b872dd00000000000000000000000000000000000000000000000000000000
            )
            mstore(add(ptr, 0x4), from)
            mstore(add(ptr, 0x24), to)
            mstore(add(ptr, 0x44), value)

            success := and(
                or(
                    and(eq(mload(0), 0x1), gt(returndatasize(), 0x1f)),
                    iszero(returndatasize())
                ),
                call(gas(), token, 0, ptr, 0x64, 0, 0x20)
            )
        }

        if (!success) revert SafeTransferFromFailed();
    }

    function getAllowance(
        address token,
        address owner,
        address spender
    ) internal view returns (uint256 value) {
        if (isNative(token)) return type(uint256).max;

        assembly {
            if or(iszero(token), or(iszero(owner), iszero(spender))) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0xdd62ed3e00000000000000000000000000000000000000000000000000000000
            )
            mstore(add(ptr, 0x4), owner)
            mstore(add(ptr, 0x24), spender)

            if iszero(staticcall(gas(), token, ptr, 0x44, 0, 0x20)) {
                revert(0, 0)
            }

            value := mload(0)
        }
    }

    function getBalanceOf(address token, address account)
        internal
        view
        returns (uint256 value)
    {
        if (isNative(token)) return account.balance;

        assembly {
            if or(iszero(token), iszero(account)) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0x70a0823100000000000000000000000000000000000000000000000000000000
            )
            mstore(add(ptr, 0x4), account)

            if iszero(staticcall(gas(), token, ptr, 0x24, 0, 0x20)) {
                revert(0, 0)
            }

            value := mload(0)
        }
    }

    function getTotalSupply(address token)
        internal
        view
        returns (uint256 value)
    {
        if (isNative(token)) return 0;

        assembly {
            if iszero(token) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0x18160ddd00000000000000000000000000000000000000000000000000000000
            )

            if iszero(staticcall(gas(), token, ptr, 0x4, 0, 0x20)) {
                revert(0, 0)
            }

            value := mload(0)
        }
    }

    function getDecimals(address token) internal view returns (uint8 value) {
        if (isNative(token)) return 18;

        assembly {
            if iszero(token) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0x313ce56700000000000000000000000000000000000000000000000000000000
            )

            if iszero(staticcall(gas(), token, ptr, 0x4, 0, 0x20)) {
                revert(0, 0)
            }

            value := mload(0)
        }
    }

    function getSymbol(address token) internal view returns (string memory) {
        if (isNative(token)) return "ETH";

        bool success;
        bytes memory returnData;

        assembly {
            if iszero(token) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0x95d89b4100000000000000000000000000000000000000000000000000000000
            )

            success := staticcall(gas(), token, ptr, 0x4, 0, 0x20)

            returnData := mload(0)
        }

        return success ? Strings.bytesToString(returnData) : UNKNOWN;
    }

    function getName(address token) internal view returns (string memory) {
        if (isNative(token)) return "Ethereum";

        bool success;
        bytes memory returnData;

        assembly {
            if iszero(token) {
                revert(0, 0)
            }

            let ptr := mload(0x40)

            mstore(
                ptr,
                0x06fdde0300000000000000000000000000000000000000000000000000000000
            )

            success := staticcall(gas(), token, ptr, 0x4, 0, 0x20)

            returnData := mload(0)
        }

        return success ? Strings.bytesToString(returnData) : UNKNOWN;
    }

    function isNative(address token) internal pure returns (bool) {
        return token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    }
}
