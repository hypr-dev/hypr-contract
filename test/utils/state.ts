import { BigNumber } from "ethers";
import { IBEP20 } from "../../build/types";

type Contract = {
	balanceOf: IBEP20["balanceOf"];
};

export function getBalance(
	items: Record<string, Contract | Contract[]>
): Promise<BigNumber[]>;
export function getBalance(
	address: string,
	contract: Contract
): Promise<BigNumber>;
export function getBalance(
	itemsOrAddress: Record<string, Contract | Contract[]> | string,
	contract?: Contract
): Promise<BigNumber[]> | Promise<BigNumber> {
	if (contract && typeof itemsOrAddress === "string")
		return contract.balanceOf(itemsOrAddress);

	const items = itemsOrAddress as Record<string, Contract | Contract[]>;

	return Promise.all(
		Object.keys(items)
			.map(adrs => {
				const item = items[adrs];
				const contracts = !Array.isArray(item) ? [item] : item;

				return contracts.map(contract => contract.balanceOf(adrs));
			})
			.reduce((arr, promise) => arr.concat(promise), [])
	);
}
