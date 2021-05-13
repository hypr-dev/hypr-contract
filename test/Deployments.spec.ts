import fs from "fs";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { constants } from "ethers";
import {
	HyperToken,
	SpaceMaster,
	FarmCommander,
	TimelockController
} from "../build/types";
import { AddressJson, EthersGetContract } from "../types";
import {
	ETH_INITIAL_MINT,
	DEFAULT_FILENAME_PAIRS,
	DEFAULT_FILENAME_FARMS,
	STRATEGIES,
	NAME_TOKEN,
	NAME_MASTER,
	NAME_TIMELOCK,
	NAME_FARM
} from "../constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "@ethersproject/units";

chai.use(chaiAsPromised);
chai.use(solidity);

describe("Deployments", () => {
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
	let deployer: SignerWithAddress,
		hypr: HyperToken,
		master: SpaceMaster,
		timelock: TimelockController;

	before(async () => {
		[deployer] = await ethers.getSigners();
		hypr = await (ethers as EthersGetContract<HyperToken>).getContract(
			NAME_TOKEN
		);
		master = await (ethers as EthersGetContract<SpaceMaster>).getContract(
			NAME_MASTER
		);
		timelock = await (ethers as EthersGetContract<
			TimelockController
		>).getContract(NAME_TIMELOCK);
	});

	describe(NAME_TOKEN, () => {
		it("should have correct name and symbol and decimal", async () => {
			// Assert
			await expect(hypr.name()).to.eventually.equal("hyperspace.finance");
			await expect(hypr.symbol()).to.eventually.equal("HYPR");
			await expect(hypr.decimals()).to.eventually.equal(18);
		});

		it("should have minted initial amount", async () => {
			// Assert
			expect(await hypr.totalSupply()).to.equal(
				parseEther(ETH_INITIAL_MINT)
			);
		});

		it("should have SpaceMaster as owner", async () => {
			// Assert
			await expect(hypr.owner()).to.eventually.equal(master.address);
		});
	});

	describe("Pairs", () => {
		const strategies = STRATEGIES.filter(
			strategy => !strategy.isHYPRComp && !strategy.isComp
		);

		it("should have created pairs", async () => {
			// Assert
			for (let i = 0; i < strategies.length; i++) {
				const strategy = strategies[i];

				await expect(
					ethers.provider.getCode(PAIRS[strategy.symbol].address)
				).to.be.fulfilled;
			}
		});
	});

	describe(NAME_MASTER, () => {
		it("should have correct addresses", async () => {
			// Assert
			await expect(master.lpAdrs()).to.eventually.equal(
				PAIRS["HYPR-WBNB"].address
			);
			await expect(master.hyprAdrs()).to.eventually.equal(hypr.address);
			await expect(master.devWalletAdrs()).to.eventually.equal(
				deployer.address
			);
			await expect(master.feeBbAdrs()).to.eventually.equal(
				deployer.address
			);
			await expect(master.feeStAdrs()).to.eventually.equal(
				deployer.address
			);
		});

		it("should have TimelockController as owner", async () => {
			// Assert
			await expect(master.owner()).to.eventually.equal(timelock.address);
		});
	});

	describe(NAME_FARM, () => {
		it("should have correct addresses", async () => {
			// Arrange
			const farmKeys: (keyof typeof FARMS)[] = Object.keys(FARMS);

			// Assert
			for (let i = 0, n = farmKeys.length; i < n; i++) {
				const strategy = STRATEGIES[i];
				const pair = PAIRS[strategy.symbol];
				const farm = FARMS[farmKeys[i]];
				const contract = (await ethers.getContractAt(
					NAME_FARM,
					farm.address
				)) as FarmCommander;

				await expect(contract.hyprAdrs()).to.eventually.equal(
					hypr.address
				);
				await expect(contract.wantAdrs()).to.eventually.equal(
					strategy.isHYPRComp ? strategy.address : pair.address
				);
				await expect(contract.wbnbAdrs()).to.eventually.equal(
					process.env.WBNB
				);
				await expect(contract.masterAdrs()).to.eventually.equal(
					master.address
				);
				await expect(contract.earnedAdrs()).to.eventually.equal(
					process.env.PANCAKE_CAKE
				);
				await expect(contract.govAdrs()).to.eventually.equal(
					timelock.address
				);
				await expect(contract.rewardsAdrs()).to.eventually.equal(
					deployer.address
				);

				if (strategy.isHYPRComp) {
					await expect(contract.farmAdrs()).to.eventually.equal(
						process.env.PANCAKE_FARM
					);
					await expect(contract.routerAdrs()).to.eventually.equal(
						process.env.PANCAKE_ROUTER
					);
					await expect(contract.wbnbPairAdrs()).to.eventually.equal(
						PAIRS["HYPR-WBNB"].address
					);
				} else {
					await expect(contract.farmAdrs()).to.eventually.equal(
						constants.AddressZero
					);
					await expect(contract.routerAdrs()).to.eventually.equal(
						constants.AddressZero
					);
					await expect(contract.wbnbPairAdrs()).to.eventually.equal(
						constants.AddressZero
					);
				}

				await expect(contract.owner()).to.eventually.equal(
					master.address
				);
			}
		});

		it("should have correct pid", async () => {
			// Arrange
			const farmKeys: (keyof typeof FARMS)[] = Object.keys(FARMS);

			// Assert
			for (let i = 0, n = farmKeys.length; i < n; i++) {
				const strategy = STRATEGIES[i];
				const farm = FARMS[farmKeys[i]];
				const contract = (await ethers.getContractAt(
					NAME_FARM,
					farm.address
				)) as FarmCommander;

				if (strategy.isHYPRComp) {
					await expect(contract.pid()).to.eventually.equal(
						strategy.pid
					);
				} else {
					await expect(contract.pid()).to.eventually.equal(0);
				}
			}
		});

		it("should have correct owner", async () => {
			// Arrange
			const farmKeys: (keyof typeof FARMS)[] = Object.keys(FARMS);

			// Assert
			for (let i = 0, n = farmKeys.length; i < n; i++) {
				const farm = FARMS[farmKeys[i]];
				const contract = (await ethers.getContractAt(
					NAME_FARM,
					farm.address
				)) as FarmCommander;

				await expect(contract.owner()).to.eventually.equal(
					master.address
				);
			}
		});

		it("should have correct pool info", async () => {
			// Arrange
			const farmKeys: (keyof typeof FARMS)[] = Object.keys(FARMS);

			// Assert
			for (let i = 0, n = farmKeys.length; i < n; i++) {
				const strategy = STRATEGIES[i];
				const pair = PAIRS[strategy.symbol];
				const farm = FARMS[farmKeys[i]];

				await master.poolInfo(farm.pid).then(poolInfo => {
					expect(poolInfo.want).to.equal(
						strategy.isHYPRComp ? strategy.address : pair.address
					);
					expect(poolInfo.strategy).to.equal(farm.address);
					expect(poolInfo.allocPoint).to.equal(strategy.weight);
					expect(poolInfo.accHYPRPerShare).to.equal(0);
					expect(poolInfo.depositFeeBP).to.equal(strategy.fee ?? 0);
					expect(poolInfo.isComp).to.equal(strategy.isComp);
				});
			}
		});

		it("should have correct bools", async () => {
			// Arrange
			const farmKeys: (keyof typeof FARMS)[] = Object.keys(FARMS);

			// Assert
			for (let i = 0, n = farmKeys.length; i < n; i++) {
				const strategy = STRATEGIES[i];
				const farm = FARMS[farmKeys[i]];
				const contract = (await ethers.getContractAt(
					NAME_FARM,
					farm.address
				)) as FarmCommander;

				await expect(contract.onlyGov()).to.eventually.equal(false);
				await expect(contract.isCAKEStaking()).to.eventually.equal(
					strategy.isCAKEStaking
				);
				await expect(contract.isHYPRComp()).to.eventually.equal(
					strategy.isHYPRComp
				);
			}
		});
	});
});
