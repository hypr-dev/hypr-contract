// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libs/interfaces/IBEP20.sol";
import "../libs/SafeBEP20.sol";
import "./interfaces/ISpaceMaster.sol";
import "./interfaces/IStrategy.sol";

contract TimelockController is AccessControl {
	using SafeMath for uint256;
	using SafeBEP20 for IBEP20;

	bytes32 public constant TIMELOCK_ADMIN_ROLE =
		keccak256("TIMELOCK_ADMIN_ROLE");
	bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
	bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
	uint256 internal constant _DONE_TIMESTAMP = uint256(1);

	address payable public devWalletAdrs;

	uint256 private _minDelay;
	uint256 private _minDelayReduced;

	mapping(bytes32 => uint256) private _timestamps;

	/**
	 * @dev Emitted when a call is scheduled as part of operation `id`.
	 */
	event CallScheduled(
		bytes32 indexed id,
		uint256 indexed index,
		address target,
		uint256 value,
		bytes data,
		bytes32 predecessor,
		uint256 delay
	);
	/**
	 * @dev Emitted when a call is scheduled as part of operation `id`.
	 */
	event SetScheduled(
		bytes32 indexed id,
		uint256 indexed index,
		uint256 pid,
		uint256 allocPoint,
		uint16 depositFeeBP,
		bool withUpdate,
		bytes32 predecessor,
		uint256 delay
	);
	/**
	 * @dev Emitted when a call is performed as part of operation `id`.
	 */
	event CallExecuted(
		bytes32 indexed id,
		uint256 indexed index,
		address target,
		uint256 value,
		bytes data
	);
	/**
	 * @dev Emitted when operation `id` is cancelled.
	 */
	event Cancelled(bytes32 indexed id);
	/**
	 * @dev Emitted when the minimum delay for future operations is modified.
	 */
	event MinDelayChange(uint256 oldDuration, uint256 newDuration);
	event MinDelayReducedChange(uint256 oldDuration, uint256 newDuration);
	event DevWalletAddressChange(address devWalletAdrs);

	/**
	 * @dev Initializes the contract with a given `minDelay`.
	 */
	constructor(uint256 minDelay, address payable _devWalletAdrs) {
		_minDelay = minDelay;
		_minDelayReduced = _minDelay.div(2);

		emit MinDelayChange(0, _minDelay);
		emit MinDelayReducedChange(0, _minDelayReduced);

		devWalletAdrs = _devWalletAdrs;

		_setRoleAdmin(TIMELOCK_ADMIN_ROLE, TIMELOCK_ADMIN_ROLE);
		_setRoleAdmin(PROPOSER_ROLE, TIMELOCK_ADMIN_ROLE);
		_setRoleAdmin(EXECUTOR_ROLE, TIMELOCK_ADMIN_ROLE);

		// deployer + self administration
		_setupRole(TIMELOCK_ADMIN_ROLE, _msgSender());
		_setupRole(TIMELOCK_ADMIN_ROLE, address(this));

		// register proposer
		_setupRole(PROPOSER_ROLE, devWalletAdrs);

		// // register executor
		_setupRole(EXECUTOR_ROLE, devWalletAdrs);
	}

	/**
	 * @dev Modifier to make a function callable only by a certain role. In
	 * addition to checking the sender's role, `address(0)` 's role is also
	 * considered. Granting a role to `address(0)` is equivalent to enabling
	 * this role for everyone.
	 */
	modifier onlyRole(bytes32 role) {
		require(
			hasRole(role, _msgSender()) || hasRole(role, address(0)),
			"TimelockController: sender requires permission"
		);
		_;
	}

	/**
	 * @dev Contract might receive/hold ETH as part of the maintenance process.
	 */
	// solhint-disable-next-line no-empty-blocks
	receive() external payable {}

	/**
	 * @dev Returns whether an id correspond to a registered operation. This
	 * includes both Pending, Ready and Done operations.
	 */
	function isOperation(bytes32 id) public view returns (bool pending) {
		return getTimestamp(id) > 0;
	}

	/**
	 * @dev Returns whether an operation is pending or not.
	 */
	function isOperationPending(bytes32 id) public view returns (bool pending) {
		return getTimestamp(id) > _DONE_TIMESTAMP;
	}

	/**
	 * @dev Returns whether an operation is ready or not.
	 */
	function isOperationReady(bytes32 id) public view returns (bool ready) {
		// solhint-disable-next-line not-rely-on-time
		return
			getTimestamp(id) > _DONE_TIMESTAMP &&
			getTimestamp(id) <= block.timestamp;
	}

	/**
	 * @dev Returns whether an operation is done or not.
	 */
	function isOperationDone(bytes32 id) public view returns (bool done) {
		return getTimestamp(id) == _DONE_TIMESTAMP;
	}

	/**
	 * @dev Returns the timestamp at with an operation becomes ready (0 for
	 * unset operations, 1 for done operations).
	 */
	function getTimestamp(bytes32 id) public view returns (uint256 timestamp) {
		return _timestamps[id];
	}

	/**
	 * @dev Returns the minimum delay for an operation to become valid.
	 *
	 * This value can be changed by executing an operation that calls `updateDelay`.
	 */
	function getMinDelay() public view returns (uint256 duration) {
		return _minDelay;
	}

	/**
	 * @dev Changes the minimum timelock duration for future operations.
	 *
	 * Emits a {MinDelayChange} event.
	 *
	 * Requirements:
	 * - the caller must be the timelock itself. This can only be achieved by scheduling and later executing
	 * an operation where the timelock is the target and the data is the ABI-encoded call to this function.
	 */
	function updateMinDelay(uint256 newDelay) external {
		require(
			msg.sender == address(this),
			"TimelockController: caller must be timelock"
		);

		_minDelay = newDelay;

		emit MinDelayChange(_minDelay, newDelay);
	}

	function updateMinDelayReduced(uint256 newDelay) external {
		require(
			msg.sender == address(this),
			"TimelockController: caller must be timelock"
		);

		_minDelayReduced = newDelay;

		emit MinDelayReducedChange(_minDelayReduced, newDelay);
	}

	function setDevWalletAddress(address payable _devWalletAdrs) public {
		require(
			msg.sender == address(this),
			"TimelockController: caller must be timelock"
		);
		require(
			tx.origin == devWalletAdrs, // solhint-disable-line avoid-tx-origin
			"TimelockController: tx.origin != devWalletAdrs"
		);
		require(
			_devWalletAdrs != address(0),
			"TimelockController: address can not be zero address"
		);
		require(
			_devWalletAdrs != devWalletAdrs,
			"TimelockController: address is already set"
		);

		revokeRole(PROPOSER_ROLE, devWalletAdrs);
		revokeRole(EXECUTOR_ROLE, devWalletAdrs);

		devWalletAdrs = _devWalletAdrs;

		grantRole(PROPOSER_ROLE, devWalletAdrs);
		grantRole(EXECUTOR_ROLE, devWalletAdrs);

		emit DevWalletAddressChange(devWalletAdrs);
	}

	/**
	 * @dev Returns the identifier of an operation containing a single
	 * transaction.
	 */
	function hashOperation(
		address target,
		uint256 value,
		bytes calldata data,
		bytes32 predecessor,
		bytes32 salt
	) public pure returns (bytes32 hash) {
		return keccak256(abi.encode(target, value, data, predecessor, salt));
	}

	/**
	 * @dev Returns the identifier of an operation containing a batch of
	 * transactions.
	 */
	function hashOperationBatch(
		address[] calldata targets,
		uint256[] calldata values,
		bytes[] calldata datas,
		bytes32 predecessor,
		bytes32 salt
	) public pure returns (bytes32 hash) {
		return keccak256(abi.encode(targets, values, datas, predecessor, salt));
	}

	/**
	 * @dev Schedule an operation containing a single transaction.
	 *
	 * Emits a {CallScheduled} event.
	 *
	 * Requirements:
	 * - the caller must have the 'proposer' role.
	 */
	function schedule(
		address target,
		uint256 value,
		bytes calldata data,
		bytes32 predecessor,
		bytes32 salt,
		uint256 delay
	) public onlyRole(PROPOSER_ROLE) {
		bytes32 id = hashOperation(target, value, data, predecessor, salt);

		_schedule(id, delay);

		emit CallScheduled(id, 0, target, value, data, predecessor, delay);
	}

	/**
	 * @dev Schedule an operation containing a batch of transactions.
	 *
	 * Emits one {CallScheduled} event per transaction in the batch.
	 *
	 * Requirements:
	 * - the caller must have the 'proposer' role.
	 */
	function scheduleBatch(
		address[] calldata targets,
		uint256[] calldata values,
		bytes[] calldata datas,
		bytes32 predecessor,
		bytes32 salt,
		uint256 delay
	) public onlyRole(PROPOSER_ROLE) {
		require(
			targets.length == values.length,
			"TimelockController: length mismatch"
		);
		require(
			targets.length == datas.length,
			"TimelockController: length mismatch"
		);

		bytes32 id =
			hashOperationBatch(targets, values, datas, predecessor, salt);

		_schedule(id, delay);

		for (uint256 i = 0; i < targets.length; ++i) {
			emit CallScheduled(
				id,
				i,
				targets[i],
				values[i],
				datas[i],
				predecessor,
				delay
			);
		}
	}

	/**
	 * @dev Execute an (ready) operation containing a single transaction.
	 *
	 * Emits a {CallExecuted} event.
	 *
	 * Requirements:
	 * - the caller must have the 'executor' role.
	 */
	function execute(
		address target,
		uint256 value,
		bytes calldata data,
		bytes32 predecessor,
		bytes32 salt
	) public payable onlyRole(EXECUTOR_ROLE) {
		bytes32 id = hashOperation(target, value, data, predecessor, salt);

		_beforeCall(predecessor);
		_call(id, 0, target, value, data);
		_aftBEPall(id);
	}

	/**
	 * @dev Execute an (ready) operation containing a batch of transactions.
	 *
	 * Emits one {CallExecuted} event per transaction in the batch.
	 *
	 * Requirements:
	 * - the caller must have the 'executor' role.
	 */
	function executeBatch(
		address[] calldata targets,
		uint256[] calldata values,
		bytes[] calldata datas,
		bytes32 predecessor,
		bytes32 salt
	) public payable onlyRole(EXECUTOR_ROLE) {
		require(
			targets.length == values.length,
			"TimelockController: length mismatch"
		);
		require(
			targets.length == datas.length,
			"TimelockController: length mismatch"
		);

		bytes32 id =
			hashOperationBatch(targets, values, datas, predecessor, salt);

		_beforeCall(predecessor);

		for (uint256 i = 0; i < targets.length; ++i) {
			_call(id, i, targets[i], values[i], datas[i]);
		}

		_aftBEPall(id);
	}

	/**
	 * @dev Cancel an operation.
	 *
	 * Requirements:
	 * - the caller must have the 'proposer' role.
	 */
	function cancel(bytes32 id) public onlyRole(PROPOSER_ROLE) {
		require(
			isOperationPending(id),
			"TimelockController: operation cannot be cancelled"
		);
		delete _timestamps[id];

		emit Cancelled(id);
	}

	/**
	 * @dev Reduced timelock functions
	 */
	function scheduleSet(
		address masterAdrs,
		uint256 pid,
		uint256 allocPoint,
		uint16 depositFeeBP,
		bool withUpdate,
		bytes32 predecessor,
		bytes32 salt
	) public onlyRole(EXECUTOR_ROLE) {
		bytes32 id =
			keccak256(
				abi.encode(
					masterAdrs,
					pid,
					allocPoint,
					depositFeeBP,
					withUpdate,
					predecessor,
					salt
				)
			);

		require(
			_timestamps[id] == 0,
			"TimelockController: operation already scheduled"
		);

		_timestamps[id] = block.timestamp.add(_minDelayReduced);

		emit SetScheduled(
			id,
			0,
			pid,
			allocPoint,
			depositFeeBP,
			withUpdate,
			predecessor,
			_minDelayReduced
		);
	}

	function executeSet(
		address masterAdrs,
		uint256 pid,
		uint256 allocPoint,
		uint16 depositFeeBP,
		bool withUpdate,
		bytes32 predecessor,
		bytes32 salt
	) public payable onlyRole(EXECUTOR_ROLE) {
		bytes32 id =
			keccak256(
				abi.encode(
					masterAdrs,
					pid,
					allocPoint,
					depositFeeBP,
					withUpdate,
					predecessor,
					salt
				)
			);

		_beforeCall(predecessor);
		ISpaceMaster(masterAdrs).set(pid, allocPoint, depositFeeBP, withUpdate);
		_aftBEPall(id);
	}

	/**
	 * @dev No timelock functions
	 */
	function withdrawBNB() public payable {
		require(
			msg.sender == devWalletAdrs,
			"TimelockController: !devWalletAdrs"
		);

		devWalletAdrs.transfer(address(this).balance);
	}

	function withdrawBEP20(address tokenAdrs) public payable {
		require(
			msg.sender == devWalletAdrs,
			"TimelockController: !devWalletAdrs"
		);

		uint256 tokenBal = IBEP20(tokenAdrs).balanceOf(address(this));

		IBEP20(tokenAdrs).safeIncreaseAllowance(devWalletAdrs, tokenBal);
		IBEP20(tokenAdrs).transfer(devWalletAdrs, tokenBal);
	}

	function add(
		address masterAdrs,
		address wantAdrs,
		address strategyAdrs,
		uint16 depositFeeBP,
		bool withUpdate
	) public onlyRole(EXECUTOR_ROLE) {
		ISpaceMaster(masterAdrs).add(
			wantAdrs,
			strategyAdrs,
			0,
			depositFeeBP,
			withUpdate
		); // allocPoint = 0. Schedule set (timelocked) to increase allocPoint.
	}

	function earn(address strategyAdrs) public onlyRole(EXECUTOR_ROLE) {
		IStrategy(strategyAdrs).earn();
	}

	function farm(address strategyAdrs) public onlyRole(EXECUTOR_ROLE) {
		IStrategy(strategyAdrs).farm();
	}

	function pause(address strategyAdrs) public onlyRole(EXECUTOR_ROLE) {
		IStrategy(strategyAdrs).pause();
	}

	function unpause(address strategyAdrs) public onlyRole(EXECUTOR_ROLE) {
		IStrategy(strategyAdrs).unpause();
	}

	function unlock(address strategyAdrs) public onlyRole(EXECUTOR_ROLE) {
		IStrategy(strategyAdrs).unlock();
	}

	function rebalance(
		address strategyAdrs,
		uint256 borrowRate,
		uint256 borrowDepth
	) public onlyRole(EXECUTOR_ROLE) {
		IStrategy(strategyAdrs).rebalance(borrowRate, borrowDepth);
	}

	function deleverageOnce(address strategyAdrs)
		public
		onlyRole(EXECUTOR_ROLE)
	{
		IStrategy(strategyAdrs).deleverageOnce();
	}

	function wrapBNB(address strategyAdrs) public onlyRole(EXECUTOR_ROLE) {
		IStrategy(strategyAdrs).wrapBNB();
	}

	// // In case new vaults require functions without a timelock as well, hoping to avoid having multiple timelock contracts
	function noTimeLockFunc1(address strategyAdrs)
		public
		onlyRole(EXECUTOR_ROLE)
	{
		IStrategy(strategyAdrs).noTimeLockFunc1();
	}

	function noTimeLockFunc2(address strategyAdrs)
		public
		onlyRole(EXECUTOR_ROLE)
	{
		IStrategy(strategyAdrs).noTimeLockFunc2();
	}

	function noTimeLockFunc3(address strategyAdrs)
		public
		onlyRole(EXECUTOR_ROLE)
	{
		IStrategy(strategyAdrs).noTimeLockFunc3();
	}

	/**
	 * @dev Schedule an operation that is to becomes valid after a given delay.
	 */
	function _schedule(bytes32 id, uint256 delay) private {
		require(
			!isOperation(id),
			"TimelockController: operation already scheduled"
		);
		require(
			delay >= getMinDelay(),
			"TimelockController: insufficient delay"
		);

		// solhint-disable-next-line not-rely-on-time
		_timestamps[id] = block.timestamp.add(delay);
	}

	/**
	 * @dev Checks before execution of an operation's calls.
	 */
	function _beforeCall(bytes32 predecessor) private view {
		require(
			predecessor == bytes32(0) || isOperationDone(predecessor),
			"TimelockController: missing dependency"
		);
	}

	/**
	 * @dev Checks after execution of an operation's calls.
	 */
	function _aftBEPall(bytes32 id) private {
		require(
			isOperationReady(id),
			"TimelockController: operation is not ready"
		);

		_timestamps[id] = _DONE_TIMESTAMP;
	}

	/**
	 * @dev Execute an operation's call.
	 *
	 * Emits a {CallExecuted} event.
	 */
	function _call(
		bytes32 id,
		uint256 index,
		address target,
		uint256 value,
		bytes calldata data
	) private {
		// solhint-disable-next-line avoid-low-level-calls
		(bool success, ) = target.call{value: value}(data);

		require(success, "TimelockController: underlying transaction reverted");

		emit CallExecuted(id, index, target, value, data);
	}
}
