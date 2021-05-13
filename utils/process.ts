export const isLocalhost = (): boolean =>
	!process.env.HARDHAT_NETWORK ||
	/hardhat|localhost/.test(process.env.HARDHAT_NETWORK);

export const isMainnet = (): boolean =>
	!!process.env.HARDHAT_NETWORK && process.env.HARDHAT_NETWORK === "bsc";
