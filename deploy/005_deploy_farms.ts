import fs from "fs";
import { constants, ContractTransaction } from "ethers";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { SpaceMaster } from "../build/types";
import {
	DEFAULT_FILENAME_PAIRS,
	DEFAULT_FILENAME_FARMS,
	NAME_MASTER,
	NAME_TIMELOCK,
	NAME_TOKEN,
	STRATEGIES
} from "../constants";
import { AddressJson, EthersGetContract } from "../types";
import { getRemoteContract, wait } from "../utils/network";

const name = "FarmCommander";
const func: DeployFunction = async () => {
	const { deployer } = await getNamedAccounts();
	const PAIRS = JSON.parse(
		fs.readFileSync(
			`./dist/${process.env.FILENAME_PAIRS ?? DEFAULT_FILENAME_PAIRS}`,
			"utf8"
		)
	) as AddressJson;
	const FARMS = JSON.parse(
		fs.readFileSync(
			`./dist/${process.env.FILENAME_FARMS ?? DEFAULT_FILENAME_FARMS}`,
			"utf8"
		)
	) as AddressJson;
	const factory = await getRemoteContract<{
		createPair: (t1: string, t2: string) => Promise<ContractTransaction>;
	}>(process.env.PANCAKE_FACTORY);
	const hypr = await deployments.get(NAME_TOKEN);
	const master = await (ethers as EthersGetContract<SpaceMaster>).getContract(
		NAME_MASTER
	);
	const timelock = await deployments.get(NAME_TIMELOCK);

	if (!factory) throw new Error("PancakeFactory missing.");

	for (let i = 0, n = STRATEGIES.length; i < n; i++) {
		const strategy = STRATEGIES[i];

		if (FARMS[strategy.symbol]) continue;

		const pair = PAIRS[strategy.symbol];
		const addresses = [
			hypr.address,
			strategy.isHYPRComp ? strategy.address : pair.address,
			process.env.WBNB ?? constants.AddressZero,
			master.address
		];

		if (strategy.isHYPRComp) {
			addresses.push(
				process.env.PANCAKE_FARM ?? constants.AddressZero,
				process.env.PANCAKE_ROUTER ?? constants.AddressZero,
				process.env.PANCAKE_CAKE ?? constants.AddressZero,
				timelock.address,
				deployer,
				PAIRS["HYPR-WBNB"].address
			);
		} else {
			addresses.push(
				process.env.PANCAKE_CAKE ?? constants.AddressZero,
				timelock.address,
				deployer
			);
		}

		const farm = await deployments.deploy(name, {
			from: deployer,
			args: [
				strategy.isHYPRComp ? strategy.pid : i,
				addresses,
				strategy.isHYPRComp,
				strategy.isCAKEStaking
			],
			log: true
		});

		await master
			.add(
				strategy.isHYPRComp ? strategy.address : pair.address,
				farm.address,
				strategy.weight,
				strategy.fee ?? 0,
				strategy.isComp,
				true
			)
			.then(wait);

		FARMS[strategy.symbol] = {
			pid: i,
			address: farm.address
		};

		console.log(
			`Farm added between ${strategy.symbol} at ${
				strategy.isHYPRComp ? strategy.address : pair.address
			}`
		);
	}

	fs.writeFileSync(
		`./dist/${process.env.FILENAME_FARMS ?? DEFAULT_FILENAME_FARMS}`,
		JSON.stringify(FARMS)
	);

	if ((await master.owner()) === deployer)
		await master.transferOwnership(timelock.address).then(wait);
};

export { name };
export default func;

func.tags = [name];
func.dependencies = [NAME_MASTER, NAME_TIMELOCK];
