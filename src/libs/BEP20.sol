// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IBEP20.sol";

contract BEP20 is Context, IBEP20, Ownable {
	using SafeMath for uint256;

	mapping(address => uint256) private _balances;
	mapping(address => mapping(address => uint256)) private _allowances;

	uint256 private _totalSupply;

	string private _symbol;
	string private _name;
	uint8 private _decimals;

	constructor(string memory name_, string memory symbol_) {
		_name = name_;
		_symbol = symbol_;
		_decimals = 18;
	}

	/**
	 * @dev Gets the token owner.
	 * @return An address representing the owner of the token.
	 */
	function getOwner() external view override returns (address) {
		return owner();
	}

	/**
	 * @dev Gets the token decimals.
	 * @return An uint8 representing the decimals of the token.
	 */
	function decimals() external view override returns (uint8) {
		return _decimals;
	}

	/**
	 * @dev Gets the token symbol.
	 * @return A string representing the symbol of the token.
	 */
	function symbol() external view override returns (string memory) {
		return _symbol;
	}

	/**
	 * @dev Gets the token name.
	 * @return A string representing the name of the token.
	 */
	function name() external view override returns (string memory) {
		return _name;
	}

	/**
	 * @dev Gets total number of tokens in existence.
	 * @return An uint256 representing the number of tokens in existence.
	 */
	function totalSupply() external view override returns (uint256) {
		return _totalSupply;
	}

	/**
	 * @dev Gets the balance of the specified address.
	 * @param account The address to query the the balance of.
	 * @return An uint256 representing the amount owned by the passed address.
	 */
	function balanceOf(address account)
		external
		view
		override
		returns (uint256)
	{
		return _balances[account];
	}

	/**
	 * @dev Moves `amount` tokens from the caller's account to `recipient`.
	 *
	 * Emits a {Transfer} event.
	 *
	 * Requirements:
	 * - `recipient` cannot be the zero address.
	 * - the caller must have a balance of at least `amount`.
	 *
	 * @param recipient The address to transfer to.
	 * @param amount The amount to be transferred.
	 */
	function transfer(address recipient, uint256 amount)
		external
		override
		returns (bool)
	{
		_transfer(_msgSender(), recipient, amount);

		return true;
	}

	/**
	 * @dev Returns the remaining number of tokens that `spender` will be
	 * allowed to spend on behalf of `owner` through {transferFrom}. This is
	 * zero by default.
	 *
	 * This value changes when {approve} or {transferFrom} are called.
	 *
	 * @param owner The address which owns the funds.
	 * @param spender The address which will spend the funds.
	 * @return A uint256 specifying the amount of tokens still available for the spender.
	 */
	function allowance(address owner, address spender)
		external
		view
		override
		returns (uint256)
	{
		return _allowances[owner][spender];
	}

	/**
	 * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
	 *
	 * IMPORTANT: Beware that changing an allowance with this method brings the risk that someone may use both the old
	 * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
	 * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
	 * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
	 *
	 * Emits an {Approval} event.
	 *
	 * @param spender The address which will spend the funds.
	 * @param amount The amount of tokens to be spent.
	 */
	function approve(address spender, uint256 amount)
		external
		override
		returns (bool)
	{
		_approve(_msgSender(), spender, amount);

		return true;
	}

	/**
	 * @dev Moves `amount` tokens from `sender` to `recipient` using the
	 * allowance mechanism. `amount` is then deducted from the caller's
	 * allowance.
	 *
	 * Emits a {Transfer} event.
	 *
	 * Emits an {Approval} event indicating the updated allowance. This is not
	 * required by the EIP. See the note at the beginning of {BEP20};
	 *
	 * Requirements:
	 * - `sender` and `recipient` cannot be the zero address.
	 * - `sender` must have a balance of at least `amount`.
	 * - the caller must have allowance for `sender`'s tokens of at least
	 * `amount`.
	 *
	 * @param sender The address which you want to send tokens from.
	 * @param recipient The address which you want to transfer to.
	 * @param amount The amount of tokens to be transferred.
	 */
	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) external override returns (bool) {
		_transfer(sender, recipient, amount);
		_approve(
			sender,
			_msgSender(),
			_allowances[sender][_msgSender()].sub(
				amount,
				"BEP20: transfer amount exceeds allowance"
			)
		);

		return true;
	}

	/**
	 * @dev Atomically increases the allowance granted to `spender` by the caller.
	 *
	 * This is an alternative to {approve} that can be used as a mitigation for
	 * problems described in {BEP20-approve}.
	 *
	 * Emits an {Approval} event indicating the updated allowance.
	 *
	 * Requirements:
	 * - `spender` cannot be the zero address.
	 *
	 * @param spender The address which will spend the funds.
	 * @param addedValue The amount of tokens to increase the allowance by.
	 */
	function increaseAllowance(address spender, uint256 addedValue)
		public
		returns (bool)
	{
		_approve(
			_msgSender(),
			spender,
			_allowances[_msgSender()][spender].add(addedValue)
		);

		return true;
	}

	/**
	 * @dev Atomically decreases the allowance granted to `spender` by the caller.
	 *
	 * This is an alternative to {approve} that can be used as a mitigation for
	 * problems described in {BEP20-approve}.
	 *
	 * Emits an {Approval} event indicating the updated allowance.
	 *
	 * Requirements:
	 * - `spender` cannot be the zero address.
	 * - `spender` must have allowance for the caller of at least
	 * `subtractedValue`.
	 *
	 * @param spender The address which will spend the funds.
	 * @param subtractedValue The amount of tokens to decrease the allowance by.
	 */
	function decreaseAllowance(address spender, uint256 subtractedValue)
		public
		returns (bool)
	{
		_approve(
			_msgSender(),
			spender,
			_allowances[_msgSender()][spender].sub(
				subtractedValue,
				"BEP20: decreased allowance below zero"
			)
		);

		return true;
	}

	/**
	 * @dev Creates `amount` tokens and assigns them to `msg.sender`, increasing
	 * the total supply.
	 *
	 * Requirements
	 * - `msg.sender` must be the token owner
	 *
	 * @param amount The amount of tokens to be minted.
	 */
	function mint(uint256 amount) public onlyOwner returns (bool) {
		_mint(_msgSender(), amount);

		return true;
	}

	/**
	 * @dev Moves tokens `amount` from `sender` to `recipient`.
	 *
	 * This is internal function is equivalent to {transfer}, and can be used to
	 * e.g. implement automatic token fees, slashing mechanisms, etc.
	 *
	 * Emits a {Transfer} event.
	 *
	 * Requirements:
	 * - `sender` cannot be the zero address.
	 * - `recipient` cannot be the zero address.
	 * - `sender` must have a balance of at least `amount`.
	 *
	 * @param sender The address which you want to send tokens from.
	 * @param recipient The address which you want to transfer to.
	 * @param amount The amount of tokens to be transferred.
	 */
	function _transfer(
		address sender,
		address recipient,
		uint256 amount
	) internal {
		require(sender != address(0), "BEP20: transfer from the zero address");
		require(recipient != address(0), "BEP20: transfer to the zero address");

		_beforeTokenTransfer(sender, recipient, amount);

		_balances[sender] = _balances[sender].sub(
			amount,
			"BEP20: transfer amount exceeds balance"
		);
		_balances[recipient] = _balances[recipient].add(amount);

		emit Transfer(sender, recipient, amount);
	}

	/**
	 * @dev Creates `amount` tokens and assigns them to `account`, increasing
	 * the total supply.
	 *
	 * Emits a {Transfer} event with `from` set to the zero address.
	 *
	 * Requirements:
	 * - `account` cannot be the zero address.
	 *
	 * @param account The address which you want to mint to.
	 * @param amount The amount of tokens to be minted.
	 */
	function _mint(address account, uint256 amount) internal {
		require(account != address(0), "BEP20: mint to the zero address");

		_beforeTokenTransfer(address(0), account, amount);

		_totalSupply = _totalSupply.add(amount);
		_balances[account] = _balances[account].add(amount);

		emit Transfer(address(0), account, amount);
	}

	/**
	 * @dev Destroys `amount` tokens from `account`, reducing the
	 * total supply.
	 *
	 * Emits a {Transfer} event with `to` set to the zero address.
	 *
	 * Requirements:
	 * - `account` cannot be the zero address.
	 * - `account` must have at least `amount` tokens.
	 *
	 * @param account The address which you want to burn from.
	 * @param amount The amount of tokens to be burned.
	 */
	function _burn(address account, uint256 amount) internal {
		require(account != address(0), "BEP20: burn from the zero address");

		_beforeTokenTransfer(account, address(0), amount);

		_totalSupply = _totalSupply.sub(amount);
		_balances[account] = _balances[account].sub(
			amount,
			"BEP20: burn amount exceeds balance"
		);

		emit Transfer(account, address(0), amount);
	}

	/**
	 * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
	 *
	 * This is internal function is equivalent to `approve`, and can be used to
	 * e.g. set automatic allowances for certain subsystems, etc.
	 *
	 * Emits an {Approval} event.
	 *
	 * Requirements:
	 * - `owner` cannot be the zero address.
	 * - `spender` cannot be the zero address.
	 *
	 * @param owner The address which will allow spending the funds.
	 * @param spender The address which will spend the funds.
	 * @param amount The amount of tokens to be spent.
	 */
	function _approve(
		address owner,
		address spender,
		uint256 amount
	) internal {
		require(owner != address(0), "BEP20: approve from the zero address");
		require(spender != address(0), "BEP20: approve to the zero address");

		_allowances[owner][spender] = amount;

		emit Approval(owner, spender, amount);
	}

	/**
	 * @dev Destroys `amount` tokens from `account`.`amount` is then deducted
	 * from the caller's allowance.
	 *
	 * See {_burn} and {_approve}.
	 *
	 * @param account The address which you want to burn from.
	 * @param amount The amount of tokens to be burned.
	 */
	function _burnFrom(address account, uint256 amount) internal {
		_burn(account, amount);
		_approve(
			account,
			_msgSender(),
			_allowances[account][_msgSender()].sub(
				amount,
				"BEP20: burn amount exceeds allowance"
			)
		);
	}

	/**
	 * @dev Hook that is called before any transfer of tokens. This includes
	 * minting and burning.
	 *
	 * Calling conditions:
	 * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
	 * will be to transferred to `to`.
	 * - when `from` is zero, `amount` tokens will be minted for `to`.
	 * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
	 * - `from` and `to` are never both zero.
	 *
	 * @param from The address which is being transfered from.
	 * @param to The address which is being transfered to.
	 * @param amount The amount of tokens to be transfered.
	 */
	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 amount
	) internal virtual {} // solhint-disable-line no-empty-blocks
}
