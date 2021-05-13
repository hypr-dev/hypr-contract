// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libs/SafeBEP20.sol";
import "../libs/interfaces/IBEP20.sol";
import "../libs/interfaces/IPancakeFarm.sol";
import "../libs/interfaces/IPancakeRouter02.sol";
import "./StrategyCaptain.sol";

contract CompCommander is StrategyCaptain {
	using SafeMath for uint256;
	using SafeBEP20 for IBEP20;

	uint256 public constant BUYBACK_RATE_MAX = 10000; // 100 = 1%
	uint256 public constant BUYBACK_RATE_UL = 800;
	uint256 public constant ENTRANCE_FEE_FACTOR_MAX = 10000;
	uint256 public constant ENTRANCE_FEE_FACTOR_LL = 9950; // 0.5% is the max entrance fee settable. LL = lowerlimit
	uint256 public constant WITHDRAW_FEE_FACTOR_MAX = 10000;
	uint256 public constant WITHDRAW_FEE_FACTOR_LL = 9950; // 0.5% is the max entrance fee settable. LL = lowerlimit
	uint256 public constant SLIPPAGE_FACTOR_UL = 995;

	bool public isSameAssetDeposit;

	address public depositFeeAdrs;
	address public withdrawFeeAdrs;
	address public token0Adrs;
	address public token1Adrs;

	address[] public earnedToHyprPath;
	address[] public earnedToToken0Path;
	address[] public earnedToToken1Path;
	address[] public token0ToEarnedPath;
	address[] public token1ToEarnedPath;

	uint256 public totalShares = 0;
	uint256 public entranceFeeFactor = 9990; // < 0.1% entrance fee - goes to pool + prevents front-running
	uint256 public withdrawFeeFactor = 10000; // 0.1% withdraw fee - goes to pool
	uint256 public buyBackRate = 200; // 100;  1%(buy-back and burn fee)
	uint256 public slippageFactor = 950; // 5% default slippage tolerance

	event SetSettings(
		uint256 controllerFee,
		uint256 entranceFeeFactor,
		uint256 withdrawFeeFactor,
		uint256 buyBackRate,
		uint256 slippageFactor
	);

	constructor(
		uint256 _pid,
		address[] memory _addresses,
		address[] memory _earnedToToken0Path,
		address[] memory _earnedToToken1Path,
		address[] memory _token0ToEarnedPath,
		address[] memory _token1ToEarnedPath,
		bool _isHYPRComp,
		bool _isCAKEStaking,
		bool _isSameAssetDeposit
	) {
		pid = _pid;

		isHYPRComp = _isHYPRComp;
		isCAKEStaking = _isCAKEStaking;
		isSameAssetDeposit = _isSameAssetDeposit;

		hyprAdrs = _addresses[0];
		wantAdrs = _addresses[1];
		wbnbAdrs = _addresses[2];
		masterAdrs = _addresses[3];
		farmAdrs = _addresses[4];
		routerAdrs = _addresses[5];
		govAdrs = _addresses[6];
		earnedAdrs = _addresses[7];
		rewardsAdrs = _addresses[8];
		depositFeeAdrs = _addresses[9];
		withdrawFeeAdrs = _addresses[10];
		token0Adrs = _addresses[11];
		token1Adrs = _addresses[12];

		earnedToHyprPath = [earnedAdrs, hyprAdrs];
		earnedToToken0Path = _earnedToToken0Path;
		earnedToToken1Path = _earnedToToken1Path;
		token0ToEarnedPath = _token0ToEarnedPath;
		token1ToEarnedPath = _token1ToEarnedPath;

		controllerFee = 200;

		transferOwnership(masterAdrs);
	}

	function setSettings(
		uint256 _controllerFee,
		uint256 _entranceFeeFactor,
		uint256 _withdrawFeeFactor,
		uint256 _buyBackRate,
		uint256 _slippageFactor
	) public onlyAllowGov {
		require(
			_entranceFeeFactor >= ENTRANCE_FEE_FACTOR_LL,
			"CompCommander: entrance fee factor is too low"
		);
		require(
			_entranceFeeFactor <= ENTRANCE_FEE_FACTOR_MAX,
			"CompCommander: entrance fee factor is too high"
		);
		entranceFeeFactor = _entranceFeeFactor;

		require(
			_withdrawFeeFactor >= WITHDRAW_FEE_FACTOR_LL,
			"CompCommander: withdraw fee factor is too low"
		);
		require(
			_withdrawFeeFactor <= WITHDRAW_FEE_FACTOR_MAX,
			"CompCommander: withdraw fee factor is too high"
		);
		withdrawFeeFactor = _withdrawFeeFactor;

		require(
			_controllerFee <= CONTROLLER_FEE_UL,
			"CompCommander: controller fee is too high"
		);
		controllerFee = _controllerFee;

		require(
			_buyBackRate <= BUYBACK_RATE_UL,
			"CompCommander: buy back rate is too high"
		);
		buyBackRate = _buyBackRate;

		require(
			_slippageFactor <= SLIPPAGE_FACTOR_UL,
			"CompCommander: slippage factor is too high"
		);
		slippageFactor = _slippageFactor;

		emit SetSettings(
			_controllerFee,
			_entranceFeeFactor,
			_withdrawFeeFactor,
			_buyBackRate,
			_slippageFactor
		);
	}

	// Receives new deposits from user
	function deposit(uint256 wantAmt)
		public
		onlyOwner
		nonReentrant
		whenNotPaused
		returns (uint256)
	{
		IBEP20(wantAdrs).safeTransferFrom(
			address(msg.sender),
			address(this),
			wantAmt
		);

		uint256 sharesAdded = wantAmt;

		if (totalWantLocked > 0 && totalShares > 0) {
			sharesAdded = wantAmt
				.mul(totalShares)
				.mul(entranceFeeFactor)
				.div(totalWantLocked)
				.div(ENTRANCE_FEE_FACTOR_MAX);
			totalShares = totalShares.add(sharesAdded);
		} else {
			totalShares = totalShares
				.add(sharesAdded)
				.mul(entranceFeeFactor)
				.div(ENTRANCE_FEE_FACTOR_MAX);
		}

		uint256 depositFee =
			wantAmt.mul(ENTRANCE_FEE_FACTOR_MAX.sub(entranceFeeFactor)).div(
				ENTRANCE_FEE_FACTOR_MAX
			);
		if (depositFee > 0) {
			IBEP20(wantAdrs).safeIncreaseAllowance(depositFeeAdrs, depositFee);
			IBEP20(wantAdrs).transfer(depositFeeAdrs, depositFee);
		}

		if (isHYPRComp) {
			_farm();
		} else {
			totalWantLocked = totalWantLocked.add(wantAmt);
		}

		return sharesAdded;
	}

	function farm() public nonReentrant {
		_farm();
	}

	function withdraw(uint256 wantAmt)
		public
		onlyOwner
		nonReentrant
		returns (uint256)
	{
		require(wantAmt > 0, "CompCommander: wantAmt <= 0");

		uint256 sharesRemoved = wantAmt.mul(totalShares).div(totalWantLocked);

		if (sharesRemoved > totalShares) {
			sharesRemoved = totalShares;
		}

		totalShares = totalShares.sub(sharesRemoved);

		if (withdrawFeeFactor < WITHDRAW_FEE_FACTOR_MAX && wantAmt != 0) {
			wantAmt = wantAmt.mul(withdrawFeeFactor).div(
				WITHDRAW_FEE_FACTOR_MAX
			);

			uint256 withdrawFee =
				wantAmt.mul(WITHDRAW_FEE_FACTOR_MAX.sub(withdrawFeeFactor)).div(
					WITHDRAW_FEE_FACTOR_MAX
				);

			IBEP20(wantAdrs).safeIncreaseAllowance(
				withdrawFeeAdrs,
				withdrawFee
			);
			IBEP20(wantAdrs).transfer(withdrawFeeAdrs, withdrawFee);
		}

		if (isHYPRComp) {
			_unfarm(wantAmt);
		}

		uint256 wantBal = IBEP20(wantAdrs).balanceOf(address(this));

		if (wantAmt > wantBal) {
			wantAmt = wantBal;
		}

		if (totalWantLocked < wantAmt) {
			wantAmt = totalWantLocked;
		}

		totalWantLocked = totalWantLocked.sub(wantAmt);

		IBEP20(wantAdrs).safeTransfer(masterAdrs, wantAmt);

		return sharesRemoved;
	}

	// 1. Harvest farm tokens
	// 2. Converts farm tokens into want tokens
	// 3. Deposits want tokens

	function earn() public nonReentrant whenNotPaused {
		require(isHYPRComp, "CompCommander: must be HYPR compound");

		if (onlyGov) {
			require(msg.sender == govAdrs, "CompCommander: not authorised");
		}

		// Harvest farm tokens
		_unfarm(0);

		if (earnedAdrs == wbnbAdrs) {
			_wrapBNB();
		}

		// Converts farm tokens into want tokens
		uint256 earnedBal = IBEP20(earnedAdrs).balanceOf(address(this));

		earnedBal = _distributeFees(earnedBal);
		earnedBal = _buyBack(earnedBal);

		if (isCAKEStaking || isSameAssetDeposit) {
			lastEarnBlock = block.number;
			_farm();
			return;
		}

		IBEP20(earnedAdrs).safeApprove(routerAdrs, 0);
		IBEP20(earnedAdrs).safeIncreaseAllowance(routerAdrs, earnedBal);

		if (earnedAdrs != token0Adrs) {
			// Swap half earned to token0
			_safeSwap(
				routerAdrs,
				earnedBal.div(2),
				slippageFactor,
				earnedToToken0Path,
				address(this),
				block.timestamp.add(600)
			);
		}

		if (earnedAdrs != token1Adrs) {
			// Swap half earned to token1
			_safeSwap(
				routerAdrs,
				earnedBal.div(2),
				slippageFactor,
				earnedToToken1Path,
				address(this),
				block.timestamp.add(600)
			);
		}

		// Get want tokens, ie. add liquidity
		uint256 token0Bal = IBEP20(token0Adrs).balanceOf(address(this));
		uint256 token1Bal = IBEP20(token1Adrs).balanceOf(address(this));

		if (token0Bal > 0 && token1Bal > 0) {
			IBEP20(token0Adrs).safeIncreaseAllowance(routerAdrs, token0Bal);
			IBEP20(token1Adrs).safeIncreaseAllowance(routerAdrs, token1Bal);
			IPancakeRouter02(routerAdrs).addLiquidity(
				token0Adrs,
				token1Adrs,
				token0Bal,
				token1Bal,
				0,
				0,
				address(this),
				block.timestamp.add(600)
			);
		}

		lastEarnBlock = block.number;

		_farm();
	}

	function convertDustToEarned() public whenNotPaused {
		require(isHYPRComp, "CompCommander: must be HYPR compound");
		require(!isCAKEStaking, "CompCommander: cannot be staking CAKE");

		// Converts dust tokens into earned tokens, which will be reinvested on the next earn().

		// Converts token0 dust (if any) to earned tokens
		uint256 token0Bal = IBEP20(token0Adrs).balanceOf(address(this));

		if (token0Adrs != earnedAdrs && token0Bal > 0) {
			IBEP20(token0Adrs).safeIncreaseAllowance(routerAdrs, token0Bal);

			// Swap all dust tokens to earned tokens
			_safeSwap(
				routerAdrs,
				token0Bal,
				slippageFactor,
				token0ToEarnedPath,
				address(this),
				block.timestamp.add(600)
			);
		}

		// Converts token1 dust (if any) to earned tokens
		uint256 token1Bal = IBEP20(token1Adrs).balanceOf(address(this));

		if (token1Adrs != earnedAdrs && token1Bal > 0) {
			IBEP20(token1Adrs).safeIncreaseAllowance(routerAdrs, token1Bal);

			// Swap all dust tokens to earned tokens
			_safeSwap(
				routerAdrs,
				token1Bal,
				slippageFactor,
				token1ToEarnedPath,
				address(this),
				block.timestamp.add(600)
			);
		}
	}

	function _unfarm(uint256 wantAmt) internal {
		if (isCAKEStaking) {
			IPancakeFarm(farmAdrs).leaveStaking(wantAmt); // Just for CAKE staking, we dont use withdraw()
		} else {
			IPancakeFarm(farmAdrs).withdraw(pid, wantAmt);
		}
	}

	function _buyBack(uint256 earnedAmt) internal returns (uint256) {
		if (buyBackRate <= 0) {
			return earnedAmt;
		}

		uint256 buyBackAmt = earnedAmt.mul(buyBackRate).div(BUYBACK_RATE_MAX);

		if (earnedAdrs == hyprAdrs) {
			IBEP20(earnedAdrs).safeTransfer(buyBackAdrs, buyBackAmt);
		} else {
			IBEP20(earnedAdrs).safeIncreaseAllowance(routerAdrs, buyBackAmt);

			_safeSwap(
				routerAdrs,
				buyBackAmt,
				slippageFactor,
				earnedToHyprPath,
				buyBackAdrs,
				block.timestamp.add(600)
			);
		}

		return earnedAmt.sub(buyBackAmt);
	}

	function _safeSwap(
		address _routerAdrs,
		uint256 _amountIn,
		uint256 _slippageFactor,
		address[] memory _path,
		address _to,
		uint256 _deadline
	) internal virtual {
		uint256[] memory amounts =
			IPancakeRouter02(_routerAdrs).getAmountsOut(_amountIn, _path);
		uint256 amountOut = amounts[amounts.length.sub(1)];

		IPancakeRouter02(_routerAdrs)
			.swapExactTokensForTokensSupportingFeeOnTransferTokens(
			_amountIn,
			amountOut.mul(_slippageFactor).div(1000),
			_path,
			_to,
			_deadline
		);
	}
}
