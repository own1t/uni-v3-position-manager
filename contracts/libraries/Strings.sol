// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

library Strings {
    error InsufficientHexLength();

    string private constant UNKNOWN = "???";
    bytes16 private constant HEX_SYMBOLS = "0123456789abcdef";
    uint8 private constant ADDRESS_LENGTH = 20;

    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (value != 0) {
            unchecked {
                digits = digits - 1;
            }

            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }

    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }

        uint256 temp = value;
        uint256 length;

        while (temp != 0) {
            temp >>= 8;

            unchecked {
                length = length + 1;
            }
        }

        return toHexString(value, length);
    }

    function toHexString(uint256 value, uint256 length)
        internal
        pure
        returns (string memory)
    {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";

        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }

        if (value != 0) revert InsufficientHexLength();

        return string(buffer);
    }

    function toHexString(address addr) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), ADDRESS_LENGTH);
    }

    function bytesToString(bytes memory data)
        internal
        pure
        returns (string memory)
    {
        if (data.length == 32) {
            uint256 i;

            while (i < 32 && data[i] != 0) {
                unchecked {
                    i = i + 1;
                }
            }

            bytes memory bytesArray = new bytes(i);

            for (i = 0; i < 32 && data[i] != 0; ) {
                bytesArray[i] = data[i];

                unchecked {
                    i = i + 1;
                }
            }

            return string(bytesArray);
        } else if (data.length >= 64) return abi.decode(data, (string));
        else return UNKNOWN;
    }
}
