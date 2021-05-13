import { constants } from "ethers";
import { Strategy } from "./types";
import { getWeight } from "./utils/parser";

export { name as NAME_TOKEN } from "./deploy/001_deploy_token";
export { name as NAME_MASTER } from "./deploy/003_deploy_master";
export { name as NAME_TIMELOCK } from "./deploy/004_deploy_timelock";
export { name as NAME_FARM } from "./deploy/005_deploy_farms";
export const ETH_INITIAL_MINT = "10000";
export const DEFAULT_FILENAME_PAIRS = "pairs.localhost.json";
export const DEFAULT_FILENAME_FARMS = "farms.localhost.json";
export const STRATEGIES: Strategy[] = [
	{
		symbol: "HYPR-WBNB",
		address: process.env.WBNB ?? constants.AddressZero,
		weight: getWeight(32),
		pid: 0,
		isHYPRComp: false,
		isCAKEStaking: false,
		isComp: false
	},
	{
		symbol: "HYPR-BUSD",
		address: process.env.BUSD ?? constants.AddressZero,
		weight: getWeight(32),
		pid: 1,
		isHYPRComp: false,
		isCAKEStaking: false,
		isComp: false
	},
	{
		symbol: "BNB-BUSD LP",
		address: "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16",
		weight: getWeight(6),
		pid: 252,
		isHYPRComp: true,
		isCAKEStaking: false,
		isComp: false
	},
	{
		symbol: "BTCB-BNB LP",
		address: "0x61EB789d75A95CAa3fF50ed7E47b96c132fEc082",
		weight: getWeight(5),
		pid: 262,
		isHYPRComp: true,
		isCAKEStaking: false,
		isComp: false
	},
	{
		symbol: "ETH-BNB LP",
		address: "0x74E4716E431f45807DCF19f284c7aA99F18a4fbc",
		weight: getWeight(5),
		pid: 261,
		isHYPRComp: true,
		isCAKEStaking: false,
		isComp: false
	},
	{
		symbol: "DOT-BNB LP",
		address: "0xDd5bAd8f8b360d76d12FdA230F8BAF42fe0022CF",
		weight: getWeight(2),
		pid: 255,
		isHYPRComp: true,
		isCAKEStaking: false,
		isComp: false
	},
	{
		symbol: "CAKE-BNB LP",
		address: "0x0eD7e52944161450477ee417DE9Cd3a859b14fD0",
		weight: getWeight(2),
		pid: 251,
		isHYPRComp: true,
		isCAKEStaking: false,
		isComp: false
	}
];
