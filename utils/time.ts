import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { constVoid } from "fp-ts/lib/function";

export const chill = (duration = 3000): Promise<void> =>
	new Promise<void>(res => setTimeout(res, duration));

export const advanceBlock = (): Promise<void> =>
	ethers.provider.send("evm_mine", []).then(constVoid);

export const advanceBlockTo = async (blockNumber: number): Promise<void> => {
	for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++)
		await advanceBlock();
};

export const increase = (value: BigNumber): Promise<void> =>
	ethers.provider
		.send("evm_increaseTime", [value.toNumber()])
		.then(advanceBlock)
		.then(constVoid);

export const latest = (): Promise<BigNumber> =>
	ethers.provider
		.getBlock("latest")
		.then(block => BigNumber.from(block.timestamp));

export const advanceTime = (time: unknown): Promise<void> =>
	ethers.provider.send("evm_increaseTime", [time]).then(constVoid);

export const advanceTimeAndBlock = (time: unknown): Promise<void> =>
	advanceTime(time).then(advanceBlock);

export const duration = {
	seconds: (val: unknown): BigNumber => BigNumber.from(val),
	minutes: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(duration.seconds("60")),
	hours: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(duration.minutes("60")),
	days: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(duration.hours("24")),
	weeks: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(duration.days("7")),
	years: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(duration.days("365"))
};
