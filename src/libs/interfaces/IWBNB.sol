// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "./IBEP20.sol";

interface IWBNB is IBEP20 {
	function deposit() external payable;

	function withdraw(uint256 wad) external;
}
