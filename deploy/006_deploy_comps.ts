import fs from "fs";
import { constants } from "ethers";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { SpaceMaster } from "../build/types";
import {
	NAME_MASTER,
	NAME_TIMELOCK,
	NAME_TOKEN,
	STRATEGIES,
	DEFAULT_FILENAME_COMPS
} from "../constants";
import { wait } from "../utils/network";

const name = "CompCommander";
const func: DeployFunction = async () => {
	const { deployer } = await getNamedAccounts();
	const COMPS = JSON.parse(
		fs.readFileSync(
			`./dist/${process.env.FILENAME_COMPS ?? DEFAULT_FILENAME_COMPS}`,
			"utf8"
		)
	) as AddressJson;
	const hypr = await deployments.get(NAME_TOKEN);
	const master = await (ethers as EthersGetContract<SpaceMaster>).getContract(
		NAME_MASTER
	);
	const timelock = await deployments.get(NAME_TIMELOCK);
	const strategies = STRATEGIES.filter(strategy => strategy.type === "comp");

	for (let i = 0, n = strategies.length; i < n; i++) {
		const strategy = strategies[i];

		if (COMPS[strategy.symbol]) continue;

		const addresses = [
			hypr.address,
			strategy.address,
			process.env.ADRS_WBNB ?? constants.AddressZero,
			master.address,
			process.env.ADRS_FARM ?? constants.AddressZero,
			process.env.ADRS_ROUTER ?? constants.AddressZero,
			process.env.ADRS_CAKE ?? constants.AddressZero,
			timelock.address,
			deployer,
			deployer,
			deployer,
			strategy.token0 ?? constants.AddressZero,
			strategy.token1 ?? constants.AddressZero
		];

		const comp = await deployments.deploy(name, {
			from: deployer,
			args: [
				strategy.pid,
				addresses,
				[
					process.env.ADRS_CAKE ?? constants.AddressZero,
					process.env.ADRS_WBNB ?? constants.AddressZero,
					hypr.address
				],
				strategy.earnedToToken0Path,
				strategy.earnedToToken1Path,
				strategy.token0ToEarnedPath,
				strategy.token1ToEarnedPath,
				strategy.isHYPRComp,
				strategy.isCAKEStaking,
				strategy.isSameAssetDeposit ?? false
			],
			log: true
		});

		await master
			.add(
				strategy.address,
				comp.address,
				strategy.weight,
				strategy.harvestInterval,
				strategy.fee ?? 0,
				true
			)
			.then(wait);

		COMPS[strategy.symbol] = {
			pid: i,
			address: comp.address
		};

		console.log(`Comp added between ${strategy.symbol} at ${comp.address}`);
	}

	fs.writeFileSync(
		`./dist/${process.env.FILENAME_COMPS ?? DEFAULT_FILENAME_COMPS}`,
		JSON.stringify(COMPS)
	);

	if ((await master.owner()) === deployer)
		await master.transferOwnership(timelock.address).then(wait);
};

export { name };
export default func;

func.tags = [name];
func.dependencies = [NAME_MASTER, NAME_TIMELOCK];
