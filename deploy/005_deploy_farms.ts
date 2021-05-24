import fs from "fs";
import { constants } from "ethers";
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
import { wait } from "../utils/network";

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
	const strategies = STRATEGIES.filter(strategy => strategy.type === "farm");
	const hypr = await deployments.get(NAME_TOKEN);
	const master = await (ethers as EthersGetContract<SpaceMaster>).getContract(
		NAME_MASTER
	);
	const timelock = await deployments.get(NAME_TIMELOCK);

	for (let i = 0, n = strategies.length; i < n; i++) {
		const strategy = strategies[i];

		if (FARMS[strategy.symbol]) continue;

		const pair = PAIRS[strategy.symbol];
		const addresses = [
			hypr.address,
			strategy.isHYPRComp ? strategy.address : pair.address,
			process.env.ADRS_WBNB ?? constants.AddressZero,
			master.address
		];

		if (strategy.isHYPRComp) {
			addresses.push(
				process.env.ADRS_FARM ?? constants.AddressZero,
				process.env.ADRS_ROUTER ?? constants.AddressZero,
				process.env.ADRS_CAKE ?? constants.AddressZero,
				timelock.address,
				deployer,
				PAIRS["HYPR-WBNB"].address
			);
		} else {
			addresses.push(
				process.env.ADRS_CAKE ?? constants.AddressZero,
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
				strategy.harvestInterval,
				strategy.fee ?? 0,
				true
			)
			.then(wait);

		FARMS[strategy.symbol] = {
			pid: i,
			address: farm.address
		};

		console.log(`Farm added between ${strategy.symbol} at ${farm.address}`);
	}

	fs.writeFileSync(
		`./dist/${process.env.FILENAME_FARMS ?? DEFAULT_FILENAME_FARMS}`,
		JSON.stringify(FARMS)
	);
};

export { name };
export default func;

func.tags = [name];
func.dependencies = [NAME_MASTER, NAME_TIMELOCK];
