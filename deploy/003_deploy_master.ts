import fs from "fs";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HyperToken, SpaceMaster } from "../build/types";
import { AddressJson, EthersGetContract } from "../types";
import { wait } from "../utils/network";
import { DEFAULT_FILENAME_PAIRS, NAME_TOKEN } from "../constants";

const name = "SpaceMaster";
const func: DeployFunction = async () => {
	const { deployer } = await getNamedAccounts();
	const PAIRS = JSON.parse(
		fs.readFileSync(
			`./dist/${process.env.FILENAME_PAIRS ?? DEFAULT_FILENAME_PAIRS}`,
			"utf8"
		)
	) as AddressJson;
	const hypr = await (ethers as EthersGetContract<HyperToken>).getContract(
		NAME_TOKEN
	);

	if ((await hypr.owner()) !== deployer) return;

	const startBlock = await ethers.provider.getBlockNumber();
	const args = [
		[
			PAIRS["HYPR-WBNB"].address,
			hypr.address,
			deployer,
			deployer,
			deployer
		],
		startBlock
	];

	await deployments.deploy(name, {
		from: deployer,
		args,
		log: true
	});

	const master = await (ethers as EthersGetContract<SpaceMaster>).getContract(
		name
	);

	await hypr.transferOwnership(master.address).then(wait);
};

export { name };
export default func;

func.tags = [name];
func.dependencies = [NAME_TOKEN, "Pairs"];
