import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { constants } from "ethers";
import { NAME_TOKEN } from "../constants";
import { wait } from "../utils/network";
import { parseEther } from "../utils/parser";
import { revertToSnapShot, fixture, takeSnapshot, getBalance } from "./utils";

chai.use(chaiAsPromised);
chai.use(solidity);

describe(NAME_TOKEN, () => {
	let snapshotId: string;

	before(async () => {
		snapshotId = await takeSnapshot();
	});

	describe("mint", () => {
		it("should require owner", async () => {
			// Arrange
			const { HyperToken, Accounts } = await fixture();
			const { user } = Accounts;

			// Assert
			await expect(
				HyperToken["mint(address,uint256)"](
					user.address,
					parseEther("10")
				)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should mint", async () => {
			// Arrange
			const { HyperToken, Accounts, state } = await fixture();
			const { master, user } = Accounts;
			const { totalSupply } = await state.HyperToken();
			const amount = parseEther("10");

			// Act
			const result = HyperToken.connect(master)["mint(address,uint256)"](
				user.address,
				amount
			);

			// Assert
			await expect(result)
				.to.emit(HyperToken, "Transfer")
				.withArgs(constants.AddressZero, user.address, amount);
			await result.then(wait);
			expect(await getBalance(user.address, HyperToken)).to.equal(amount);
			expect(await HyperToken.totalSupply()).to.equal(
				parseEther("10").add(totalSupply)
			);
		});
	});

	describe("transfer", () => {
		it("should require valid transfer", async () => {
			// Arrange
			const { HyperToken, Accounts } = await fixture();
			const { master, user1, user2 } = Accounts;

			await HyperToken.connect(master)
				["mint(address,uint256)"](user1.address, parseEther("10"))
				.then(wait);

			// Assert
			await expect(
				HyperToken.connect(user1).transfer(
					user2.address,
					parseEther("15")
				)
			).to.be.revertedWith("BEP20: transfer amount exceeds balance");
		});

		it("should transfer", async () => {
			// Arrange
			const { HyperToken, Accounts, state } = await fixture();
			const { master, user1, user2 } = Accounts;
			const { totalSupply } = await state.HyperToken();

			await HyperToken.connect(master)
				["mint(address,uint256)"](user1.address, parseEther("10"))
				.then(wait);
			await HyperToken.connect(master)
				["mint(address,uint256)"](user2.address, parseEther("10"))
				.then(wait);

			// Act
			const result = HyperToken.connect(user1).transfer(
				user2.address,
				parseEther("5")
			);

			// Assert
			await expect(result)
				.to.emit(HyperToken, "Transfer")
				.withArgs(user1.address, user2.address, parseEther("5"));
			await result.then(wait);
			expect(await getBalance(user1.address, HyperToken)).to.equal(
				parseEther("5")
			);
			expect(await getBalance(user2.address, HyperToken)).to.equal(
				parseEther("15")
			);
			expect(await HyperToken.totalSupply()).to.equal(
				parseEther("20").add(totalSupply)
			);
		});
	});

	after(async () => {
		await revertToSnapShot(snapshotId);
	});
});
