import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployMockContract, MockContract } from "ethereum-waffle";
import BEP20 from "../../build/abi/BEP20.json";
import IFarm from "../../build/abi/IFarm.json";
import IRouter from "../../build/abi/IRouter.json";
import IPair from "../../build/abi/IPair.json";
import FarmCommander from "../../build/abi/FarmCommander.json";

export const mockBEP20 = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[] = []
): Promise<MockContract> =>
	deployMockContract(deployer, BEP20).then(async contract => {
		for (let i = 0, n = mockMethods.length; i < n; i++) {
			const mockMethod = mockMethods[i];

			await contract.mock[mockMethod.name].returns(
				...(mockMethod.returns ?? [])
			);
		}

		return contract;
	});

export const mockFarm = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[] = []
): Promise<MockContract> =>
	deployMockContract(deployer, IFarm).then(async contract => {
		for (let i = 0, n = mockMethods.length; i < n; i++) {
			const mockMethod = mockMethods[i];

			await contract.mock[mockMethod.name].returns(
				...(mockMethod.returns ?? [])
			);
		}

		return contract;
	});

export const mockRouter = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[] = []
): Promise<MockContract> =>
	deployMockContract(deployer, IRouter).then(async contract => {
		for (let i = 0, n = mockMethods.length; i < n; i++) {
			const mockMethod = mockMethods[i];

			await contract.mock[mockMethod.name].returns(
				...(mockMethod.returns ?? [])
			);
		}

		return contract;
	});

export const mockPair = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[] = []
): Promise<MockContract> =>
	deployMockContract(deployer, IPair).then(async contract => {
		for (let i = 0, n = mockMethods.length; i < n; i++) {
			const mockMethod = mockMethods[i];

			await contract.mock[mockMethod.name].returns(
				...(mockMethod.returns ?? [])
			);
		}

		return contract;
	});

export const mockFarmCommander = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[] = []
): Promise<MockContract> =>
	deployMockContract(deployer, FarmCommander).then(async contract => {
		for (let i = 0, n = mockMethods.length; i < n; i++) {
			const mockMethod = mockMethods[i];

			await contract.mock[mockMethod.name].returns(
				...(mockMethod.returns ?? [])
			);
		}

		return contract;
	});
