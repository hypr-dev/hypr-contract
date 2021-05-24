import fs from "fs";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HyperToken, SpaceMaster } from "../build/types";
import { DEFAULT_FILENAME_PAIRS, NAME_TOKEN } from "../constants";
import { getBlockNumber, wait } from "../utils/network";

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

	const startBlock = await getBlockNumber();
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
