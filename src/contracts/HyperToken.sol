// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "../libs/BEP20.sol";

contract HyperToken is BEP20("hyperspace.finance", "HYPR") {
	/**
	 * @dev Creates `amount` tokens to `to`, increasing the total supply.
	 *
	 * Requirements:
	 * - `msg.sender` must be the token owner
	 *
	 * @param to The address which you want to mint to.
	 * @param amount The amount of tokens to be minted.
	 */
	function mint(address to, uint256 amount) public onlyOwner {
		_mint(to, amount);
	}
}
