// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libs/interfaces/IFarm.sol";
import "../libs/interfaces/IWBNB.sol";
import "../libs/SafeBEP20.sol";

abstract contract StrategyCaptain is Ownable, ReentrancyGuard, Pausable {
	using SafeMath for uint256;
	using SafeBEP20 for IBEP20;

	uint256 public constant CONTROLLER_FEE_MAX = 10000; // 100 = 1%
	uint256 public constant CONTROLLER_FEE_UL = 300;

	bool public isHYPRComp; // this vault is purely for staking. eg. HYPR-WBNB staking vault.
	bool public isCAKEStaking; // only for staking CAKE using pancakeswap's native CAKE staking contract.
	bool public onlyGov = true;

	address public hyprAdrs;
	address public wantAdrs;
	address public wbnbAdrs;
	address public masterAdrs;
	address public farmAdrs; // address of farm, eg, PCS, Thugs etc.
	address public routerAdrs; // uniswap, pancakeswap etc
	address public govAdrs; // timelock contract
	address public earnedAdrs;
	address public feeAdrs;
	address public buyBackAdrs = 0x000000000000000000000000000000000000dEaD;

	uint256 public pid; // pid of pool in farmAdrs
	uint256 public lastEarnBlock = 0;
	uint256 public totalWantLocked = 0;
	uint256 public controllerFee = 50; // 0.5 %

	event SetSettings(uint256 controllerFee);
	event SetGov(address govAdrs);
	event SetOnlyGov(bool onlyGov);
	event SetRouterAddress(address routerAdrs);
	event SetWbnbAddress(address wbnbAdrs);
	event SetFeeAddress(address feeAdrs);
	event SetBuyBackAddress(address buyBackAdrs);

	modifier onlyAllowGov() {
		require(msg.sender == govAdrs, "StrategyCaptain: not authorised");
		_;
	}

	function pause() public virtual onlyAllowGov {
		_pause();
	}

	function unpause() public virtual onlyAllowGov {
		_unpause();
	}

	function wrapBNB() public virtual onlyAllowGov {
		_wrapBNB();
	}

	function inCaseTokensGetStuck(
		address token,
		address to,
		uint256 amount
	) public virtual onlyAllowGov {
		require(address(token) != earnedAdrs, "StrategyCaptain: !safe");
		require(address(token) != wantAdrs, "StrategyCaptain: !safe");

		IBEP20(token).safeTransfer(to, amount);
	}

	function setSettings(uint256 _controllerFee) public virtual onlyAllowGov {
		require(
			_controllerFee <= CONTROLLER_FEE_UL,
			"StrategyCaptain: controller fee too high"
		);

		controllerFee = _controllerFee;

		emit SetSettings(_controllerFee);
	}

	function setGov(address _govAdrs) public virtual onlyAllowGov {
		govAdrs = _govAdrs;

		emit SetGov(_govAdrs);
	}

	function setOnlyGov(bool _onlyGov) public virtual onlyAllowGov {
		onlyGov = _onlyGov;

		emit SetOnlyGov(_onlyGov);
	}

	function setRouterAddress(address _routerAdrs) public virtual onlyAllowGov {
		routerAdrs = _routerAdrs;

		emit SetRouterAddress(_routerAdrs);
	}

	function setWbnbAddress(address _wbnbAdrs) public virtual onlyAllowGov {
		wbnbAdrs = _wbnbAdrs;

		emit SetWbnbAddress(_wbnbAdrs);
	}

	function setFeeAddress(address _feeAdrs) public virtual onlyAllowGov {
		feeAdrs = _feeAdrs;

		emit SetFeeAddress(_feeAdrs);
	}

	function setBuyBackAddress(address _buyBackAdrs)
		public
		virtual
		onlyAllowGov
	{
		buyBackAdrs = _buyBackAdrs;

		emit SetBuyBackAddress(_buyBackAdrs);
	}

	function _wrapBNB() internal virtual {
		// BNB -> WBNB
		uint256 bnbBal = address(this).balance;

		if (bnbBal > 0) {
			IWBNB(wbnbAdrs).deposit{value: bnbBal}(); // BNB -> WBNB
		}
	}

	function _distributeFees(uint256 earnedAmt)
		internal
		virtual
		returns (uint256)
	{
		if (earnedAmt > 0) {
			// Performance fee
			if (controllerFee > 0) {
				uint256 fee =
					earnedAmt.mul(controllerFee).div(CONTROLLER_FEE_MAX);
				IBEP20(earnedAdrs).safeTransfer(feeAdrs, fee);
				earnedAmt = earnedAmt.sub(fee);
			}
		}

		return earnedAmt;
	}

	function _farm() internal virtual {
		require(isHYPRComp, "StrategyCaptain: must be HYPR compound");

		uint256 wantAmt = IBEP20(wantAdrs).balanceOf(address(this));

		totalWantLocked = totalWantLocked.add(wantAmt);

		IBEP20(wantAdrs).safeIncreaseAllowance(farmAdrs, wantAmt);

		if (isCAKEStaking) {
			IFarm(farmAdrs).enterStaking(wantAmt); // Just for CAKE staking, we dont use deposit()
		} else {
			IFarm(farmAdrs).deposit(pid, wantAmt);
		}
	}
}
