// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libs/SafeBEP20.sol";
import "../libs/interfaces/IBEP20.sol";
import "./interfaces/IStrategy.sol";
import "./HyperToken.sol";
import "./FarmCommander.sol";
import "./CompCommander.sol";

contract SpaceMaster is Ownable, ReentrancyGuard {
	using SafeMath for uint256;
	using SafeBEP20 for IBEP20;

	struct UserInfo {
		uint256 amount;
		uint256 rewardDebt;
		uint256 rewardLockedUp;
		uint256 nextHarvestUntil;
	}

	struct PoolInfo {
		IBEP20 want;
		IStrategy strategy;
		uint256 allocPoint;
		uint256 lastRewardBlock;
		uint256 accHYPRPerShare;
		uint256 harvestInterval;
		uint16 depositFeeBP;
	}

	uint256 public constant HYPR_PER_BLOCK = 0.912 ether;
	uint256 public constant HYPR_DEV_PER_BLOCK = 0.088 ether;
	uint256 public constant MAXIMUM_HARVEST_INTERVAL = 14 days;
	uint16 public constant MAXIMUM_DEPOSIT_FEE_BP = 1000;

	address public pairAdrs;
	address public hyprAdrs;
	address public feeBbAdrs;
	address public feeStAdrs;
	address public devWalletAdrs;

	uint256 public startBlock;
	uint256 public totalAllocPoint = 0;
	uint256 public totalLockedUpRewards = 0;

	PoolInfo[] public poolInfo;

	mapping(uint256 => mapping(address => UserInfo)) public userInfo;

	event SetDevWalletAddress(address indexed user, address indexed newAddress);
	event SetFeeBbAddress(address indexed user, address indexed newAddress);
	event SetFeeStAddress(address indexed user, address indexed newAddress);
	event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
	event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
	event EmergencyWithdraw(
		address indexed user,
		uint256 indexed pid,
		uint256 amount
	);
	event RewardLockedUp(
		address indexed user,
		uint256 indexed pid,
		uint256 amountLockedUp
	);

	constructor(address[] memory _addresses, uint256 _startBlock) {
		pairAdrs = _addresses[0];
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

	function add(
		address wantAdrs,
		address strategyAdrs,
		uint256 allocPoint,
		uint256 harvestInterval,
		uint16 depositFeeBP,
		bool withUpdate
	) public onlyOwner {
		require(
			depositFeeBP <= MAXIMUM_DEPOSIT_FEE_BP,
			"SpaceMaster: add: invalid deposit fee basis points"
		);
		require(
			harvestInterval <= MAXIMUM_HARVEST_INTERVAL,
			"SpaceMaster: add: invalid harvest interval"
		);

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
				harvestInterval: harvestInterval,
				depositFeeBP: depositFeeBP
			})
		);
	}

	function set(
		uint256 pid,
		uint256 allocPoint,
		uint256 harvestInterval,
		uint16 depositFeeBP,
		bool withUpdate
	) public onlyOwner poolExists(pid) {
		require(
			depositFeeBP <= MAXIMUM_DEPOSIT_FEE_BP,
			"SpaceMaster: add: invalid deposit fee basis points"
		);
		require(
			harvestInterval <= MAXIMUM_HARVEST_INTERVAL,
			"SpaceMaster: add: invalid harvest interval"
		);

		if (withUpdate) {
			massUpdatePools();
		}

		totalAllocPoint = totalAllocPoint.sub(poolInfo[pid].allocPoint).add(
			allocPoint
		);
		poolInfo[pid].allocPoint = allocPoint;
		poolInfo[pid].harvestInterval = harvestInterval;
		poolInfo[pid].depositFeeBP = depositFeeBP;
	}

	function deposit(uint256 pid, uint256 wantAmt)
		public
		nonReentrant
		poolExists(pid)
	{
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];

		updatePool(pid);
		_payOrLockupPendingHYPR(pid);

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
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];

		uint256 total = pool.strategy.totalWantLocked();

		require(user.amount > 0, "SpaceMaster: user.amount is 0");
		require(total > 0, "SpaceMaster: total is 0");

		updatePool(pid);
		_payOrLockupPendingHYPR(pid);

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
		user.rewardLockedUp = 0;
		user.nextHarvestUntil = 0;

		pool.want.safeTransfer(address(msg.sender), amount);

		emit EmergencyWithdraw(msg.sender, pid, amount);
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

		uint256 hyprDevReward =
			multiplier.mul(HYPR_DEV_PER_BLOCK).mul(pool.allocPoint).div(
				totalAllocPoint
			);
		uint256 hyprReward =
			multiplier.mul(HYPR_PER_BLOCK).mul(pool.allocPoint).div(
				totalAllocPoint
			);

		HyperToken(hyprAdrs).mint(devWalletAdrs, hyprDevReward);
		HyperToken(hyprAdrs).mint(address(this), hyprReward);

		pool.accHYPRPerShare = pool.accHYPRPerShare.add(
			hyprReward.mul(1e12).div(totalWantLocked)
		);
		pool.lastRewardBlock = block.number;
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
	function getStakedWant(uint256 pid, address userAdrs)
		external
		view
		returns (uint256)
	{
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][userAdrs];

		uint256 totalShares =
			CompCommander(address(pool.strategy)).totalShares();
		uint256 totalWantLocked = pool.strategy.totalWantLocked();

		if (totalShares == 0) {
			return 0;
		}

		return user.amount.mul(totalWantLocked).div(totalShares);
	}

	// Return reward multiplier over the given from to to block.
	function getMultiplier(uint256 from, uint256 to)
		public
		pure
		returns (uint256)
	{
		return to.sub(from);
	}

	function poolLength() external view returns (uint256) {
		return poolInfo.length;
	}

	// View function to see if user can harvest PANTHERs.
	function canHarvest(uint256 pid, address userAdrs)
		public
		view
		returns (bool)
	{
		UserInfo storage user = userInfo[pid][userAdrs];

		return block.timestamp >= user.nextHarvestUntil;
	}

	function inCaseTokensGetStuck(address token, uint256 amount)
		public
		onlyOwner
	{
		require(token != hyprAdrs, "SpaceMaster: !safe");

		IBEP20(token).safeTransfer(msg.sender, amount);
	}

	// Update reward variables for all pools. Be careful of gas spending!
	function massUpdatePools() public {
		uint256 length = poolInfo.length;

		for (uint256 pid = 0; pid < length; ++pid) {
			updatePool(pid);
		}
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

	// Pay or lockup pending HYPRs.
	function _payOrLockupPendingHYPR(uint256 pid) internal {
		PoolInfo storage pool = poolInfo[pid];
		UserInfo storage user = userInfo[pid][msg.sender];

		if (user.nextHarvestUntil == 0) {
			user.nextHarvestUntil = block.timestamp.add(pool.harvestInterval);
		}

		uint256 pending =
			user.amount.mul(pool.accHYPRPerShare).div(1e12).sub(
				user.rewardDebt
			);

		if (canHarvest(pid, msg.sender)) {
			if (pending > 0 || user.rewardLockedUp > 0) {
				uint256 totalRewards = pending.add(user.rewardLockedUp);

				// reset lockup
				totalLockedUpRewards = totalLockedUpRewards.sub(
					user.rewardLockedUp
				);
				user.rewardLockedUp = 0;
				user.nextHarvestUntil = block.timestamp.add(
					pool.harvestInterval
				);

				// send rewards
				_safeHYPRTransfer(msg.sender, totalRewards);
			}
		} else if (pending > 0) {
			user.rewardLockedUp = user.rewardLockedUp.add(pending);
			totalLockedUpRewards = totalLockedUpRewards.add(pending);

			emit RewardLockedUp(msg.sender, pid, pending);
		}
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
