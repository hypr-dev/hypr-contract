import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { constVoid } from "fp-ts/lib/function";

export const advanceBlock = (): Promise<void> =>
	ethers.provider.send("evm_mine", []).then(constVoid);

export const advanceBlockTo = async (blockNumber: number): Promise<void> => {
	for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++)
		await advanceBlock();
};

export const advanceTime = (time: unknown): Promise<void> =>
	ethers.provider.send("evm_increaseTime", [time]).then(constVoid);

export const advanceTimeAndBlock = (time: unknown): Promise<void> =>
	advanceTime(time).then(advanceBlock);

export const increase = (value: BigNumber): Promise<void> =>
	ethers.provider
		.send("evm_increaseTime", [value.toNumber()])
		.then(advanceBlock)
		.then(constVoid);

export const latest = (): Promise<BigNumber> =>
	ethers.provider
		.getBlock("latest")
		.then(block => BigNumber.from(block.timestamp));

export const takeSnapshot = (): Promise<string> =>
	ethers.provider.send("evm_snapshot", []) as Promise<string>;

export const revertToSnapShot = (id: string): Promise<void> =>
	ethers.provider.send("evm_revert", [id]).then(constVoid);
