import { ethers, BigNumber, ContractReceipt } from "ethers";

export const parseEther = ethers.utils.parseEther;

export const getPairAddress = (rc: ContractReceipt): string => {
	if (!rc.events) return "";

	const event = rc.events[0];

	if (!event.decode) return "";

	return (event.decode(event.data) as {
		pair: string;
	}).pair;
};

export const getWeight = (
	multiply: number,
	baseETH: string | number = 1
): BigNumber => parseEther(baseETH.toString()).mul(multiply);

export const parseBigNumber = (bn: BigNumber): string => bn.toString();
