// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IERC721Permit {
    function PERMIT_TYPEHASH() external pure returns (bytes32);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;
}
