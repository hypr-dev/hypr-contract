import fs from "fs";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { MockContract, solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { constants } from "ethers";
import { BEP20, HyperToken, SpaceMaster } from "../build/types";
import {
	DEFAULT_FILENAME_PAIRS,
	DEFAULT_FILENAME_FARMS,
	STRATEGIES,
	NAME_TOKEN,
	NAME_MASTER,
	ETH_INITIAL_MINT
} from "../constants";
import { getWeight } from "../utils/parser";
import { AddressJson } from "../types";
import { wait } from "../utils/network";
import { parseEther } from "ethers/lib/utils";
import { mockFarmCommander } from "./utils/mocker";

chai.use(chaiAsPromised);
chai.use(solidity);

describe(NAME_MASTER, () => {
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
		devWallet: SignerWithAddress,
		feeBb: SignerWithAddress,
		feeSt: SignerWithAddress,
		user: SignerWithAddress,
		hypr: HyperToken,
		want: BEP20,
		farm: MockContract,
		contract: SpaceMaster;

	before(async () => {
		const startBlock = await ethers.provider.getBlockNumber();

		[deployer, devWallet, feeBb, feeSt, user] = await ethers.getSigners();
		hypr = (await ethers
			.getContractFactory(NAME_TOKEN)
			.then(factory => factory.deploy())
			.then(contract => contract.deployed())) as HyperToken;
		want = (await ethers
			.getContractFactory("BEP20")
			.then(factory => factory.deploy("X Token", "X"))) as BEP20;
		farm = await mockFarmCommander(deployer, [
			{ name: "totalWantLocked", returns: [parseEther("1")] },
			{ name: "deposit", returns: [parseEther("1")] },
			{ name: "withdraw", returns: [parseEther("1")] }
		]);
		contract = (await ethers
			.getContractFactory(NAME_MASTER)
			.then(factory =>
				factory.deploy(
					[
						PAIRS["HYPR-WBNB"].address,
						hypr.address,
						devWallet.address,
						feeBb.address,
						feeSt.address
					],
					startBlock
				)
			)
			.then(contract => contract.deployed())) as SpaceMaster;

		await hypr["mint(uint256)"](parseEther(ETH_INITIAL_MINT)).then(wait);
		await hypr.transferOwnership(contract.address).then(wait);
		await want.mint(parseEther(ETH_INITIAL_MINT)).then(wait);
	});

	describe("setDevWalletAddress", () => {
		it("should require from current dev wallet address", async () => {
			// Assert
			await expect(
				contract.connect(user).setDevWalletAddress(user.address)
			).to.be.revertedWith("SpaceMaster: dev: wut?");
			expect(await contract.devWalletAdrs()).to.equal(devWallet.address);
		});

		it("should set dev wallet address", async () => {
			// Act
			const result = contract
				.connect(devWallet)
				.setDevWalletAddress(user.address);

			// Assert
			await expect(result)
				.to.emit(contract, "SetDevWalletAddress")
				.withArgs(devWallet.address, user.address);
			await result.then(wait);
			expect(await contract.devWalletAdrs()).to.equal(user.address);
		});

		after(async () => {
			await contract
				.connect(user)
				.setDevWalletAddress(devWallet.address)
				.then(wait);
		});
	});

	describe("setFeeBbAddress", () => {
		it("should require from current fee buybback address", async () => {
			// Assert
			await expect(
				contract.connect(user).setFeeBbAddress(user.address)
			).to.be.revertedWith("SpaceMaster: setFeeBbAddress: FORBIDDEN");
			expect(await contract.feeBbAdrs()).to.equal(feeBb.address);
		});

		it("should set fee buyback address", async () => {
			// Act
			const result = contract
				.connect(feeBb)
				.setFeeBbAddress(user.address);

			// Assert
			await expect(result)
				.to.emit(contract, "SetFeeBbAddress")
				.withArgs(feeBb.address, user.address);
			await result.then(wait);
			expect(await contract.feeBbAdrs()).to.equal(user.address);
		});

		after(async () => {
			await contract
				.connect(user)
				.setFeeBbAddress(feeBb.address)
				.then(wait);
		});
	});

	describe("setFeeStAddress", () => {
		it("should require from current fee stake address", async () => {
			// Assert
			await expect(
				contract.connect(user).setFeeStAddress(user.address)
			).to.be.revertedWith("SpaceMaster: setFeeStAddress: FORBIDDEN");
			expect(await contract.feeStAdrs()).to.equal(feeSt.address);
		});

		it("should set fee stake address", async () => {
			// Act
			const result = contract
				.connect(feeSt)
				.setFeeStAddress(user.address);

			// Assert
			await expect(result)
				.to.emit(contract, "SetFeeStAddress")
				.withArgs(feeSt.address, user.address);
			await result.then(wait);
			expect(await contract.feeStAdrs()).to.equal(user.address);
		});

		after(async () => {
			await contract
				.connect(user)
				.setFeeStAddress(feeSt.address)
				.then(wait);
		});
	});

	describe("add", () => {
		it("should require owner", async () => {
			// Arrange
			const strategy = STRATEGIES[0];

			// Assert
			await expect(
				contract
					.connect(user)
					.add(
						PAIRS[strategy.symbol].address,
						FARMS[strategy.symbol].address,
						strategy.weight.toString(),
						strategy.fee ?? 0,
						false,
						false
					)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should add the pool without update", async () => {
			// Arrange
			const strategy = STRATEGIES[0];
			const hyprDevWalletBal = await hypr.balanceOf(devWallet.address);

			// Act
			await contract
				.add(
					PAIRS[strategy.symbol].address,
					FARMS[strategy.symbol].address,
					strategy.weight.toString(),
					strategy.fee ?? 0,
					false,
					false
				)
				.then(wait);

			// Assert
			await contract.poolInfo(0).then(info => {
				expect(info.want).to.equal(PAIRS[strategy.symbol].address);
				expect(info.strategy).to.equal(FARMS[strategy.symbol].address);
				expect(info.allocPoint).to.equal(strategy.weight);
				expect(info.accHYPRPerShare).to.equal(0);
				expect(info.depositFeeBP).to.equal(strategy.fee ?? 0);
			});

			expect(await contract.totalAllocPoint()).to.equal(strategy.weight);
			expect(await contract.poolLength()).to.equal(1);
			expect(await hypr.balanceOf(devWallet.address)).to.equal(
				hyprDevWalletBal
			);
		});

		it("should add the pool with update", async () => {
			// Arrange
			const strategy = STRATEGIES[1];
			const hyprDevWalletBal = await hypr.balanceOf(devWallet.address);

			await contract
				.add(
					want.address,
					farm.address,
					STRATEGIES[2].weight.toString(),
					200,
					false,
					true
				)
				.then(wait);

			// Act
			await contract
				.add(
					PAIRS[strategy.symbol].address,
					FARMS[strategy.symbol].address,
					strategy.weight.toString(),
					strategy.fee ?? 0,
					false,
					true
				)
				.then(wait);

			// Assert
			expect(await hypr.balanceOf(devWallet.address)).to.be.gte(
				hyprDevWalletBal
			);
		});
	});

	describe("set", () => {
		it("should require owner", async () => {
			// Arrange
			const strategy = STRATEGIES[0];

			// Assert
			await expect(
				contract
					.connect(user)
					.set(
						0,
						strategy.weight.toString(),
						strategy.fee ?? 0,
						false
					)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should require existing pool", async () => {
			// Arrange
			const strategy = STRATEGIES[0];

			// Assert
			await expect(
				contract.set(
					999,
					strategy.weight.toString(),
					strategy.fee ?? 0,
					false
				)
			).to.be.revertedWith("SpaceMaster: pool inexistent");
		});

		it("should set the pool without update", async () => {
			// Arrange
			const newWeight = getWeight(19);
			const newFee = 1;
			const hyprDevWalletBal = await hypr.balanceOf(devWallet.address);

			// Act
			await contract
				.set(0, newWeight.toString(), newFee, false)
				.then(wait);

			// Assert
			await contract.poolInfo(0).then(info => {
				expect(info.allocPoint).to.equal(newWeight);
				expect(info.depositFeeBP).to.equal(newFee);
			});

			expect(await contract.totalAllocPoint()).to.equal(
				await contract
					.totalAllocPoint()
					.then(totalAllocPoint =>
						contract
							.poolInfo(0)
							.then(poolInfo =>
								totalAllocPoint
									.sub(poolInfo.allocPoint)
									.add(newWeight)
							)
					)
			);
			expect(await hypr.balanceOf(devWallet.address)).to.equal(
				hyprDevWalletBal
			);
		});

		it("should set the pool with update", async () => {
			// Arrange
			const newWeight = getWeight(3);
			const newFee = 1;
			const hyprDevWalletBal = await hypr.balanceOf(devWallet.address);

			// Act
			await contract
				.set(0, newWeight.toString(), newFee, false)
				.then(wait);

			// Assert
			expect(await hypr.balanceOf(devWallet.address)).to.be.gte(
				hyprDevWalletBal
			);
		});
	});

	describe("deposit", () => {
		it("should require existing pool", async () => {
			// Assert
			await expect(
				contract.deposit(999, parseEther("1"))
			).to.be.revertedWith("SpaceMaster: pool inexistent");
		});

		it("should deposit", async () => {
			// Arrange
			const hyprDevWalletBal = await hypr.balanceOf(devWallet.address);
			const wantDeployerBal = await want.balanceOf(deployer.address);

			await want.increaseAllowance(contract.address, parseEther("1"));

			// Act
			const result = contract.deposit(1, parseEther("1"));

			// Assert
			await expect(result)
				.to.emit(contract, "Deposit")
				.withArgs(deployer.address, 1, parseEther("1"));

			await result.then(wait);
			await contract
				.userInfo(1, deployer.address)
				.then(async userInfo => {
					expect(userInfo.amount).to.equal(parseEther("1"));
					expect(userInfo.rewardDebt).to.equal(
						userInfo.amount
							.mul(
								await contract
									.poolInfo(1)
									.then(poolInfo => poolInfo.accHYPRPerShare)
							)
							.div(1e12)
					);
				});

			expect(await hypr.balanceOf(devWallet.address)).to.be.gte(
				hyprDevWalletBal
			);
			expect(await want.balanceOf(deployer.address)).to.be.lte(
				wantDeployerBal
			);
			expect(await want.balanceOf(feeBb.address)).to.equal(
				parseEther("0.01")
			);
			expect(await want.balanceOf(feeSt.address)).to.equal(
				parseEther("0.01")
			);
		});
	});

	describe("withdraw", () => {
		it("should require existing pool", async () => {
			// Assert
			await expect(
				contract.withdraw(999, parseEther("1"))
			).to.be.revertedWith("SpaceMaster: pool inexistent");
		});

		it("should require user amount", async () => {
			await expect(
				contract.withdraw(0, parseEther("1"))
			).to.be.revertedWith("SpaceMaster: user.amount is 0");
		});

		it("should withdraw", async () => {
			// Arrange
			const hyprDevWalletBal = await hypr.balanceOf(devWallet.address);
			const wantDeployerBal = await want.balanceOf(deployer.address);
			const wantMasterBal = await want.balanceOf(contract.address);

			// Act
			const result = contract.withdraw(1, parseEther("1"));

			// Assert
			await expect(result)
				.to.emit(contract, "Withdraw")
				.withArgs(deployer.address, 1, wantMasterBal);

			await result.then(wait);
			await contract.userInfo(1, deployer.address).then(userInfo => {
				expect(userInfo.amount).to.equal(constants.Zero);
				expect(userInfo.rewardDebt).to.equal(constants.Zero);
			});

			expect(await hypr.balanceOf(devWallet.address)).to.be.gte(
				hyprDevWalletBal
			);
			expect(await want.balanceOf(deployer.address)).to.equal(
				wantDeployerBal.add(wantMasterBal)
			);
			expect(await want.balanceOf(contract.address)).to.equal(
				constants.Zero
			);
		});
	});

	describe("emergencyWithdraw", () => {
		it("should require existing pool", async () => {
			// Assert
			await expect(contract.emergencyWithdraw(999)).to.be.revertedWith(
				"SpaceMaster: pool inexistent"
			);
		});

		it("should emergency withdraw", async () => {
			// Arrange
			const userAmount = await contract
				.userInfo(1, deployer.address)
				.then(userInfo => userInfo.amount);

			// Act
			const result = contract.emergencyWithdraw(1);

			// Assert
			await expect(result)
				.to.emit(contract, "EmergencyWithdraw")
				.withArgs(deployer.address, 1, userAmount);
			await result.then(wait);
			await contract.userInfo(1, deployer.address).then(userInfo => {
				expect(userInfo.amount).to.equal(constants.Zero);
				expect(userInfo.rewardDebt).to.equal(constants.Zero);
			});
		});
	});

	describe("getPendingHYPR", () => {
		it("should pending HYPR", async () => {
			expect(await contract.getPendingHYPR(1, deployer.address)).to.equal(
				constants.Zero
			);
		});
	});

	describe("getStakedWantTokens", () => {
		it("should require strategy to be comp", async () => {
			await expect(
				contract.getStakedWantTokens(1, deployer.address)
			).to.be.revertedWith("SpaceMaster: !isComp");
		});
	});

	describe("transferLiquidity", () => {
		it("should require owner", async () => {
			// Assert
			await expect(
				contract.connect(user).transferLiquidity(user.address)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});
	});

	describe("inCaseTokensGetStuck", () => {
		it("should require owner", async () => {
			// Assert
			await expect(
				contract
					.connect(user)
					.inCaseTokensGetStuck(constants.AddressZero, 0)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should require token address to not be HYPR", async () => {
			// Assert
			await expect(
				contract.inCaseTokensGetStuck(hypr.address, 0)
			).to.be.revertedWith("SpaceMaster: !safe");
		});
	});

	describe("updatePool", () => {
		it("should update pool", async () => {
			// Arrange
			const hyprDevWalletBal = await hypr.balanceOf(devWallet.address);
			const hyprMasterBal = await hypr.balanceOf(contract.address);
			const poolInfo = await contract
				.poolInfo(1)
				.then(poolInfo => [
					poolInfo.accHYPRPerShare,
					poolInfo.lastRewardBlock
				]);

			// Act
			await contract.updatePool(1);

			// Assert
			expect(await hypr.balanceOf(devWallet.address)).to.be.gte(
				hyprDevWalletBal
			);
			expect(await hypr.balanceOf(contract.address)).to.be.gte(
				hyprMasterBal
			);
			await contract.poolInfo(1).then(p => {
				expect(p.accHYPRPerShare).to.be.gte(poolInfo[0]);
				expect(p.lastRewardBlock).to.be.gte(poolInfo[1]);
			});
		});
	});
});
