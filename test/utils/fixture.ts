import { BigNumber, constants, Contract } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { deployments, ethers, network } from "hardhat";
import {
	BEP20,
	FarmCommander,
	HyperToken,
	IFactory,
	IPair,
	IRouter,
	SpaceMaster
} from "../../build/types";
import IFactoryABI from "../../build/abi/IFactory.json";
import IRouterABI from "../../build/abi/IRouter.json";
import IPairABI from "../../build/abi/IPair.json";
import BEP20ABI from "../../build/abi/BEP20.json";
import {
	ETH_INITIAL_MINT,
	NAME_FARM,
	NAME_MASTER,
	NAME_TOKEN,
	STRATEGIES
} from "../../constants";
import { getBlockNumber, wait } from "../../utils/network";
import { getPairAddress } from "../../utils/parser";
import { owners } from "../constants";

export const getFactoryContract = (
	adrs?: string
): Promise<IFactory & Contract> =>
	ethers.getContractAt(IFactoryABI, adrs ?? constants.AddressZero) as Promise<
		IFactory & Contract
	>;
export const getRouterContract = (adrs?: string): Promise<IRouter & Contract> =>
	ethers.getContractAt(IRouterABI, adrs ?? constants.AddressZero) as Promise<
		IRouter & Contract
	>;

export const getPairContract = (adrs?: string): Promise<IPair & Contract> =>
	ethers.getContractAt(IPairABI, adrs ?? constants.AddressZero) as Promise<
		IPair & Contract
	>;

export const getBEP20Contract = (adrs?: string): Promise<BEP20 & Contract> =>
	ethers.getContractAt(BEP20ABI, adrs ?? constants.AddressZero) as Promise<
		BEP20 & Contract
	>;

