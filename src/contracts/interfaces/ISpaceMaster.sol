// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "../../libs/interfaces/IBEP20.sol";
import "./IStrategy.sol";

interface ISpaceMaster {
	function add(
		address wantAdrs,
		address strategyAdrs,
		uint256 allocPoint,
		uint256 harvestInterval,
		uint16 depositFeeBP,
		bool withUpdate
	) external;

	function set(
		uint256 pid,
		uint256 allocPoint,
		uint256 harvestInterval,
		uint16 depositFeeBP,
		bool withUpdate
	) external;
}
