// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./IERC721Metadata.sol";

interface IERC721Enumerable is IERC721Metadata {
    function totalSupply() external view returns (uint256);

    function tokenOfOwnerByIndex(address owner, uint256 index)
        external
        view
        returns (uint256);

    function tokenByIndex(uint256 index) external view returns (uint256);
}
