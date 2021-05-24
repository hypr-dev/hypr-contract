// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "../../libs/interfaces/IBEP20.sol";

interface IStrategy {
	// Total want tokens managed by strategy
	function totalWantLocked() external view returns (uint256);

	// Main want token compounding function
	function earn() external;

	function farm() external;

	function unlock() external;

	function pause() external;

	function unpause() external;

	function rebalance(uint256 borrowRate, uint256 borrowDepth) external;

	function deleverageOnce() external;

	function wrapBNB() external; // Specifically for the Venus WBNB vault.

	// Transfer want tokens spaceFarm -> strategy
	function deposit(uint256 amount) external returns (uint256);

	// Transfer want tokens strategy -> spaceFarm
	function withdraw(uint256 amount) external returns (uint256);

	function inCaseTokensGetStuck(
		address token,
		address to,
		uint256 amount
	) external;

	// In case new vaults require functions without a timelock as well, hoping to avoid having multiple timelock contracts
	function noTimeLockFunc1() external;

	function noTimeLockFunc2() external;

	function noTimeLockFunc3() external;
}
