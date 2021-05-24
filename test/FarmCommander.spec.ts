import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { NAME_FARM } from "../constants";
import { getBlockNumber, wait } from "../utils/network";
import {
	getBalance,
	revertToSnapShot,
	fixture,
	takeSnapshot,
	getBEP20Contract
} from "./utils";

chai.use(chaiAsPromised);
chai.use(solidity);

describe(NAME_FARM, () => {
	let snapshotId: string;

	before(async () => {
		snapshotId = await takeSnapshot();
	});

	describe("deposit", () => {
		it("should require owner", async () => {
			// Arrange
			const { FarmCommander, Pair, Accounts } = await fixture(
				"BNB-BUSD LP"
			);
			const { master } = Accounts;
			const pairMasterBal = await getBalance(master.address, Pair);

			// Assert
			await expect(
				FarmCommander.deposit(parseEther("1"))
			).to.be.revertedWith("Ownable: caller is not the owner");
			expect(await getBalance(master.address, Pair)).to.equal(
				pairMasterBal
			);
		});

		it("should require unpaused", async () => {
			// Arrange
			const { FarmCommander, Pair, Accounts } = await fixture(
				"BNB-BUSD LP"
			);
			const { strategyGov, master } = Accounts;
			const pairMasterBal = await getBalance(master.address, Pair);

			await FarmCommander.connect(strategyGov)
				.pause()
				.then(wait);

			// Assert
			await expect(
				FarmCommander.connect(master).deposit(parseEther("1"))
			).to.be.revertedWith("Pausable: paused");
			expect(await getBalance(master.address, Pair)).to.equal(
				pairMasterBal
			);

			await FarmCommander.connect(strategyGov)
				.unpause()
				.then(wait);
		});

		it("should deposit and farm when farm commander is HYPR comp", async () => {
			// Arrange
			const { FarmCommander, Pair, Accounts, state } = await fixture(
				"BNB-BUSD LP"
			);
			const { master } = Accounts;
			const amount = parseEther("1");

			await Pair.connect(master)
				.approve(FarmCommander.address, constants.MaxUint256)
				.then(wait);
			await Pair.transfer(master.address, amount).then(wait);

			const { totalWantLocked } = await state.FarmCommander();
			const [pairMasterBal, pairFarmBal] = await getBalance({
				[master.address]: Pair,
				[process.env.ADRS_FARM ?? constants.AddressZero]: Pair
			});

			// Act
			await FarmCommander.connect(master)
				.deposit(amount)
				.then(wait);

			// Assert
			expect(await getBalance(master.address, Pair)).to.equal(
				pairMasterBal.sub(amount)
			);
			expect(await getBalance(FarmCommander.address, Pair)).to.equal(
				constants.Zero
			);
			expect(
				await getBalance(
					process.env.ADRS_FARM ?? constants.AddressZero,
					Pair
				)
			).to.equal(pairFarmBal.add(amount));
			expect(await FarmCommander.totalWantLocked()).to.equal(
				totalWantLocked.add(amount)
			);
		});
	});

	describe("withdraw", () => {
		it("should require owner", async () => {
			// Arrange
			const { FarmCommander, Pair, Accounts } = await fixture(
				"BNB-BUSD LP"
			);
			const { master } = Accounts;
			const pairMasterBal = await getBalance(master.address, Pair);

			// Assert
			await expect(
				FarmCommander.withdraw(parseEther("1"))
			).to.be.revertedWith("Ownable: caller is not the owner");
			expect(await getBalance(master.address, Pair)).to.equal(
				pairMasterBal
			);
		});

		it("should require amount above zero", async () => {
			// Arrange
			const { FarmCommander, Pair, Accounts } = await fixture(
				"BNB-BUSD LP"
			);
			const { master } = Accounts;
			const pairMasterBal = await getBalance(master.address, Pair);

			// Assert
			await expect(
				FarmCommander.connect(master).withdraw(constants.Zero)
			).to.be.revertedWith("FarmCommander: amount <= 0");
			expect(await getBalance(master.address, Pair)).to.equal(
				pairMasterBal
			);
		});

		it("should withdraw", async () => {
			// Arrange
			const { FarmCommander, Pair, Accounts, state } = await fixture(
				"BNB-BUSD LP"
			);
			const { master } = Accounts;
			const amount = parseEther("1");

			await Pair.connect(master)
				.approve(FarmCommander.address, constants.MaxUint256)
				.then(wait);
			await Pair.transfer(master.address, amount).then(wait);
			await FarmCommander.connect(master)
				.deposit(amount)
				.then(wait);

			const { totalWantLocked } = await state.FarmCommander();
			const [pairMasterBal, pairFarmBal] = await getBalance({
				[master.address]: Pair,
				[process.env.ADRS_FARM ?? constants.AddressZero]: Pair
			});

			// Act
			await FarmCommander.connect(master)
				.withdraw(amount)
				.then(wait);

			// Assert
			expect(await getBalance(master.address, Pair)).to.equal(
				pairMasterBal.add(amount)
			);
			expect(await getBalance(FarmCommander.address, Pair)).to.equal(
				constants.Zero
			);
			expect(
				await getBalance(
					process.env.ADRS_FARM ?? constants.AddressZero,
					Pair
				)
			).to.equal(pairFarmBal.sub(amount));
			expect(await FarmCommander.totalWantLocked()).to.equal(
				totalWantLocked.sub(amount)
			);
		});
	});

	describe("earn", () => {
		it("should require unpaused", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { strategyGov, master } = Accounts;
			const { lastEarnBlock } = await state.FarmCommander();

			await FarmCommander.connect(strategyGov)
				.pause()
				.then(wait);

			// Assert
			await expect(
				FarmCommander.connect(master).earn()
			).to.be.revertedWith("Pausable: paused");
			expect(await FarmCommander.lastEarnBlock()).to.equal(lastEarnBlock);

			await FarmCommander.connect(strategyGov)
				.unpause()
				.then(wait);
		});

		it("should require to be HYPR comp", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { master } = Accounts;
			const { lastEarnBlock } = await state.FarmCommander();

			// Assert
			await expect(
				FarmCommander.connect(master).earn()
			).to.be.revertedWith("FarmCommander: must be HYPR compound");
			expect(await FarmCommander.lastEarnBlock()).to.equal(lastEarnBlock);
		});

		it("should require gov when only gov", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture(
				"BNB-BUSD LP"
			);
			const { strategyGov, master } = Accounts;
			const { lastEarnBlock } = await state.FarmCommander();

			await FarmCommander.connect(strategyGov)
				.setOnlyGov(true)
				.then(wait);

			// Assert
			await expect(
				FarmCommander.connect(master).earn()
			).to.be.revertedWith("FarmCommander: not authorised");
			expect(await FarmCommander.lastEarnBlock()).to.equal(lastEarnBlock);
		});

		it("should earn", async () => {
			// Arrange
			const {
				HyperToken,
				FarmCommander,
				Pair,
				Accounts,
				state
			} = await fixture("BNB-BUSD LP");
			const { strategyGov, strategyFee, master } = Accounts;
			const Earned = await getBEP20Contract(process.env.ADRS_CAKE);

			if (!Earned) throw new Error("Earned not found");

			await FarmCommander.connect(strategyGov)
				.setOnlyGov(false)
				.then(wait);
			await Pair.connect(master)
				.approve(FarmCommander.address, constants.MaxUint256)
				.then(wait);
			await Pair.transfer(master.address, parseEther("1")).then(wait);
			await FarmCommander.connect(master)
				.deposit(parseEther("1"))
				.then(wait);
			await FarmCommander.connect(master)
				.withdraw(parseEther("1"))
				.then(wait);

			const {
				buyBackAdrs,
				totalLpEarned,
				calcFee
			} = await state.FarmCommander();
			const [
				hyprBuyBackBal,
				earnedCmdrBal,
				earnedFeeBal
			] = await getBalance({
				[buyBackAdrs]: HyperToken,
				[FarmCommander.address]: Earned,
				[strategyFee.address]: Earned
			});
			const depositFee = calcFee(earnedCmdrBal);

			// Act
			await FarmCommander.connect(master)
				.earn()
				.then(wait);

			// Assert
			expect(await getBalance(strategyFee.address, Earned)).to.equal(
				earnedFeeBal.add(depositFee)
			);
			expect(await getBalance(buyBackAdrs, HyperToken)).to.be.gt(
				hyprBuyBackBal
			);
			expect(await FarmCommander.totalLpEarned()).to.be.gt(totalLpEarned);
			expect(await FarmCommander.lastEarnBlock()).to.equal(
				await getBlockNumber()
			);
		});
	});

	describe("setWbnbAddress", () => {
		it("should require from gov address", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { user } = Accounts;
			const { wbnbAdrs } = await state.FarmCommander();

			// Assert
			await expect(
				FarmCommander.setWbnbAddress(user.address)
			).to.be.revertedWith("StrategyCaptain: not authorised");
			expect(await FarmCommander.wbnbAdrs()).to.equal(wbnbAdrs);
		});

		it("should set WBNB address", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov, user } = Accounts;

			// Act
			const result = FarmCommander.connect(strategyGov).setWbnbAddress(
				user.address
			);

			// Assert
			await expect(result)
				.to.emit(FarmCommander, "SetWbnbAddress")
				.withArgs(user.address);
			await result.then(wait);
			expect(await FarmCommander.wbnbAdrs()).to.equal(user.address);
			expect(await FarmCommander.earnedToWbnbPath(1)).to.equal(
				user.address
			);
			expect(await FarmCommander.wbnbToHyprPath(0)).to.equal(
				user.address
			);
		});
	});

	after(async () => {
		await revertToSnapShot(snapshotId);
	});
});
