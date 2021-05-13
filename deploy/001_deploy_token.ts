import { deployments, ethers, getNamedAccounts } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HyperToken } from "../build/types";
import { EthersGetContract } from "../types";
import { ETH_INITIAL_MINT } from "../constants";
import { wait } from "../utils/network";
import { parseEther } from "ethers/lib/utils";

const name = "HyperToken";
const func: DeployFunction = async () => {
	const { deployer } = await getNamedAccounts();
	const deployment = await deployments.deploy(name, {
		from: deployer,
		log: true
	});

	if (deployment.newlyDeployed)
		await (ethers as EthersGetContract<HyperToken>)
			.getContract(name)
			.then(hypr =>
				hypr["mint(uint256)"](parseEther(ETH_INITIAL_MINT)).then(wait)
			);
};

export { name };
export default func;

func.tags = [name];
