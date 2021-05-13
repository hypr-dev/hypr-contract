import { BigNumberish } from "@ethersproject/bignumber";

export type Strategy = {
	pid?: number;
	symbol: string;
	address: string;
	weight: BigNumberish;
	fee?: number;
	isHYPRComp: boolean;
	isCAKEStaking: boolean;
	isComp: boolean;
};
