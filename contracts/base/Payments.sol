// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../libraries/SafeERC20.sol";
import "./Wrapper.sol";

abstract contract Payments is Wrapper {
    using SafeERC20 for address;

    error InsufficientValue();

    receive() external payable {}

    function approveIfNeeded(address token, address spender) internal {
        uint256 allowance = token.getAllowance(address(this), spender);
        if (allowance == 0) token.safeApprove(spender, type(uint256).max);
    }

    function pay(
        address token,
        address payer,
        address recipient,
        uint256 value
    ) internal {
        if (token == WETH && address(this).balance >= value) {
            wrap(value);

            if (recipient != address(this))
                token.safeTransfer(recipient, value);
        } else if (payer == address(this)) {
            token.safeTransfer(recipient, value);
        } else {
            token.safeTransferFrom(payer, recipient, value);
        }
    }

    function pull(address token, uint256 value) internal {
        if (value > 0) {
            if (token == WETH && address(this).balance >= value) wrap(value);
            else token.safeTransferFrom(msg.sender, address(this), value);
        }
    }

    function refund(
        address token,
        uint256 value,
        address recipient
    ) internal {
        uint256 balance = _balance(token);
        if (value > balance) revert InsufficientValue();

        if (value > 0) token.safeTransfer(recipient, value);
    }

    function refundETH() internal {
        uint256 value = address(this).balance;
        if (value > 0) SafeERC20.safeTransferNative(msg.sender, value);
    }

    function _balance(address token) internal view returns (uint256) {
        return token.getBalanceOf(address(this));
    }
}
