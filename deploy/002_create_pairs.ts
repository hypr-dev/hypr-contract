import fs from "fs";
import { ContractTransaction } from "ethers";
import { deployments } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { DEFAULT_FILENAME_PAIRS, NAME_TOKEN, STRATEGIES } from "../constants";
import { getRemoteContract } from "../utils/network";
import { getPairAddress } from "../utils/parser";

const strategies = STRATEGIES.filter(
	strategy => !strategy.isHYPRComp && strategy.type === "farm"
);
const func: DeployFunction = async () => {
	const PAIRS = JSON.parse(
		fs.readFileSync(
			`./dist/${process.env.FILENAME_PAIRS ?? DEFAULT_FILENAME_PAIRS}`,
			"utf8"
		)
	) as AddressJson;
	const factory = await getRemoteContract<{
		createPair: (t1: string, t2: string) => Promise<ContractTransaction>;
	}>(process.env.ADRS_FACTORY);
	const hypr = await deployments.get(NAME_TOKEN);

	if (!factory) throw new Error("Factory missing");

	for (let i = 0, n = strategies.length; i < n; i++) {
		const strategy = strategies[i];

		if (PAIRS[strategy.symbol]) continue;

		const pairAdrs = await factory
			.createPair(hypr.address, strategy.address)
			.then(tx => tx.wait().then(getPairAddress));

		PAIRS[strategy.symbol] = {
			pid: strategy.pid ?? NaN,
			address: pairAdrs
		};

		console.log(`Pair created between ${strategy.symbol} at ${pairAdrs}`);
	}

	fs.writeFileSync(
		`./dist/${process.env.FILENAME_PAIRS ?? DEFAULT_FILENAME_PAIRS}`,
		JSON.stringify(PAIRS)
	);
};

export default func;

func.tags = ["Pairs"];
func.dependencies = [NAME_TOKEN];
