import { parseEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { constants } from "ethers";
import { ethers } from "hardhat";
import { HyperToken } from "../build/types";
import { NAME_TOKEN } from "../constants";
import { wait } from "../utils/network";
import { chill } from "../utils/time";

chai.use(chaiAsPromised);
chai.use(solidity);

describe(NAME_TOKEN, () => {
	let user1: SignerWithAddress,
		user2: SignerWithAddress,
		contract: HyperToken;

	before(async () => {
		[, user1, user2] = await ethers.getSigners();
		contract = (await ethers
			.getContractFactory(NAME_TOKEN)
			.then(factory => factory.deploy())
			.then(contract => contract.deployed())) as HyperToken;
	});

	describe("mint", () => {
		it("should require owner", async () => {
			// Assert
			await expect(
				contract
					.connect(user1)
					["mint(address,uint256)"](user1.address, parseEther("10"))
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should mint", async () => {
			// Act
			const result = contract["mint(address,uint256)"](
				user1.address,
				parseEther("10")
			);

			// Assert
			await expect(result)
				.to.emit(contract, "Transfer")
				.withArgs(
					constants.AddressZero,
					user1.address,
					parseEther("10")
				);

			await result.then(wait);

			expect(await contract.balanceOf(user1.address)).to.equal(
				parseEther("10")
			);
			expect(await contract.totalSupply()).to.equal(parseEther("10"));
		});
	});

	describe("transfer", () => {
		it("should require valid transfer", async () => {
			// Assert
			await expect(
				contract
					.connect(user1)
					.transfer(user2.address, parseEther("15"))
			).to.be.revertedWith("BEP20: transfer amount exceeds balance");
		});

		it("should transfer", async () => {
			// Arrange
			await contract["mint(address,uint256)"](
				user2.address,
				parseEther("10")
			).then(wait);

			// Act
			const result = contract
				.connect(user1)
				.transfer(user2.address, parseEther("5"));

			// Assert
			await expect(result)
				.to.emit(contract, "Transfer")
				.withArgs(user1.address, user2.address, parseEther("5"));
			await result.then(wait).then(() => chill(1000));
			expect(await contract.balanceOf(user1.address)).to.equal(
				parseEther("5")
			);
			expect(await contract.balanceOf(user2.address)).to.equal(
				parseEther("15")
			);
			expect(await contract.totalSupply()).to.equal(parseEther("20"));
		});
	});
});
