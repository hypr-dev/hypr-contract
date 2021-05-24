import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { constants } from "ethers";
import { ethers } from "hardhat";
import { DURATION, NAME_MASTER, STRATEGIES } from "../constants";
import { getBlockNumber, wait } from "../utils/network";
import { parseEther } from "../utils/parser";
import {
	getBalance,
	revertToSnapShot,
	fixture,
	takeSnapshot,
	increase,
	mockFarmCommander
} from "./utils";

chai.use(chaiAsPromised);
chai.use(solidity);

describe(NAME_MASTER, () => {
	let snapshotId: string;

	before(async () => {
		snapshotId = await takeSnapshot();
	});

	describe("add", () => {
		it("should require owner", async () => {
			// Arrange
			const {
				SpaceMaster,
				FarmCommander,
				Accounts,
				Strategy,
				state
			} = await fixture();
			const { user } = Accounts;
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();

			// Assert
			await expect(
				SpaceMaster.connect(user).add(
					Strategy.address,
					FarmCommander.address,
					Strategy.weight,
					Strategy.harvestInterval,
					Strategy.fee ?? 0,
					false
				)
			).to.be.revertedWith("Ownable: caller is not the owner");
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint
			);
			expect(await SpaceMaster.poolLength()).to.equal(poolLength);
		});

		it("should require maximum deposit fee base point", async () => {
			// Arrange
			const {
				SpaceMaster,
				FarmCommander,
				Strategy,
				state
			} = await fixture();
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();

			// Assert
			await expect(
				SpaceMaster.add(
					Strategy.address,
					FarmCommander.address,
					Strategy.weight,
					Strategy.harvestInterval,
					1001,
					false
				)
			).to.be.revertedWith(
				"SpaceMaster: add: invalid deposit fee basis points"
			);
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint
			);
			expect(await SpaceMaster.poolLength()).to.equal(poolLength);
		});

		it("should require maximum harvest interval", async () => {
			// Arrange
			const {
				SpaceMaster,
				FarmCommander,
				Strategy,
				state
			} = await fixture();
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();

			// Assert
			await expect(
				SpaceMaster.add(
					Strategy.address,
					FarmCommander.address,
					Strategy.weight,
					DURATION.days(15),
					Strategy.fee ?? 0,
					false
				)
			).to.be.revertedWith("SpaceMaster: add: invalid harvest interval");
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint
			);
			expect(await SpaceMaster.poolLength()).to.equal(poolLength);
		});

		it("should add pool", async () => {
			// Arrange
			const {
				SpaceMaster,
				FarmCommander,
				Strategy,
				state
			} = await fixture("BNB-BUSD LP");
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();

			// Act
			await SpaceMaster.add(
				Strategy.address,
				FarmCommander.address,
				Strategy.weight,
				Strategy.harvestInterval,
				Strategy.fee ?? 0,
				false
			).then(wait);

			// Assert
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint.add(Strategy.weight)
			);
			expect(await SpaceMaster.poolLength()).to.equal(
				poolLength.add(constants.One)
			);
			await SpaceMaster.poolInfo(0).then(pool => {
				expect(pool.want).to.equal(Strategy.address);
				expect(pool.strategy).to.equal(FarmCommander.address);
				expect(pool.allocPoint).to.equal(Strategy.weight);
				expect(pool.accHYPRPerShare).to.equal(0);
				expect(pool.harvestInterval).to.equal(Strategy.harvestInterval);
				expect(pool.depositFeeBP).to.equal(Strategy.fee ?? 0);
			});
		});
	});

	describe("set", () => {
		it("should require owner", async () => {
			// Arrange
			const { SpaceMaster, Strategy, Accounts, state } = await fixture();
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();
			const { user } = Accounts;

			// Assert
			await expect(
				SpaceMaster.connect(user).set(
					0,
					Strategy.weight,
					Strategy.harvestInterval,
					Strategy.fee ?? 0,
					false
				)
			).to.be.revertedWith("Ownable: caller is not the owner");
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint
			);
			expect(await SpaceMaster.poolLength()).to.equal(poolLength);
		});

		it("should require existing pool", async () => {
			// Arrange
			const { SpaceMaster, Strategy, state } = await fixture();
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();

			// Assert
			await expect(
				SpaceMaster.set(
					99,
					Strategy.weight,
					Strategy.harvestInterval,
					Strategy.fee ?? 0,
					false
				)
			).to.be.revertedWith("SpaceMaster: pool inexistent");
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint
			);
			expect(await SpaceMaster.poolLength()).to.equal(poolLength);
		});

		it("should require maximum deposit fee base point", async () => {
			// Arrange
			const { SpaceMaster, Strategy, state } = await fixture();
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();

			// Assert
			await expect(
				SpaceMaster.set(
					0,
					STRATEGIES[1].weight,
					STRATEGIES[1].harvestInterval,
					1001,
					false
				)
			).to.be.revertedWith(
				"SpaceMaster: add: invalid deposit fee basis points"
			);
			await SpaceMaster.poolInfo(0).then(pool => {
				expect(pool.allocPoint).to.equal(Strategy.weight);
				expect(pool.harvestInterval).to.equal(Strategy.harvestInterval);
				expect(pool.depositFeeBP).to.equal(Strategy.fee ?? 0);
			});
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint
			);
			expect(await SpaceMaster.poolLength()).to.equal(poolLength);
		});

		it("should require maximum harvest interval", async () => {
			// Arrange
			const { SpaceMaster, Strategy, state } = await fixture();
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();

			// Assert
			await expect(
				SpaceMaster.set(
					0,
					STRATEGIES[1].weight,
					DURATION.days(15),
					STRATEGIES[1].fee ?? 0,
					false
				)
			).to.be.revertedWith("SpaceMaster: add: invalid harvest interval");
			await SpaceMaster.poolInfo(0).then(pool => {
				expect(pool.allocPoint).to.equal(Strategy.weight);
				expect(pool.harvestInterval).to.equal(Strategy.harvestInterval);
				expect(pool.depositFeeBP).to.equal(Strategy.fee ?? 0);
			});
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint
			);
			expect(await SpaceMaster.poolLength()).to.equal(poolLength);
		});

		it("should set pool", async () => {
			// Arrange
			const { SpaceMaster, Strategy, state } = await fixture(
				"BNB-BUSD LP"
			);
			const { totalAllocPoint, poolLength } = await state.SpaceMaster();

			// Act
			await SpaceMaster.set(
				0,
				STRATEGIES[1].weight,
				STRATEGIES[1].harvestInterval,
				STRATEGIES[1].fee ?? 0,
				false
			).then(wait);

			// Assert
			await SpaceMaster.poolInfo(0).then(pool => {
				expect(pool.allocPoint).to.equal(STRATEGIES[1].weight);
				expect(pool.harvestInterval).to.equal(
					STRATEGIES[1].harvestInterval
				);
				expect(pool.depositFeeBP).to.equal(STRATEGIES[1].fee ?? 0);
			});
			expect(await SpaceMaster.totalAllocPoint()).to.equal(
				totalAllocPoint.sub(Strategy.weight).add(STRATEGIES[1].weight)
			);
			expect(await SpaceMaster.poolLength()).to.equal(poolLength);
		});
	});

	describe("deposit", () => {
		it("should require existing pool", async () => {
			// Arrange
			const { SpaceMaster } = await fixture();

			// Assert
			await expect(
				SpaceMaster.deposit(99, parseEther("1"))
			).to.be.revertedWith("SpaceMaster: pool inexistent");
		});

		it("should perform basic deposit", async () => {
			// Arrange
			const {
				SpaceMaster,
				FarmCommander,
				Pair,
				Accounts,
				Strategy,
				state
			} = await fixture("BNB-BUSD LP");
			const { deployer } = Accounts;
			const [
				pairMasterBal,
				pairCmdrBal,
				pairUserBal,
				pairFarmBal
			] = await getBalance({
				[SpaceMaster.address]: Pair,
				[FarmCommander.address]: Pair,
				[deployer.address]: Pair,
				[process.env.ADRS_FARM ?? constants.AddressZero]: Pair
			});
			const { getPoolInfo } = await state.SpaceMaster();
			const { user } = await getPoolInfo(0);
			const amount = parseEther("1");

			await SpaceMaster.set(
				0,
				Strategy.weight,
				Strategy.harvestInterval,
				0,
				false
			).then(wait);

			// Act
			const result = SpaceMaster.deposit(0, amount);

			// Assert
			await expect(result)
				.to.emit(SpaceMaster, "Deposit")
				.withArgs(deployer.address, 0, amount);
			await result.then(async tx => {
				const { timestamp } = await tx
					.wait()
					.then(res => ethers.provider.getBlock(res.blockHash));

				return SpaceMaster.userInfo(0, deployer.address).then(
					userInfo =>
						SpaceMaster.poolInfo(0).then(pool => {
							expect(userInfo.amount).to.equal(
								user.amount.add(amount)
							);
							expect(userInfo.rewardDebt).to.equal(
								user.amount
									.add(amount)
									.mul(pool.accHYPRPerShare)
									.div(1e12)
							);
							expect(userInfo.nextHarvestUntil).to.equal(
								pool.harvestInterval.add(timestamp)
							);
						})
				);
			});
			expect(await getBalance(SpaceMaster.address, Pair)).to.equal(
				pairMasterBal
			);
			expect(await getBalance(FarmCommander.address, Pair)).to.equal(
				pairCmdrBal
			);
			expect(await getBalance(deployer.address, Pair)).to.equal(
				pairUserBal.sub(amount)
			);
			expect(
				await getBalance(
					process.env.ADRS_FARM ?? constants.AddressZero,
					Pair
				)
			).to.equal(pairFarmBal.add(amount));
		});

		it("should perform deposit and set locked up rewards and transfer fees", async () => {
			// Arrange
			const { SpaceMaster, Pair, Accounts, state } = await fixture(
				"BNB-BUSD LP"
			);
			const { deployer, masterFeeBb, masterFeeSt } = Accounts;
			const amount = parseEther("1");

			await SpaceMaster.deposit(0, amount).then(wait);

			const { calcFee, getPoolInfo } = await state.SpaceMaster();
			const { totalLockedUpRewards, user } = await getPoolInfo(0);
			const [pairFeeBbBal, pairFeeStBal] = await getBalance({
				[masterFeeBb.address]: Pair,
				[masterFeeSt.address]: Pair
			});
			const depositFee = calcFee(amount);

			// Act
			const result = SpaceMaster.deposit(0, amount);

			// Assert
			await expect(result)
				.to.emit(SpaceMaster, "RewardLockedUp")
				.withArgs(deployer.address, 0, user.pending);
			await result.then(wait);
			expect(await getBalance(masterFeeBb.address, Pair)).to.equal(
				pairFeeBbBal.add(depositFee.div(2))
			);
			expect(await getBalance(masterFeeSt.address, Pair)).to.equal(
				pairFeeStBal.add(depositFee.sub(depositFee.div(2)))
			);
			expect(await SpaceMaster.totalLockedUpRewards()).to.equal(
				totalLockedUpRewards.add(user.pending)
			);
			await SpaceMaster.userInfo(0, deployer.address).then(userInfo => {
				expect(userInfo.amount).to.equal(
					user.amount.add(amount.sub(depositFee))
				);
				expect(userInfo.rewardLockedUp).to.equal(
					user.rewardLockedUp.add(user.pending)
				);
			});
		});

		it("should perform deposit and harvest rewards", async () => {
			// Arrange
			const {
				HyperToken,
				SpaceMaster,
				Accounts,
				Strategy,
				state
			} = await fixture("BNB-BUSD LP");
			const { deployer } = Accounts;
			const amount = parseEther("1");

			await SpaceMaster.deposit(0, amount).then(wait);
			await increase(Strategy.harvestInterval.add(DURATION.hours(1)));

			const hyprUserBal = await getBalance(deployer.address, HyperToken);
			const {
				totalLockedUpRewards,
				getPoolInfo
			} = await state.SpaceMaster();
			const { pool, user } = await getPoolInfo(0);

			// Act
			const result = SpaceMaster.deposit(0, amount);

			// Assert
			await result.then(async tx => {
				const { timestamp } = await tx
					.wait()
					.then(res => ethers.provider.getBlock(res.blockHash));

				return SpaceMaster.userInfo(0, deployer.address).then(
					async user => {
						expect(
							await SpaceMaster.totalLockedUpRewards()
						).to.equal(
							totalLockedUpRewards.sub(user.rewardLockedUp)
						);
						expect(user.rewardLockedUp).to.equal(constants.Zero);
						expect(user.nextHarvestUntil).to.equal(
							pool.harvestInterval.add(timestamp)
						);
					}
				);
			});
			expect(await getBalance(deployer.address, HyperToken)).to.equal(
				hyprUserBal.add(user.pending.add(user.rewardLockedUp))
			);
		});
	});

	describe("withdraw", () => {
		it("should require existing pool", async () => {
			// Arrange
			const { SpaceMaster } = await fixture();

			// Assert
			await expect(
				SpaceMaster.withdraw(99, parseEther("1"))
			).to.be.revertedWith("SpaceMaster: pool inexistent");
		});

		it("should require user to have amount", async () => {
			// Arrange
			const { SpaceMaster } = await fixture();
			const amount = constants.Zero;

			// Assert
			await expect(SpaceMaster.withdraw(0, amount)).to.be.revertedWith(
				"SpaceMaster: user.amount is 0"
			);
		});

		it("should require total want locked to have amount", async () => {
			// Arrange
			const { SpaceMaster, Pair, Strategy, Accounts } = await fixture(
				"BNB-BUSD LP"
			);
			const { deployer } = Accounts;
			const FarmCommander = await mockFarmCommander(deployer, [
				{ name: "totalWantLocked", returns: [constants.Zero] },
				{ name: "deposit", returns: [parseEther("1")] },
				{ name: "withdraw", returns: [parseEther("1")] }
			]);
			const amount = parseEther("1");

			await SpaceMaster.add(
				Pair.address,
				FarmCommander.address,
				Strategy.weight,
				Strategy.harvestInterval,
				Strategy.fee ?? 0,
				false
			).then(wait);
			await SpaceMaster.deposit(1, amount);

			// Assert
			await expect(SpaceMaster.withdraw(1, amount)).to.be.revertedWith(
				"SpaceMaster: total is 0"
			);
		});

		it("should perform withdraw and harvest rewards", async () => {
			// Arrange
			const { HyperToken, SpaceMaster, Accounts, state } = await fixture(
				"BNB-BUSD LP"
			);
			const { deployer } = Accounts;
			const amount = parseEther("1");

			await SpaceMaster.deposit(0, amount).then(wait);
			await increase(DURATION.hours(13));

			const {
				totalLockedUpRewards,
				getPoolInfo
			} = await state.SpaceMaster();
			const { pool, user } = await getPoolInfo(0);
			const hyprUserBal = await getBalance(deployer.address, HyperToken);

			// Act
			const result = SpaceMaster.withdraw(0, amount);

			// Assert
			await result.then(async tx => {
				const { timestamp } = await tx
					.wait()
					.then(res => ethers.provider.getBlock(res.blockHash));

				return SpaceMaster.userInfo(0, deployer.address).then(
					async user => {
						expect(
							await SpaceMaster.totalLockedUpRewards()
						).to.equal(
							totalLockedUpRewards.sub(user.rewardLockedUp)
						);
						expect(user.rewardLockedUp).to.equal(constants.Zero);
						expect(user.nextHarvestUntil).to.equal(
							pool.harvestInterval.add(timestamp)
						);
					}
				);
			});
			expect(await getBalance(deployer.address, HyperToken)).to.equal(
				hyprUserBal.add(user.pending.add(user.rewardLockedUp))
			);
		});
	});

	describe("emergencyWithdraw", () => {
		it("should require existing pool", async () => {
			// Arrange
			const { SpaceMaster } = await fixture();

			// Assert
			await expect(SpaceMaster.emergencyWithdraw(99)).to.be.revertedWith(
				"SpaceMaster: pool inexistent"
			);
		});

		it("should perform emergency withdraw", async () => {
			// Arrange
			const { SpaceMaster, Pair, Accounts, state } = await fixture(
				"BNB-BUSD LP"
			);
			const { deployer } = Accounts;
			const amount = parseEther("1");

			await SpaceMaster.deposit(0, amount).then(wait);

			const { calcFee } = await state.SpaceMaster();
			const [pairUserBal, pairFarmBal] = await getBalance({
				[deployer.address]: Pair,
				[process.env.ADRS_FARM ?? constants.AddressZero]: Pair
			});

			// Act
			const result = SpaceMaster.emergencyWithdraw(0);

			// Assert
			await expect(result)
				.to.emit(SpaceMaster, "EmergencyWithdraw")
				.withArgs(deployer.address, 0, amount.sub(calcFee(amount)));
			await result.then(wait);
			await SpaceMaster.userInfo(0, deployer.address).then(user => {
				expect(user.amount).to.equal(constants.Zero);
				expect(user.rewardDebt).to.equal(constants.Zero);
				expect(user.rewardLockedUp).to.equal(constants.Zero);
				expect(user.nextHarvestUntil).to.equal(constants.Zero);
			});
			expect(await getBalance(deployer.address, Pair)).to.equal(
				pairUserBal.add(amount.sub(calcFee(amount)))
			);
			expect(
				await getBalance(
					process.env.ADRS_FARM ?? constants.AddressZero,
					Pair
				)
			).to.equal(pairFarmBal.sub(amount.sub(calcFee(amount))));
		});
	});

	describe("updatePool", () => {
		it("should exit if total want locked is zero", async () => {
			// Arrange
			const {
				HyperToken,
				SpaceMaster,
				Pair,
				Accounts,
				Strategy
			} = await fixture("BNB-BUSD LP");
			const { deployer } = Accounts;
			const FarmCommander = await mockFarmCommander(deployer, [
				{ name: "totalWantLocked", returns: [constants.Zero] },
				{ name: "deposit", returns: [parseEther("1")] },
				{ name: "withdraw", returns: [parseEther("1")] }
			]);

			await SpaceMaster.add(
				Pair.address,
				FarmCommander.address,
				Strategy.weight,
				Strategy.harvestInterval,
				Strategy.fee ?? 0,
				false
			).then(wait);

			const blockNumber = await getBlockNumber();
			const hyprMasterBal = await getBalance(
				SpaceMaster.address,
				HyperToken
			);

			// Act
			await SpaceMaster.updatePool(1).then(wait);

			// Assert
			expect(await getBalance(SpaceMaster.address, HyperToken)).to.equal(
				hyprMasterBal
			);
			expect(
				await SpaceMaster.poolInfo(1).then(pool => pool.lastRewardBlock)
			).to.be.gt(blockNumber);
		});

		it("should update pool", async () => {
			// Arrange
			const { HyperToken, SpaceMaster, Accounts, state } = await fixture(
				"BNB-BUSD LP"
			);
			const { devWallet } = Accounts;

			await SpaceMaster.deposit(0, parseEther("1")).then(wait);

			const blockNumber = await getBlockNumber();
			const {
				hyprDevReward,
				hyprReward,
				pool
			} = await state.SpaceMaster().then(s => s.getPoolInfo(0));
			const { totalWantLocked } = await state.FarmCommander();
			const [hyprDevWalletBal, hyprMasterBal] = await getBalance({
				[devWallet.address]: HyperToken,
				[SpaceMaster.address]: HyperToken
			});

			// Act
			await SpaceMaster.updatePool(0).then(wait);

			// Assert
			expect(await getBalance(devWallet.address, HyperToken)).to.equal(
				hyprDevWalletBal.add(hyprDevReward)
			);
			expect(await getBalance(SpaceMaster.address, HyperToken)).to.equal(
				hyprMasterBal.add(hyprReward)
			);
			await SpaceMaster.poolInfo(0).then(poolInfo => {
				expect(poolInfo.accHYPRPerShare).to.equal(
					pool.accHYPRPerShare.add(
						hyprReward.mul(1e12).div(totalWantLocked)
					)
				);
				expect(poolInfo.lastRewardBlock).to.be.gte(blockNumber);
			});
		});
	});

	describe("getPendingHYPR", () => {
		it("should return pending", async () => {
			// Arrange
			const { SpaceMaster, Accounts } = await fixture("BNB-BUSD LP");
			const { deployer } = Accounts;
			const amount = parseEther("1");

			await SpaceMaster.deposit(0, amount).then(wait);
			await increase(DURATION.days(1));

			expect(
				await SpaceMaster.getPendingHYPR(0, deployer.address)
			).to.be.gt(constants.Zero);
		});
	});

	describe("inCaseTokensGetStuck", () => {
		it("should require owner", async () => {
			// Arrange
			const { SpaceMaster, Accounts } = await fixture();
			const { user } = Accounts;

			// Assert
			await expect(
				SpaceMaster.connect(user).inCaseTokensGetStuck(
					constants.AddressZero,
					constants.Zero
				)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should revert if token is HYPR", async () => {
			// Arrange
			const { HyperToken, SpaceMaster } = await fixture();

			// Assert
			await expect(
				SpaceMaster.inCaseTokensGetStuck(
					HyperToken.address,
					constants.Zero
				)
			).to.be.revertedWith("SpaceMaster: !safe");
		});
	});

	describe("setDevWalletAddress", () => {
		it("should require from current dev wallet address", async () => {
			// Arrange
			const { SpaceMaster, Accounts } = await fixture();
			const { devWallet, user } = Accounts;

			// Assert
			await expect(
				SpaceMaster.connect(user).setDevWalletAddress(user.address)
			).to.be.revertedWith("SpaceMaster: dev: wut?");
			expect(await SpaceMaster.devWalletAdrs()).to.equal(
				devWallet.address
			);
		});

		it("should set dev wallet address", async () => {
			// Arrange
			const { SpaceMaster, Accounts } = await fixture();
			const { devWallet, user } = Accounts;

			// Act
			const result = SpaceMaster.connect(devWallet).setDevWalletAddress(
				user.address
			);

			// Assert
			await expect(result)
				.to.emit(SpaceMaster, "SetDevWalletAddress")
				.withArgs(devWallet.address, user.address);
			await result.then(wait);
			expect(await SpaceMaster.devWalletAdrs()).to.equal(user.address);
		});
	});

	describe("setFeeBbAddress", () => {
		it("should require from current fee buybback address", async () => {
			// Arrange
			const { SpaceMaster, Accounts } = await fixture();
			const { masterFeeBb, user } = Accounts;

			// Assert
			await expect(
				SpaceMaster.connect(user).setFeeBbAddress(user.address)
			).to.be.revertedWith("SpaceMaster: setFeeBbAddress: FORBIDDEN");
			expect(await SpaceMaster.feeBbAdrs()).to.equal(masterFeeBb.address);
		});

		it("should set fee buyback address", async () => {
			// Arrange
			const { SpaceMaster, Accounts } = await fixture();
			const { masterFeeBb, user } = Accounts;

			// Act
			const result = SpaceMaster.connect(masterFeeBb).setFeeBbAddress(
				user.address
			);

			// Assert
			await expect(result)
				.to.emit(SpaceMaster, "SetFeeBbAddress")
				.withArgs(masterFeeBb.address, user.address);
			await result.then(wait);
			expect(await SpaceMaster.feeBbAdrs()).to.equal(user.address);
		});
	});

	describe("setFeeStAddress", () => {
		it("should require from current fee stake address", async () => {
			// Arrange
			const { SpaceMaster, Accounts } = await fixture();
			const { masterFeeSt, user } = Accounts;

			// Assert
			await expect(
				SpaceMaster.connect(user).setFeeStAddress(user.address)
			).to.be.revertedWith("SpaceMaster: setFeeStAddress: FORBIDDEN");
			expect(await SpaceMaster.feeStAdrs()).to.equal(masterFeeSt.address);
		});

		it("should set fee stake address", async () => {
			// Arrange
			const { SpaceMaster, Accounts } = await fixture();
			const { masterFeeSt, user } = Accounts;

			// Act
			const result = SpaceMaster.connect(masterFeeSt).setFeeStAddress(
				user.address
			);

			// Assert
			await expect(result)
				.to.emit(SpaceMaster, "SetFeeStAddress")
				.withArgs(masterFeeSt.address, user.address);
			await result.then(wait);
			expect(await SpaceMaster.feeStAdrs()).to.equal(user.address);
		});
	});

	after(async () => {
		await revertToSnapShot(snapshotId);
	});
});
