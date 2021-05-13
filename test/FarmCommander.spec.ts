import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { FarmCommander, HyperToken, SpaceMaster } from "../build/types";
import { EthersGetContract, Strategy } from "../types";
import { STRATEGIES, NAME_TOKEN, NAME_FARM, NAME_MASTER } from "../constants";
import { constants } from "ethers";
import { wait } from "../utils/network";
import { parseEther } from "@ethersproject/units";
import {
	mockPancakeFarm,
	mockBEP20,
	mockPancakeRouter02,
	mockPancakePair
} from "./utils/mocker";

chai.use(chaiAsPromised);
chai.use(solidity);

describe(NAME_FARM, () => {
	const contracts: Record<
		string,
		Strategy & { contract: FarmCommander }
	> = {};
	let deployer: SignerWithAddress,
		gov: SignerWithAddress,
		rewards: SignerWithAddress,
		user: SignerWithAddress,
		owner: SignerWithAddress,
		hypr: HyperToken,
		master: SpaceMaster;

	before(async () => {
		[deployer, gov, rewards, user] = await ethers.getSigners();
		hypr = await (ethers as EthersGetContract<HyperToken>).getContract(
			NAME_TOKEN
		);
		master = await (ethers as EthersGetContract<SpaceMaster>).getContract(
			NAME_MASTER
		);
		owner = await network.provider
			.request({
				method: "hardhat_impersonateAccount",
				params: [master.address]
			})
			.then(() => ethers.getSigner(master.address));

		const bep20 = await mockBEP20(deployer, [
			{ name: "transfer", returns: [true] },
			{ name: "transferFrom", returns: [true] },
			{ name: "balanceOf", returns: [parseEther("1")] },
			{ name: "allowance", returns: [parseEther("0")] },
			{ name: "approve", returns: [true] }
		]);
		const panFarm = await mockPancakeFarm(deployer, [
			{ name: "enterStaking" },
			{ name: "leaveStaking" },
			{ name: "deposit" },
			{ name: "withdraw" }
		]);
		const panRouter = await mockPancakeRouter02(deployer, [
			{ name: "swapExactTokensForTokensSupportingFeeOnTransferTokens" },
			{
				name: "addLiquidity",
				returns: [parseEther("0.5"), parseEther("0.5"), parseEther("1")]
			}
		]);
		const panPair = await mockPancakePair(deployer, [
			{ name: "balanceOf", returns: [parseEther("1")] }
		]);
		const strategies = STRATEGIES.filter(strat =>
			/HYPR-WBNB|(BNB-BUSD LP)/.test(strat.symbol)
		);

		for (let i = 0, n = strategies.length; i < n; i++) {
			const strategy = strategies[i];
			const addresses = [
				hypr.address,
				bep20.address,
				process.env.WBNB ?? constants.AddressZero,
				master.address
			];

			if (strategy.isHYPRComp) {
				addresses.push(
					panFarm.address,
					panRouter.address,
					bep20.address,
					gov.address,
					rewards.address,
					panPair.address
				);
			} else {
				addresses.push(bep20.address, gov.address, rewards.address);
			}

			const farm = (await ethers
				.getContractFactory(NAME_FARM)
				.then(factory =>
					factory.deploy(
						strategy.isHYPRComp ? strategy.pid : i,
						addresses,
						strategy.isHYPRComp,
						strategy.isCAKEStaking
					)
				)
				.then(contract => contract.deployed())) as FarmCommander;

			contracts[strategy.symbol] = { ...strategy, contract: farm };
		}
	});

	it("should return total LP earned", async () => {
		// Assert
		expect(await contracts["HYPR-WBNB"].contract.totalLpEarned()).to.equal(
			constants.Zero
		);
	});

	describe("setWbnbAddress", () => {
		it("should require from current gov address", async () => {
			// Assert
			await expect(
				contracts["HYPR-WBNB"].contract
					.connect(user)
					.setWbnbAddress(user.address)
			).to.be.revertedWith("StrategyCaptain: not authorised");
			expect(await contracts["HYPR-WBNB"].contract.wbnbAdrs()).to.equal(
				process.env.WBNB
			);
		});

		it("should set WBNB address", async () => {
			// Act
			const result = contracts["HYPR-WBNB"].contract
				.connect(gov)
				.setWbnbAddress(user.address);

			// Assert
			await expect(result)
				.to.emit(contracts["HYPR-WBNB"].contract, "SetWbnbAddress")
				.withArgs(user.address);
			await result.then(wait);
			expect(await contracts["HYPR-WBNB"].contract.wbnbAdrs()).to.equal(
				user.address
			);
		});

		after(async () => {
			await contracts["HYPR-WBNB"].contract
				.connect(gov)
				.setWbnbAddress(process.env.WBNB ?? constants.AddressZero)
				.then(wait);
		});
	});

	describe("deposit", () => {
		it("should require owner", async () => {
			// Assert
			await expect(
				contracts["HYPR-WBNB"].contract.deposit(parseEther("1"))
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should require unpaused", async () => {
			// Arrange
			await contracts["HYPR-WBNB"].contract
				.connect(gov)
				.pause()
				.then(wait);

			// Assert
			await expect(
				contracts["HYPR-WBNB"].contract
					.connect(owner)
					.deposit(parseEther("1"))
			).to.be.revertedWith("Pausable: paused");

			await contracts["HYPR-WBNB"].contract
				.connect(gov)
				.unpause()
				.then(wait);
		});

		it("should deposit when HYPR is not comp", async () => {
			// Act
			await contracts["HYPR-WBNB"].contract
				.connect(owner)
				.deposit(parseEther("1"))
				.then(wait);

			// Assert
			expect(
				await contracts["HYPR-WBNB"].contract.totalWantLocked()
			).to.equal(parseEther("1"));
		});

		it("should deposit when HYPR is comp", async () => {
			// Act
			await contracts["BNB-BUSD LP"].contract
				.connect(owner)
				.deposit(parseEther("1"))
				.then(wait);

			// Assert
			expect(
				await contracts["BNB-BUSD LP"].contract.totalWantLocked()
			).to.equal(parseEther("1"));
		});
	});

	describe("withdraw", () => {
		it("should require owner", async () => {
			// Assert
			await expect(
				contracts["HYPR-WBNB"].contract.withdraw(parseEther("1"))
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should withdraw when HYPR is not comp", async () => {
			// Act
			await contracts["HYPR-WBNB"].contract
				.connect(owner)
				.withdraw(parseEther("0.5"))
				.then(wait);

			// Assert
			expect(
				await contracts["HYPR-WBNB"].contract.totalWantLocked()
			).to.equal(parseEther("0.5"));
		});

		it("should withdraw when HYPR is comp", async () => {
			// Act
			await contracts["BNB-BUSD LP"].contract
				.connect(owner)
				.withdraw(parseEther("0.5"))
				.then(wait);

			// Assert
			expect(
				await contracts["BNB-BUSD LP"].contract.totalWantLocked()
			).to.equal(parseEther("0.5"));
		});
	});

	describe("earn", () => {
		it("should require unpaused", async () => {
			// Arrange
			await contracts["HYPR-WBNB"].contract
				.connect(gov)
				.pause()
				.then(wait);

			// Assert
			await expect(
				contracts["HYPR-WBNB"].contract.earn()
			).to.be.revertedWith("Pausable: paused");

			await contracts["HYPR-WBNB"].contract
				.connect(gov)
				.unpause()
				.then(wait);
		});

		it("should require is HYPR comp", async () => {
			// Assert
			await expect(
				contracts["HYPR-WBNB"].contract.earn()
			).to.be.revertedWith("FarmCommander: must be HYPR compound");
		});

		it("should earn", async () => {
			// Act
			await contracts["BNB-BUSD LP"].contract.earn().then(wait);

			// Assert
			expect(
				await contracts["BNB-BUSD LP"].contract.lastEarnBlock()
			).to.equal(await ethers.provider.getBlockNumber());
		});
	});
});