export const fixture = deployments.createFixture(
	async ({ ethers }, symbol?: string) => {
		symbol = symbol ?? "HYPR-WBNB";

		const strategy = STRATEGIES.find(s => s.symbol === symbol);

		if (!strategy) throw new Error(`Strategy "${symbol}" not found`);

		const [
			deployer,
			devWallet,
			masterFeeBb,
			masterFeeSt,
			strategyGov,
			strategyFee,
			user,
			user1,
			user2
		] = await ethers.getSigners();

		const hypr = (await ethers
			.getContractFactory(NAME_TOKEN)
			.then(factory => factory.deploy())
			.then(contract => contract.deployed())) as HyperToken;
		const startBlock = await getBlockNumber();
		const factory = await getFactoryContract(process.env.ADRS_FACTORY);
		const router = await getRouterContract(process.env.ADRS_ROUTER);

		let pair: AsyncReturnType<typeof getPairContract>;

		const hyprWbnbAdrs = await factory
			.createPair(
				hypr.address,
				STRATEGIES.find(s => s.symbol === "HYPR-WBNB")?.address ?? ""
			)
			.then(tx => tx.wait())
			.then(getPairAddress);
		const master = await ethers
			.getContractFactory(NAME_MASTER)
			.then(factory =>
				factory.deploy(
					[
						hyprWbnbAdrs,
						hypr.address,
						devWallet.address,
						masterFeeBb.address,
						masterFeeSt.address
					],
					startBlock
				)
			)
			.then(contract => contract.deployed() as Promise<SpaceMaster>);
		const masterSigner = await network.provider
			.request({
				method: "hardhat_impersonateAccount",
				params: [master.address]
			})
			.then(() => ethers.getSigner(master.address));

		await hypr["mint(uint256)"](parseEther(ETH_INITIAL_MINT)).then(wait);
		await hypr.transferOwnership(master.address).then(wait);

		if (Object.keys(owners).includes(symbol)) {
			const ownerKey = symbol as keyof typeof owners;

			await network.provider.request({
				method: "hardhat_impersonateAccount",
				params: [owners[ownerKey]]
			});

			const pairOwner = ethers.provider.getSigner(owners[ownerKey]);

			pair = await getPairContract(strategy.address);

			await pair
				.connect(pairOwner)
				.transfer(
					deployer.address,
					await pair.balanceOf(owners[ownerKey])
				)
				.then(wait);
		} else if (symbol !== "HYPR-WBNB") {
			pair = await factory
				.createPair(hypr.address, strategy.address)
				.then(tx => tx.wait())
				.then(getPairAddress)
				.then(getPairContract);
		} else {
			pair = await getPairContract(hyprWbnbAdrs);
		}

		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [owners["WBNB"]]
		});

		const wbnbOwner = ethers.provider.getSigner(owners["WBNB"]);
		const wbnb = await getBEP20Contract(process.env.ADRS_WBNB);
		const wbnbBal = await wbnb.balanceOf(owners["WBNB"]);

		if (wbnbBal.gt(parseEther("1"))) {
			await wbnb
				.connect(wbnbOwner)
				.transfer(deployer.address, parseEther("1"))
				.then(wait);
			await wbnb
				.connect(wbnbOwner)
				.transfer(masterSigner.address, wbnbBal.sub(parseEther("1")))
				.then(wait);
			await hypr.approve(router.address, parseEther("1")).then(wait);
			await wbnb.approve(router.address, parseEther("1")).then(wait);
			await router
				.addLiquidity(
					hypr.address,
					wbnb.address,
					parseEther("1"),
					parseEther("1"),
					constants.Zero,
					constants.Zero,
					deployer.address,
					Math.floor(Date.now() / 1000) + 60 * 10
				)
				.then(wait);
		}

		const addresses = [
			hypr.address,
			pair.address,
			wbnb.address,
			master.address
		];

		if (strategy.isHYPRComp) {
			addresses.push(
				process.env.ADRS_FARM ?? constants.AddressZero,
				router.address,
				process.env.ADRS_CAKE ?? constants.AddressZero,
				strategyGov.address,
				strategyFee.address,
				hyprWbnbAdrs
			);
		} else {
			addresses.push(
				process.env.ADRS_CAKE ?? constants.AddressZero,
				strategyGov.address,
				strategyFee.address
			);
		}

		const farmCommander = await ethers
			.getContractFactory(NAME_FARM)
			.then(factory =>
				factory.deploy(
					strategy.pid ?? 0,
					addresses,
					strategy.isHYPRComp,
					strategy.isCAKEStaking
				)
			)
			.then(contract => contract.deployed() as Promise<FarmCommander>);

		await pair.approve(master.address, constants.MaxUint256).then(wait);
		await master
			.add(
				pair.address,
				farmCommander.address,
				strategy.weight,
				strategy.harvestInterval,
				strategy.fee ?? 0,
				false
			)
			.then(wait);

		return {
			Strategy: strategy,
			HyperToken: hypr,
			SpaceMaster: master,
			FarmCommander: farmCommander,
			Pair: pair,
			Addresses: {
				["HYPR-WBNB"]: hyprWbnbAdrs
			},
			Accounts: {
				deployer,
				devWallet,
				masterFeeBb,
				masterFeeSt,
				strategyGov,
				strategyFee,
				user,
				user1,
				user2,
				master: masterSigner
			},
			state: {
				HyperToken: async (): Promise<{ totalSupply: BigNumber }> => {
					const totalSupply = await hypr.totalSupply();

					return {
						totalSupply
					};
				},
				SpaceMaster: async (): Promise<{
					totalLockedUpRewards: BigNumber;
					totalAllocPoint: BigNumber;
					poolLength: BigNumber;
					calcFee: (amount: BigNumber) => BigNumber;
					getPoolInfo: (
						pid: number
					) => Promise<{
						hyprDevReward: BigNumber;
						hyprReward: BigNumber;
						totalLockedUpRewards: BigNumber;
						pool: {
							want: string;
							strategy: string;
							allocPoint: BigNumber;
							lastRewardBlock: BigNumber;
							accHYPRPerShare: BigNumber;
							harvestInterval: BigNumber;
							depositFeeBP: number;
						};
						user: {
							amount: BigNumber;
							rewardDebt: BigNumber;
							rewardLockedUp: BigNumber;
							nextHarvestUntil: BigNumber;
							pending: BigNumber;
						};
					}>;
				}> => {
					const HYPR_DEV_PER_BLOCK = await master.HYPR_DEV_PER_BLOCK();
					const HYPR_PER_BLOCK = await master.HYPR_PER_BLOCK();
					const totalLockedUpRewards = await master.totalLockedUpRewards();
					const totalAllocPoint = await master.totalAllocPoint();
					const poolLength = await master.poolLength();

					return {
						totalLockedUpRewards,
						totalAllocPoint,
						poolLength,
						calcFee: amount =>
							amount.mul(strategy.fee ?? 0).div(10000),
						getPoolInfo: async pid => {
							const blockNumber = await getBlockNumber();
							const userInfo = await master.userInfo(
								pid,
								deployer.address
							);
							const poolInfo = await master.poolInfo(pid);
							const multiplier = await master.getMultiplier(
								poolInfo.lastRewardBlock,
								blockNumber.add(1)
							);
							const totalLockedUpRewards = await master.totalLockedUpRewards();
							const hyprDevReward = multiplier
								.mul(HYPR_DEV_PER_BLOCK)
								.mul(poolInfo.allocPoint)
								.div(totalAllocPoint);
							const hyprReward = multiplier
								.mul(HYPR_PER_BLOCK)
								.mul(poolInfo.allocPoint)
								.div(totalAllocPoint);
							const totalWantLocked = await farmCommander.totalWantLocked();

							return {
								blockNumber,
								hyprDevReward,
								hyprReward,
								totalLockedUpRewards,
								pool: poolInfo,
								user: {
									...userInfo,
									pending: !totalWantLocked.eq(constants.Zero)
										? userInfo.amount
												.mul(
													poolInfo.accHYPRPerShare.add(
														hyprReward
															.mul(1e12)
															.div(
																totalWantLocked
															)
													)
												)
												.div(1e12)
												.sub(userInfo.rewardDebt)
										: constants.Zero
								}
							};
						}
					};
				},
				FarmCommander: async (): Promise<{
					govAdrs: string;
					routerAdrs: string;
					wbnbAdrs: string;
					feeAdrs: string;
					buyBackAdrs: string;
					totalWantLocked: BigNumber;
					totalLpEarned: BigNumber;
					lastEarnBlock: BigNumber;
					// eslint-disable-next-line @typescript-eslint/naming-convention
					CONTROLLER_FEE_UL: BigNumber;
					controllerFee: BigNumber;
					onlyGov: boolean;
					calcFee: (fromAmt: BigNumber) => BigNumber;
				}> => {
					const govAdrs = await farmCommander.govAdrs();
					const routerAdrs = await farmCommander.routerAdrs();
					const wbnbAdrs = await farmCommander.wbnbAdrs();
					const feeAdrs = await farmCommander.feeAdrs();
					const buyBackAdrs = await farmCommander.buyBackAdrs();
					const CONTROLLER_FEE_MAX = await farmCommander.CONTROLLER_FEE_MAX();
					const CONTROLLER_FEE_UL = await farmCommander.CONTROLLER_FEE_UL();
					const controllerFee = await farmCommander.controllerFee();
					const totalWantLocked = await farmCommander.totalWantLocked();
					const totalLpEarned = await farmCommander.totalLpEarned();
					const lastEarnBlock = await farmCommander.lastEarnBlock();
					const onlyGov = await farmCommander.onlyGov();

					return {
						govAdrs,
						routerAdrs,
						wbnbAdrs,
						feeAdrs,
						buyBackAdrs,
						totalWantLocked,
						totalLpEarned,
						lastEarnBlock,
						// eslint-disable-next-line @typescript-eslint/naming-convention
						CONTROLLER_FEE_UL,
						controllerFee,
						onlyGov,
						calcFee: fromAmt =>
							fromAmt.mul(controllerFee).div(CONTROLLER_FEE_MAX)
					};
				}
			}
		};
	}
);
