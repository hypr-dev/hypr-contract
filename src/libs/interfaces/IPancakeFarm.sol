// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

interface IPancakeFarm {
	function poolLength() external view returns (uint256);

	function userInfo() external view returns (uint256);

	// Return reward multiplier over the given "from" to "to" block.
	function getMultiplier(uint256 from, uint256 to)
		external
		view
		returns (uint256);

	// View function to see pending CAKEs on frontend.
	function pendingCake(uint256 pid, address user)
		external
		view
		returns (uint256);

	// Deposit LP tokens to MasterChef for CAKE allocation.
	function deposit(uint256 pid, uint256 amount) external;

	// Withdraw LP tokens from MasterChef.
	function withdraw(uint256 pid, uint256 amount) external;

	// Stake CAKE tokens to MasterChef
	function enterStaking(uint256 amount) external;

	// Withdraw CAKE tokens from STAKING.
	function leaveStaking(uint256 amount) external;

	// Withdraw without caring about rewards. EMERGENCY ONLY.
	function emergencyWithdraw(uint256 pid) external;
}
