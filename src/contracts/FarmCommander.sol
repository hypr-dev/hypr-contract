// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/lib/contracts/libraries/Babylonian.sol";
import "../libs/interfaces/IBEP20.sol";
import "../libs/interfaces/IPair.sol";
import "../libs/interfaces/IFarm.sol";
import "../libs/interfaces/IRouter.sol";
import "../libs/SafeBEP20.sol";
import "./StrategyCaptain.sol";

contract FarmCommander is StrategyCaptain {
	using SafeMath for uint256;
	using SafeBEP20 for IBEP20;

	address public wbnbPairAdrs;

	address[] public earnedToWbnbPath;
	address[] public wbnbToHyprPath;

	uint256 public totalLpEarned = 0;

	constructor(
		uint256 _pid,
		address[] memory _addresses,
		bool _isHYPRComp,
		bool _isCAKEStaking
	) {
		isHYPRComp = _isHYPRComp;
		isCAKEStaking = _isCAKEStaking;
		onlyGov = false;

		hyprAdrs = _addresses[0];
		wantAdrs = _addresses[1];
		wbnbAdrs = _addresses[2];
		masterAdrs = _addresses[3];

		if (isHYPRComp) {
			pid = _pid;

			farmAdrs = _addresses[4];
			routerAdrs = _addresses[5];
			earnedAdrs = _addresses[6];
			govAdrs = _addresses[7];
			feeAdrs = _addresses[8];
			wbnbPairAdrs = _addresses[9];

			earnedToWbnbPath = [earnedAdrs, wbnbAdrs];
			wbnbToHyprPath = [wbnbAdrs, hyprAdrs];
		} else {
			earnedAdrs = _addresses[4];
			govAdrs = _addresses[5];
			feeAdrs = _addresses[6];
		}

		controllerFee = 150;

		transferOwnership(masterAdrs);
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

		if (isHYPRComp) {
			_farm();
		} else {
			totalWantLocked = totalWantLocked.add(wantAmt);
		}

		return wantAmt;
	}

	function withdraw(uint256 wantAmt)
		public
		onlyOwner
		nonReentrant
		returns (uint256)
	{
		require(wantAmt > 0, "FarmCommander: amount <= 0");

		if (isHYPRComp) {
			if (isCAKEStaking) {
				IFarm(farmAdrs).leaveStaking(wantAmt); // Just for CAKE staking, we dont use withdraw()
			} else {
				IFarm(farmAdrs).withdraw(pid, wantAmt);
			}
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

		return wantAmt;
	}

	// 1. Harvest farm tokens
	// 2. Converts farm tokens into want tokens
	// 3. Deposits want tokens

	function earn() public nonReentrant whenNotPaused {
		require(isHYPRComp, "FarmCommander: must be HYPR compound");

		if (onlyGov) {
			require(msg.sender == govAdrs, "FarmCommander: not authorised");
		}

		// Harvest farm tokens
		if (isCAKEStaking) {
			IFarm(farmAdrs).leaveStaking(0); // Just for CAKE staking, we dont use withdraw()
		} else {
			IFarm(farmAdrs).withdraw(pid, 0);
		}

		if (earnedAdrs == wbnbAdrs) {
			_wrapBNB();
		}

		// Converts farm tokens into want tokens
		uint256 earnedBal = IBEP20(earnedAdrs).balanceOf(address(this));

		earnedBal = _distributeFees(earnedBal);

		_buyBack(earnedBal);

		lastEarnBlock = block.number;
	}

	function farm() public nonReentrant {
		_farm();
	}

	function setWbnbAddress(address _wbnbAdrs) public override onlyAllowGov {
		wbnbAdrs = _wbnbAdrs;

		earnedToWbnbPath = [earnedAdrs, wbnbAdrs];
		wbnbToHyprPath = [wbnbAdrs, hyprAdrs];

		emit SetWbnbAddress(wbnbAdrs);
	}

	function _buyBack(uint256 earnedAmt) internal {
		require(isHYPRComp, "FarmCommander: must be HYPR compound");

		if (onlyGov) {
			require(msg.sender == govAdrs, "FarmCommander: not authorised");
		}

		IBEP20(earnedAdrs).safeIncreaseAllowance(routerAdrs, earnedAmt);
		IRouter(routerAdrs)
			.swapExactTokensForTokensSupportingFeeOnTransferTokens(
			earnedAmt,
			0,
			earnedToWbnbPath,
			address(this),
			block.timestamp + 600
		);

		uint256 wbnbPairBal = IBEP20(wbnbAdrs).balanceOf(wbnbPairAdrs);
		uint256 wbnbBal = IBEP20(wbnbAdrs).balanceOf(address(this));
		uint256 swapAmt =
			Babylonian
				.sqrt(
				wbnbPairBal.mul(
					wbnbBal.mul(3988000).add(wbnbPairBal.mul(3988009))
				)
			)
				.sub(wbnbPairBal.mul(1997))
				.div(1994);

		IBEP20(wbnbAdrs).safeIncreaseAllowance(routerAdrs, wbnbBal);
		IRouter(routerAdrs)
			.swapExactTokensForTokensSupportingFeeOnTransferTokens(
			swapAmt,
			0,
			wbnbToHyprPath,
			address(this),
			block.timestamp + 600
		);

		wbnbBal = IBEP20(wbnbAdrs).balanceOf(address(this));

		uint256 hyprBal = IBEP20(hyprAdrs).balanceOf(address(this));
		uint256 lpMasterBal = IPair(wbnbPairAdrs).balanceOf(masterAdrs);

		IBEP20(hyprAdrs).safeIncreaseAllowance(routerAdrs, hyprBal);
		IRouter(routerAdrs).addLiquidity(
			wbnbAdrs,
			hyprAdrs,
			wbnbBal,
			hyprBal,
			0,
			0,
			masterAdrs,
			block.timestamp + 600
		);

		hyprBal = IBEP20(hyprAdrs).balanceOf(address(this));
		lpMasterBal = IPair(wbnbPairAdrs).balanceOf(masterAdrs).sub(
			lpMasterBal
		);
		totalLpEarned = totalLpEarned.add(lpMasterBal);

		IBEP20(hyprAdrs).transfer(buyBackAdrs, hyprBal);
	}
}
