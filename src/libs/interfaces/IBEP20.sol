// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

interface IBEP20 {
	/**
	 * @dev Gets total number of tokens in existence.
	 * @return An uint256 representing the number of tokens in existence.
	 */
	function totalSupply() external view returns (uint256);

	/**
	 * @dev Gets the token decimals.
	 * @return An uint8 representing the decimals of the token.
	 */
	function decimals() external view returns (uint8);

	/**
	 * @dev Gets the token symbol.
	 * @return A string representing the symbol of the token.
	 */
	function symbol() external view returns (string memory);

	/**
	 * @dev Gets the token name.
	 * @return A string representing the name of the token.
	 */
	function name() external view returns (string memory);

	/**
	 * @dev Gets the token owner.
	 * @return An address representing the owner of the token.
	 */
	function getOwner() external view returns (address);

	/**
	 * @dev Gets the balance of the specified address.
	 * @param account The address to query the the balance of.
	 * @return An uint256 representing the amount owned by the passed address.
	 */
	function balanceOf(address account) external view returns (uint256);

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
		returns (bool);

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
		returns (uint256);

	/**
	 * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
	 *
	 * Returns a boolean value indicating whether the operation succeeded.
	 *
	 * IMPORTANT: Beware that changing an allowance with this method brings the risk
	 * that someone may use both the old and the new allowance by unfortunate
	 * transaction ordering. One possible solution to mitigate this race
	 * condition is to first reduce the spender's allowance to 0 and set the
	 * desired value afterwards:
	 * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
	 *
	 * Emits an {Approval} event.
	 *
	 * @param spender The address which will spend the funds.
	 * @param amount The amount of tokens to be spent.
	 */
	function approve(address spender, uint256 amount) external returns (bool);

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
	) external returns (bool);

	/**
	 * @dev Emitted when `value` tokens are moved from one account (`from`) to
	 * another (`to`).
	 *
	 * Note that `value` may be zero.
	 */
	event Transfer(address indexed from, address indexed to, uint256 value);

	/**
	 * @dev Emitted when the allowance of a `spender` for an `owner` is set by
	 * a call to {approve}. `value` is the new allowance.
	 */
	event Approval(
		address indexed owner,
		address indexed spender,
		uint256 value
	);
}
