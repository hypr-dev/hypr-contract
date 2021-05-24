import fs from "fs";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
	HyperToken,
	SpaceMaster,
	FarmCommander,
	TimelockController
} from "../build/types";
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
import { revertToSnapShot, takeSnapshot } from "./utils";

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
		timelock: TimelockController,
		snapshotId: string;

	before(async () => {
		snapshotId = await takeSnapshot();
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
			expect(await hypr.name()).to.equal("hyperspace.finance");
			expect(await hypr.symbol()).to.equal("HYPR");
			expect(await hypr.decimals()).to.equal(18);
		});

		it("should have minted initial amount", async () => {
			// Assert
			expect(await hypr.totalSupply()).to.equal(
				parseEther(ETH_INITIAL_MINT)
			);
		});

		it("should have SpaceMaster as owner", async () => {
			// Assert
			expect(await hypr.owner()).to.equal(master.address);
		});
	});

	describe("Pairs", () => {
		const strategies = STRATEGIES.filter(
			strategy => !strategy.isHYPRComp && strategy.type !== "comp"
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
			expect(await master.hyprAdrs()).to.equal(hypr.address);
			expect(await master.devWalletAdrs()).to.equal(deployer.address);
			expect(await master.feeBbAdrs()).to.equal(deployer.address);
			expect(await master.feeStAdrs()).to.equal(deployer.address);
		});

		it("should have TimelockController as owner", async () => {
			// Assert
			expect(await master.owner()).to.equal(timelock.address);
		});
	});

	describe(NAME_FARM, () => {
		it("should have correct addresses", async () => {
			// Arrange
			const strategies = STRATEGIES.filter(
				strategy => strategy.type === "farm"
			);

			// Assert
			for (let i = 0, n = strategies.length; i < n; i++) {
				const strategy = strategies[i];
				const pair = PAIRS[strategy.symbol];
				const farm = FARMS[strategy.symbol];
				const contract = (await ethers.getContractAt(
					NAME_FARM,
					farm.address
				)) as FarmCommander;

				expect(await contract.hyprAdrs()).to.equal(hypr.address);
				expect(await contract.wantAdrs()).to.equal(
					strategy.isHYPRComp ? strategy.address : pair.address
				);
				expect(await contract.wbnbAdrs()).to.equal(
					process.env.ADRS_WBNB
				);
				expect(await contract.masterAdrs()).to.equal(master.address);
				expect(await contract.earnedAdrs()).to.equal(
					process.env.ADRS_CAKE
				);
				expect(await contract.govAdrs()).to.equal(timelock.address);
				expect(await contract.feeAdrs()).to.equal(deployer.address);

				if (strategy.isHYPRComp) {
					expect(await contract.farmAdrs()).to.equal(
						process.env.ADRS_FARM
					);
					expect(await contract.routerAdrs()).to.equal(
						process.env.ADRS_ROUTER
					);
					expect(await contract.wbnbPairAdrs()).to.equal(
						PAIRS["HYPR-WBNB"].address
					);
				} else {
					expect(await contract.farmAdrs()).to.equal(
						constants.AddressZero
					);
					expect(await contract.routerAdrs()).to.equal(
						constants.AddressZero
					);
					expect(await contract.wbnbPairAdrs()).to.equal(
						constants.AddressZero
					);
				}

				expect(await contract.owner()).to.equal(master.address);
			}
		});

		it("should have correct pid", async () => {
			// Arrange
			const strategies = STRATEGIES.filter(
				strategy => strategy.type === "farm"
			);

			// Assert
			for (let i = 0, n = strategies.length; i < n; i++) {
				const strategy = strategies[i];
				const farm = FARMS[strategy.symbol];
				const contract = (await ethers.getContractAt(
					NAME_FARM,
					farm.address
				)) as FarmCommander;

				if (strategy.isHYPRComp) {
					expect(await contract.pid()).to.equal(strategy.pid);
				} else {
					expect(await contract.pid()).to.equal(0);
				}
			}
		});

		it("should have correct owner", async () => {
			// Arrange
			const strategies = STRATEGIES.filter(
				strategy => strategy.type === "farm"
			);

			// Assert
			for (let i = 0, n = strategies.length; i < n; i++) {
				const strategy = strategies[i];
				const farm = FARMS[strategy.symbol];
				const contract = (await ethers.getContractAt(
					NAME_FARM,
					farm.address
				)) as FarmCommander;

				expect(await contract.owner()).to.equal(master.address);
			}
		});

		it("should have correct pool info", async () => {
			// Arrange
			const strategies = STRATEGIES.filter(
				strategy => strategy.type === "farm"
			);

			// Assert
			for (let i = 0, n = strategies.length; i < n; i++) {
				const strategy = strategies[i];
				const pair = PAIRS[strategy.symbol];
				const farm = FARMS[strategy.symbol];

				await master.poolInfo(farm.pid).then(poolInfo => {
					expect(poolInfo.want).to.equal(
						strategy.isHYPRComp ? strategy.address : pair.address
					);
					expect(poolInfo.strategy).to.equal(farm.address);
					expect(poolInfo.allocPoint).to.equal(strategy.weight);
					expect(poolInfo.accHYPRPerShare).to.equal(0);
					expect(poolInfo.harvestInterval).to.equal(
						strategy.harvestInterval
					);
					expect(poolInfo.depositFeeBP).to.equal(strategy.fee ?? 0);
				});
			}
		});

		it("should have correct bools", async () => {
			// Arrange
			const strategies = STRATEGIES.filter(
				strategy => strategy.type === "farm"
			);

			// Assert
			for (let i = 0, n = strategies.length; i < n; i++) {
				const strategy = strategies[i];
				const farm = FARMS[strategy.symbol];
				const contract = (await ethers.getContractAt(
					NAME_FARM,
					farm.address
				)) as FarmCommander;

				expect(await contract.onlyGov()).to.equal(false);
				expect(await contract.isCAKEStaking()).to.equal(
					strategy.isCAKEStaking
				);
				expect(await contract.isHYPRComp()).to.equal(
					strategy.isHYPRComp
				);
			}
		});
	});

	after(async () => {
		await revertToSnapShot(snapshotId);
	});
});
