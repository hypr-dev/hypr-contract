import { BigNumber, constants } from "ethers";
import { getWeight } from "./utils/parser";

export { name as NAME_TOKEN } from "./deploy/001_deploy_token";
export { name as NAME_MASTER } from "./deploy/003_deploy_master";
export { name as NAME_TIMELOCK } from "./deploy/004_deploy_timelock";
export { name as NAME_FARM } from "./deploy/005_deploy_farms";
export { name as NAME_COMP } from "./deploy/006_deploy_comps";
export const ETH_INITIAL_MINT = "10000";
export const DEFAULT_FILENAME_PAIRS = "pairs.localhost.json";
export const DEFAULT_FILENAME_FARMS = "farms.localhost.json";
export const DEFAULT_FILENAME_COMPS = "comps.localhost.json";
export const DURATION = {
	seconds: (val: unknown): BigNumber => BigNumber.from(val),
	minutes: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(DURATION.seconds("60")),
	hours: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(DURATION.minutes("60")),
	days: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(DURATION.hours("24")),
	weeks: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(DURATION.days("7")),
	years: (val: unknown): BigNumber =>
		BigNumber.from(val).mul(DURATION.days("365"))
};
export const STRATEGIES: Strategy[] = [
	{
		pid: 0,
		symbol: "HYPR-WBNB",
		address: process.env.ADRS_WBNB ?? constants.AddressZero,
		weight: getWeight(32),
		harvestInterval: DURATION.hours(2),
		type: "farm",
		isHYPRComp: false,
		isCAKEStaking: false
	},
	{
		pid: 1,
		symbol: "HYPR-BUSD",
		address: process.env.ADRS_BUSD ?? constants.AddressZero,
		weight: getWeight(32),
		harvestInterval: DURATION.hours(2),
		type: "farm",
		isHYPRComp: false,
		isCAKEStaking: false
	},
	{
		pid: 252,
		symbol: "BNB-BUSD LP",
		address: "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16",
		weight: getWeight(6),
		harvestInterval: DURATION.hours(8),
		fee: 400,
		type: "farm",
		isHYPRComp: true,
		isCAKEStaking: false
	},
	{
		pid: 252,
		symbol: "BNB-BUSD LP",
		address: "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16",
		token0: process.env.ADRS_WBNB ?? constants.AddressZero,
		token1: process.env.ADRS_BUSD ?? constants.AddressZero,
		earnedToToken0Path: [
			process.env.ADRS_CAKE ?? constants.AddressZero,
			process.env.ADRS_WBNB ?? constants.AddressZero
		],
		earnedToToken1Path: [
			process.env.ADRS_CAKE ?? constants.AddressZero,
			process.env.ADRS_BUSD ?? constants.AddressZero
		],
		token0ToEarnedPath: [
			process.env.ADRS_WBNB ?? constants.AddressZero,
			process.env.ADRS_CAKE ?? constants.AddressZero
		],
		token1ToEarnedPath: [
			process.env.ADRS_BUSD ?? constants.AddressZero,
			process.env.ADRS_CAKE ?? constants.AddressZero
		],
		weight: getWeight(1),
		harvestInterval: constants.Zero,
		type: "comp",
		isHYPRComp: true,
		isCAKEStaking: false
	},
	{
		pid: 262,
		symbol: "BTCB-BNB LP",
		address: "0x61EB789d75A95CAa3fF50ed7E47b96c132fEc082",
		weight: getWeight(5),
		harvestInterval: DURATION.hours(8),
		fee: 400,
		type: "farm",
		isHYPRComp: true,
		isCAKEStaking: false
	},
	{
		pid: 261,
		symbol: "ETH-BNB LP",
		address: "0x74E4716E431f45807DCF19f284c7aA99F18a4fbc",
		weight: getWeight(5),
		harvestInterval: DURATION.hours(8),
		fee: 400,
		type: "farm",
		isHYPRComp: true,
		isCAKEStaking: false
	},
	{
		pid: 255,
		symbol: "DOT-BNB LP",
		address: "0xDd5bAd8f8b360d76d12FdA230F8BAF42fe0022CF",
		weight: getWeight(2),
		harvestInterval: DURATION.hours(8),
		fee: 400,
		type: "farm",
		isHYPRComp: true,
		isCAKEStaking: false
	},
	{
		pid: 251,
		symbol: "CAKE-BNB LP",
		address: "0x0eD7e52944161450477ee417DE9Cd3a859b14fD0",
		weight: getWeight(2),
		harvestInterval: DURATION.hours(8),
		fee: 400,
		type: "farm",
		isHYPRComp: true,
		isCAKEStaking: false
	}
];
