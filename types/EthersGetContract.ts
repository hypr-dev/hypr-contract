import { Contract } from "@ethersproject/contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export type EthersGetContract<TContract = Contract> = {
	getContract: (name: string) => Promise<TContract & Contract>;
} & HardhatRuntimeEnvironment["ethers"];
