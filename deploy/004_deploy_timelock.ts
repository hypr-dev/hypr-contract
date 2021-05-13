import { deployments, getNamedAccounts } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";

const name = "TimelockController";
const func: DeployFunction = async () => {
	const { deployer } = await getNamedAccounts();
	const args = [10000, deployer];

	await deployments.deploy(name, {
		from: deployer,
		args,
		log: true
	});
};

export { name };
export default func;

func.tags = [name];
