import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { constants } from "ethers";
import { wait } from "../utils/network";
import { fixture, getBEP20Contract, getPairContract } from "./utils";

chai.use(chaiAsPromised);
chai.use(solidity);

describe("StrategyCaptain", () => {
	describe("pause", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander } = await fixture();

			// Assert
			await expect(FarmCommander.pause()).to.be.revertedWith(
				"StrategyCaptain: not authorised"
			);
		});

		it("should pause", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov } = Accounts;

			// Act
			await FarmCommander.connect(strategyGov)
				.pause()
				.then(wait);

			// Assert
			expect(await FarmCommander.paused()).to.be.true;
		});
	});

	describe("unpause", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander } = await fixture();

			// Assert
			await expect(FarmCommander.unpause()).to.be.revertedWith(
				"StrategyCaptain: not authorised"
			);
		});

		it("should unpause", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov } = Accounts;

			await FarmCommander.connect(strategyGov)
				.pause()
				.then(wait);

			// Act
			await FarmCommander.connect(strategyGov)
				.unpause()
				.then(wait);

			// Assert
			expect(await FarmCommander.paused()).to.be.false;
		});
	});

	describe("inCaseTokensGetStuck", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander } = await fixture();

			// Assert
			await expect(
				FarmCommander.inCaseTokensGetStuck(
					constants.AddressZero,
					constants.AddressZero,
					constants.Zero
				)
			).to.be.revertedWith("StrategyCaptain: not authorised");
		});

		it("should revert if token is earned", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov } = Accounts;
			const Earned = await getBEP20Contract(process.env.ADRS_CAKE);

			// Assert
			await expect(
				FarmCommander.connect(strategyGov).inCaseTokensGetStuck(
					Earned.address,
					constants.AddressZero,
					constants.Zero
				)
			).to.be.revertedWith("StrategyCaptain: !safe");
		});

		it("should revert if token is want", async () => {
			// Arrange
			const { FarmCommander, Addresses, Accounts } = await fixture();
			const { strategyGov } = Accounts;
			const HyprWbnb = await getPairContract(Addresses["HYPR-WBNB"]);

			// Assert
			await expect(
				FarmCommander.connect(strategyGov).inCaseTokensGetStuck(
					HyprWbnb.address,
					constants.AddressZero,
					constants.Zero
				)
			).to.be.revertedWith("StrategyCaptain: !safe");
		});
	});

	describe("setSettings", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander, state } = await fixture();
			const { controllerFee } = await state.FarmCommander();

			// Assert
			await expect(FarmCommander.setSettings(99)).to.be.revertedWith(
				"StrategyCaptain: not authorised"
			);
			expect(await FarmCommander.controllerFee()).to.equal(controllerFee);
		});

		it("should require maximum controller fee", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { strategyGov } = Accounts;
			const {
				controllerFee,
				CONTROLLER_FEE_UL
			} = await state.FarmCommander();

			// Assert
			await expect(
				FarmCommander.connect(strategyGov).setSettings(
					CONTROLLER_FEE_UL.add(1)
				)
			).to.be.revertedWith("StrategyCaptain: controller fee too high");
			expect(await FarmCommander.controllerFee()).to.equal(controllerFee);
		});

		it("should require maximum controller fee", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { strategyGov } = Accounts;
			const {
				controllerFee,
				CONTROLLER_FEE_UL
			} = await state.FarmCommander();

			// Assert
			await expect(
				FarmCommander.connect(strategyGov).setSettings(
					CONTROLLER_FEE_UL.add(1)
				)
			).to.be.revertedWith("StrategyCaptain: controller fee too high");
			expect(await FarmCommander.controllerFee()).to.equal(controllerFee);
		});

		it("should set settings", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov } = Accounts;
			const controllerFee = 10;

			// Act
			const result = FarmCommander.connect(strategyGov).setSettings(
				controllerFee
			);

			// Assert
			await expect(result)
				.to.emit(FarmCommander, "SetSettings")
				.withArgs(controllerFee);
			await result.then(wait);
			expect(await FarmCommander.controllerFee()).to.equal(controllerFee);
		});
	});

	describe("setGov", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { user } = Accounts;
			const { govAdrs } = await state.FarmCommander();

			// Assert
			await expect(FarmCommander.setGov(user.address)).to.be.revertedWith(
				"StrategyCaptain: not authorised"
			);
			expect(await FarmCommander.govAdrs()).to.equal(govAdrs);
		});

		it("should set gov", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov, user } = Accounts;

			// Act
			const result = FarmCommander.connect(strategyGov).setGov(
				user.address
			);

			// Assert
			await expect(result)
				.to.emit(FarmCommander, "SetGov")
				.withArgs(user.address);
			await result.then(wait);
			expect(await FarmCommander.govAdrs()).to.equal(user.address);
		});
	});

	describe("setOnlyGov", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander, state } = await fixture();
			const { onlyGov } = await state.FarmCommander();

			// Assert
			await expect(FarmCommander.setOnlyGov(!onlyGov)).to.be.revertedWith(
				"StrategyCaptain: not authorised"
			);
			expect(await FarmCommander.onlyGov()).to.equal(onlyGov);
		});

		it("should set only gov", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { strategyGov } = Accounts;
			const { onlyGov } = await state.FarmCommander();

			// Act
			const result = FarmCommander.connect(strategyGov).setOnlyGov(
				!onlyGov
			);

			// Assert
			await expect(result)
				.to.emit(FarmCommander, "SetOnlyGov")
				.withArgs(!onlyGov);
			await result.then(wait);
			expect(await FarmCommander.onlyGov()).to.equal(!onlyGov);
		});
	});

	describe("setRouterAddress", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { user } = Accounts;
			const { routerAdrs } = await state.FarmCommander();

			// Assert
			await expect(
				FarmCommander.setRouterAddress(user.address)
			).to.be.revertedWith("StrategyCaptain: not authorised");
			expect(await FarmCommander.routerAdrs()).to.equal(routerAdrs);
		});

		it("should set router address", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov, user } = Accounts;

			// Act
			const result = FarmCommander.connect(strategyGov).setRouterAddress(
				user.address
			);

			// Assert
			await expect(result)
				.to.emit(FarmCommander, "SetRouterAddress")
				.withArgs(user.address);
			await result.then(wait);
			expect(await FarmCommander.routerAdrs()).to.equal(user.address);
		});
	});

	describe("setWbnbAddress", () => {
		it("should require gov", async () => {
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
		});
	});

	describe("setFeeAddress", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { user } = Accounts;
			const { feeAdrs } = await state.FarmCommander();

			// Assert
			await expect(
				FarmCommander.setFeeAddress(user.address)
			).to.be.revertedWith("StrategyCaptain: not authorised");
			expect(await FarmCommander.feeAdrs()).to.equal(feeAdrs);
		});

		it("should set fee address", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov, user } = Accounts;

			// Act
			const result = FarmCommander.connect(strategyGov).setFeeAddress(
				user.address
			);

			// Assert
			await expect(result)
				.to.emit(FarmCommander, "SetFeeAddress")
				.withArgs(user.address);
			await result.then(wait);
			expect(await FarmCommander.feeAdrs()).to.equal(user.address);
		});
	});

	describe("setBuyBackAddress", () => {
		it("should require gov", async () => {
			// Arrange
			const { FarmCommander, Accounts, state } = await fixture();
			const { user } = Accounts;
			const { buyBackAdrs } = await state.FarmCommander();

			// Assert
			await expect(
				FarmCommander.setBuyBackAddress(user.address)
			).to.be.revertedWith("StrategyCaptain: not authorised");
			expect(await FarmCommander.buyBackAdrs()).to.equal(buyBackAdrs);
		});

		it("should set buy back address", async () => {
			// Arrange
			const { FarmCommander, Accounts } = await fixture();
			const { strategyGov, user } = Accounts;

			// Act
			const result = FarmCommander.connect(strategyGov).setBuyBackAddress(
				user.address
			);

			// Assert
			await expect(result)
				.to.emit(FarmCommander, "SetBuyBackAddress")
				.withArgs(user.address);
			await result.then(wait);
			expect(await FarmCommander.buyBackAdrs()).to.equal(user.address);
		});
	});
});
