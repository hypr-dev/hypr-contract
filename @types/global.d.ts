import { BigNumber, Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export {}

declare global {
	type AsyncReturnType<T extends (...args: any) => any> = T extends (
		...args: any
	) => Promise<infer U>
		? U
		: T extends (...args: any) => infer U
		? U
		: any;

	type AddressJson = Record<
		string,
		{
			pid: number;
			address: string;
		}
	>

	type EthersGetContract<TContract = Contract> = {
		getContract: (name: string) => Promise<TContract & Contract>;
	} & HardhatRuntimeEnvironment["ethers"];

	type MockMethod<TReturn = unknown> = {
		name: string;
		returns?: TReturn[];
	};

	type StrategyType = "farm" | "comp";

	type Strategy = {
		pid?: number;
		symbol: string;
		address: string;
		token0?: string;
		token1?: string;
		earnedToToken0Path?: string[];
		earnedToToken1Path?: string[];
		token0ToEarnedPath?: string[];
		token1ToEarnedPath?: string[];
		weight: BigNumber;
		harvestInterval: BigNumber;
		fee?: number;
		type: StrategyType;
		isHYPRComp: boolean;
		isCAKEStaking: boolean;
		isSameAssetDeposit?: boolean;
	};
}
