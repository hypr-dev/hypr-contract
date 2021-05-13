// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libs/SafeBEP20.sol";
import "../libs/interfaces/IBEP20.sol";
import "./HyperToken.sol";
import "./FarmCommander.sol";
import "./CompCommander.sol";
import "./interfaces/IStrategy.sol";

contract SpaceMaster is Ownable, ReentrancyGuard {
	using SafeMath for uint256;
	using SafeBEP20 for IBEP20;

	struct UserInfo {
		uint256 amount;
		uint256 rewardDebt;
	}

	struct PoolInfo {
		IBEP20 want;
		IStrategy strategy;
		uint256 allocPoint;
		uint256 lastRewardBlock;
		uint256 accHYPRPerShare;
		uint16 depositFeeBP;
		bool isComp;
	}

	uint256 public constant HYPR_PER_BLOCK = 0.912 ether;
	uint256 public constant HYPR_DEV_PER_BLOCK = 0.088 ether;

	address public lpAdrs;
	address public hyprAdrs;
	address public feeBbAdrs;
	address public feeStAdrs;
	address public devWalletAdrs;

	uint256 public startBlock;
	uint256 public totalAllocPoint = 0;

	PoolInfo[] public poolInfo;

	mapping(uint256 => mapping(address => UserInfo)) public userInfo;

	event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
	event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
	event EmergencyWithdraw(
		address indexed user,
		uint256 indexed pid,
		uint256 amount
	);
	event SetDevWalletAddress(address indexed user, address indexed newAddress);
	event SetFeeBbAddress(address indexed user, address indexed newAddress);
	event SetFeeStAddress(address indexed user, address indexed newAddress);

	constructor(address[] memory _addresses, uint256 _startBlock) {
		lpAdrs = _addresses[0];
		hyprAdrs = _addresses[1];
		devWalletAdrs = _addresses[2];
		feeBbAdrs = _addresses[3];
		feeStAdrs = _addresses[4];
		startBlock = _startBlock;
	}

	modifier poolExists(uint256 pid) {
		require(pid < poolInfo.length, "SpaceMaster: pool inexistent");
		_;
	}

	// Update dev address by the previous dev.
	function setDevWalletAddress(address _devWalletAdrs) public {
		require(msg.sender == devWalletAdrs, "SpaceMaster: dev: wut?");

		devWalletAdrs = _devWalletAdrs;

		emit SetDevWalletAddress(msg.sender, devWalletAdrs);
	}

	function setFeeBbAddress(address _feeBbAdrs) public {
		require(
			msg.sender == feeBbAdrs,
			"SpaceMaster: setFeeBbAddress: FORBIDDEN"
		);

		feeBbAdrs = _feeBbAdrs;

		emit SetFeeBbAddress(msg.sender, feeBbAdrs);
	}

	function setFeeStAddress(address _feeStAdrs) public {
		require(
			msg.sender == feeStAdrs,
			"SpaceMaster: setFeeStAddress: FORBIDDEN"
		);

		feeStAdrs = _feeStAdrs;

		emit SetFeeStAddress(msg.sender, feeStAdrs);
	}

	function add(
		address wantAdrs,
		address strategyAdrs,
		uint256 allocPoint,
		uint16 depositFeeBP,
		bool isComp,
		bool withUpdate
	) public onlyOwner {
		// require(_depositFeeBP <= 200, "add: invalid deposit fee basis points");

		if (withUpdate) {
			massUpdatePools();
		}

		uint256 lastRewardBlock =
			block.number > startBlock ? block.number : startBlock;

		totalAllocPoint = totalAllocPoint.add(allocPoint);
		poolInfo.push(
			PoolInfo({
				want: IBEP20(wantAdrs),
				strategy: IStrategy(strategyAdrs),
				allocPoint: allocPoint,
				lastRewardBlock: lastRewardBlock,
				accHYPRPerShare: 0,
				depositFeeBP: depositFeeBP,
				isComp: isComp
			})
		);
	}

	function set(
		uint256 pid,
		uint256 allocPoint,
		uint16 depositFeeBP,
		bool withUpdate
	) public onlyOwner poolExists(pid) {
		// require(_depositFeeBP <= 200, "set: invalid deposit fee basis points");

		if (withUpdate) {
			massUpdatePools();
		}

		totalAllocPoint = totalAllocPoint.sub(poolInfo[pid].allocPoint).add(
			allocPoint
		);
		poolInfo[pid].allocPoint = allocPoint;
		poolInfo[pid].depositFeeBP = depositFeeBP;
	}

	function deposit(uint256 pid, uint256 wantAmt)
		public
		nonReentrant
		poolExists(pid)
	{
		updatePool(pid);

		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];

		if (user.amount > 0) {
			uint256 pending =
				user.amount.mul(pool.accHYPRPerShare).div(1e12).sub(
					user.rewardDebt
				);

			if (pending > 0) {
				_safeHYPRTransfer(msg.sender, pending);
			}
		}

		if (wantAmt > 0) {
			pool.want.safeTransferFrom(
				address(msg.sender),
				address(this),
				wantAmt
			);

			uint256 amount = wantAmt;

			if (pool.depositFeeBP > 0) {
				uint256 depositFee = wantAmt.mul(pool.depositFeeBP).div(10000);

				pool.want.safeTransfer(feeBbAdrs, depositFee.div(2));
				pool.want.safeTransfer(
					feeStAdrs,
					depositFee.sub(depositFee.div(2))
				);

				amount = wantAmt.sub(depositFee);
			}

			pool.want.safeIncreaseAllowance(address(pool.strategy), amount);

			uint256 amountDeposit = poolInfo[pid].strategy.deposit(amount);

			user.amount = user.amount.add(amountDeposit);
		}

		user.rewardDebt = user.amount.mul(pool.accHYPRPerShare).div(1e12);

		emit Deposit(msg.sender, pid, wantAmt);
	}

	function withdraw(uint256 pid, uint256 wantAmt)
		public
		nonReentrant
		poolExists(pid)
	{
		updatePool(pid);

		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];

		uint256 total = pool.strategy.totalWantLocked();

		require(user.amount > 0, "SpaceMaster: user.amount is 0");
		require(total > 0, "SpaceMaster: total is 0");

		uint256 pending =
			user.amount.mul(pool.accHYPRPerShare).div(1e12).sub(
				user.rewardDebt
			);

		if (pending > 0) {
			_safeHYPRTransfer(msg.sender, pending);
		}

		uint256 amount = user.amount;

		if (wantAmt > amount) {
			wantAmt = amount;
		}

		if (wantAmt > 0) {
			uint256 amountRemove = pool.strategy.withdraw(wantAmt);

			if (amountRemove > user.amount) {
				user.amount = 0;
			} else {
				user.amount = user.amount.sub(amountRemove);
			}

			uint256 wantBal = IBEP20(pool.want).balanceOf(address(this));

			if (wantBal < wantAmt) {
				wantAmt = wantBal;
			}

			pool.want.safeTransfer(address(msg.sender), wantAmt);
		}

		user.rewardDebt = user.amount.mul(pool.accHYPRPerShare).div(1e12);

		emit Withdraw(msg.sender, pid, wantAmt);
	}

	function emergencyWithdraw(uint256 pid)
		public
		nonReentrant
		poolExists(pid)
	{
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];

		uint256 amount = user.amount;

		pool.strategy.withdraw(amount);

		user.amount = 0;
		user.rewardDebt = 0;

		pool.want.safeTransfer(address(msg.sender), amount);

		emit EmergencyWithdraw(msg.sender, pid, amount);
	}

	// View function to see HYPR tokens on frontend.
	function getPendingHYPR(uint256 pid, address userAdrs)
		external
		view
		returns (uint256)
	{
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][userAdrs];
		uint256 accHYPRPerShare = pool.accHYPRPerShare;
		uint256 totalWantLocked = pool.strategy.totalWantLocked();

		if (block.number > pool.lastRewardBlock && totalWantLocked != 0) {
			uint256 multiplier =
				getMultiplier(pool.lastRewardBlock, block.number);
			uint256 hyprReward =
				multiplier.mul(HYPR_PER_BLOCK).mul(pool.allocPoint).div(
					totalAllocPoint
				);
			accHYPRPerShare = accHYPRPerShare.add(
				hyprReward.mul(1e12).div(totalWantLocked)
			);
		}

		return user.amount.mul(accHYPRPerShare).div(1e12).sub(user.rewardDebt);
	}

	// View function to see staked want tokens on frontend.
	function getStakedWantTokens(uint256 pid, address userAdrs)
		external
		view
		returns (uint256)
	{
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][userAdrs];

		require(pool.isComp, "SpaceMaster: !isComp");

		uint256 totalShares =
			CompCommander(address(pool.strategy)).totalShares();
		uint256 totalWantLocked = pool.strategy.totalWantLocked();

		if (totalShares == 0) {
			return 0;
		}

		return user.amount.mul(totalWantLocked).div(totalShares);
	}

	// This function is under timelock, it is only used if the liquidity needs to be moved to a new version of PancakeSwap.
	function transferLiquidity(address to) public onlyOwner {
		uint256 amount = 0;

		for (uint256 i = 0; i < poolInfo.length; ++i) {
			PoolInfo storage pool = poolInfo[i];

			if (!pool.isComp) {
				uint256 poolTotal =
					FarmCommander(address(pool.strategy)).totalLpEarned();

				amount = amount.add(poolTotal);
			}
		}

		if (amount > 0) {
			IBEP20(lpAdrs).safeTransfer(to, amount);
		}
	}

	function inCaseTokensGetStuck(address token, uint256 amount)
		public
		onlyOwner
	{
		require(token != hyprAdrs, "SpaceMaster: !safe");

		IBEP20(token).safeTransfer(msg.sender, amount);
	}

	function updatePool(uint256 pid) public {
		PoolInfo storage pool = poolInfo[pid];

		if (block.number <= pool.lastRewardBlock) {
			return;
		}

		uint256 totalWantLocked = pool.strategy.totalWantLocked();

		if (totalWantLocked == 0) {
			pool.lastRewardBlock = block.number;

			return;
		}

		uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);

		if (multiplier <= 0) {
			return;
		}

		uint256 hyprReward =
			multiplier.mul(HYPR_PER_BLOCK).mul(pool.allocPoint).div(
				totalAllocPoint
			);

		HyperToken(hyprAdrs).mint(
			devWalletAdrs,
			multiplier.mul(HYPR_DEV_PER_BLOCK).mul(pool.allocPoint).div(
				totalAllocPoint
			)
		);
		HyperToken(hyprAdrs).mint(address(this), hyprReward);

		pool.accHYPRPerShare = pool.accHYPRPerShare.add(
			hyprReward.mul(1e12).div(totalWantLocked)
		);
		pool.lastRewardBlock = block.number;
	}

	function poolLength() external view returns (uint256) {
		return poolInfo.length;
	}

	// Update reward variables for all pools. Be careful of gas spending!
	function massUpdatePools() public {
		uint256 length = poolInfo.length;

		for (uint256 pid = 0; pid < length; ++pid) {
			updatePool(pid);
		}
	}

	// Return reward multiplier over the given from to to block.
	function getMultiplier(uint256 from, uint256 to)
		public
		pure
		returns (uint256)
	{
		return to.sub(from);
	}

	// Safe HYPR transfer function, just in case if rounding error causes pool to not have enough
	function _safeHYPRTransfer(address to, uint256 amount) internal {
		uint256 hyprAmt = IBEP20(hyprAdrs).balanceOf(address(this));

		if (amount > hyprAmt) {
			IBEP20(hyprAdrs).safeTransfer(to, hyprAmt);
		} else {
			IBEP20(hyprAdrs).safeTransfer(to, amount);
		}
	}
}
