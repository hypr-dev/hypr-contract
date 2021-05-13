// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "../../libs/interfaces/IBEP20.sol";
import "./IStrategy.sol";

interface ISpaceMaster {
	function add(
		address want,
		address strategy,
		uint256 allocPoint,
		uint16 depositFeeBP,
		bool withUpdate
	) external;

	function set(
		uint256 pid,
		uint256 allocPoint,
		uint16 depositFeeBP,
		bool withUpdate
	) external;
}
