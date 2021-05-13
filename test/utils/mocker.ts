import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployMockContract, MockContract } from "ethereum-waffle";
import BEP20 from "../../build/abi/BEP20.json";
import IPancakeFarm from "../../build/abi/IPancakeFarm.json";
import IPancakeRouter02 from "../../build/abi/IPancakeRouter02.json";
import IPancakePair from "../../build/abi/IPancakePair.json";
import FarmCommander from "../../build/abi/FarmCommander.json";
import { MockMethod } from "../../types";

export const mockBEP20 = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[]
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

export const mockPancakeFarm = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[]
): Promise<MockContract> =>
	deployMockContract(deployer, IPancakeFarm).then(async contract => {
		for (let i = 0, n = mockMethods.length; i < n; i++) {
			const mockMethod = mockMethods[i];

			await contract.mock[mockMethod.name].returns(
				...(mockMethod.returns ?? [])
			);
		}

		return contract;
	});

export const mockPancakeRouter02 = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[]
): Promise<MockContract> =>
	deployMockContract(deployer, IPancakeRouter02).then(async contract => {
		for (let i = 0, n = mockMethods.length; i < n; i++) {
			const mockMethod = mockMethods[i];

			await contract.mock[mockMethod.name].returns(
				...(mockMethod.returns ?? [])
			);
		}

		return contract;
	});

export const mockPancakePair = (
	deployer: SignerWithAddress,
	mockMethods: MockMethod[]
): Promise<MockContract> =>
	deployMockContract(deployer, IPancakePair).then(async contract => {
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
	mockMethods: MockMethod[]
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
