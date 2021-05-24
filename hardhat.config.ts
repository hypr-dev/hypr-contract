import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-solhint";
import "@nomiclabs/hardhat-waffle";
import "hardhat-abi-exporter";
import "hardhat-spdx-license-identifier";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-gas-reporter";
import "hardhat-watcher";
import "solidity-coverage";
import "@typechain/hardhat";
import "@tenderly/hardhat-tenderly";

import { HardhatUserConfig } from "hardhat/types";
import { removeConsoleLog } from "hardhat-preprocessor";

import { mnemonic, bscscan_api } from "./secrets.json";
import { isLocalhost } from "./utils/process";

const accounts = {
	mnemonic: process.env.MNEMONIC || mnemonic
};

const config: HardhatUserConfig = {
	abiExporter: {
		path: "build/abi",
		clear: false,
		flat: true
	},
	defaultNetwork: "hardhat",
	networks: {
		localhost: {
			gasPrice: 0
		},
		hardhat: {
			forking: {
				enabled: process.env.FORKING === "true",
				// url: "https://bsc-dataseed.binance.org"
				url: "https://bsc-dataseed1.defibit.io"
				// url: "https://bsc-dataseed1.ninicoin.io"
			},
			accounts,
			allowUnlimitedContractSize: true,
			gasPrice: 0,
			chainId: 31337,
			tags: ["test", "local"]
		},
		bsc: {
			url: "https://bsc-dataseed.binance.org",
			accounts,
			chainId: 56
		},
		"bsc-testnet": {
			url: "https://data-seed-prebsc-2-s3.binance.org:8545",
			accounts,
			chainId: 97
		}
	},
	etherscan: {
		apiKey: bscscan_api
	},
	gasReporter: {
		coinmarketcap: process.env.COINMARKETCAP_API_KEY,
		currency: "USD",
		enabled: process.env.REPORT_GAS === "true",
		src: "./src/contracts",
		excludeContracts: ["./src/mocks/", "./src/libraries/"]
	},
	mocha: {
		timeout: 200000
	},
	namedAccounts: {
		deployer: {
			31337: 0
		}
	},
	paths: {
		artifacts: "build/artifacts",
		cache: "build/cache",
		deployments: "deployments",
		sources: "src",
		deploy: "deploy",
		imports: "imports",
		tests: "test"
	},
	preprocess: {
		eachLine: removeConsoleLog(
			hre =>
				hre.network.name !== "hardhat" &&
				hre.network.name !== "localhost"
		)
	},
	solidity: {
		compilers: [
			{
				version: "0.7.6",
				settings: {
					metadata: {
						// Not including the metadata hash
						// https://github.com/paulrberg/solidity-template/issues/31
						bytecodeHash: "none"
					},
					optimizer: {
						enabled: !isLocalhost(),
						runs: 800
					}
				}
			}
		]
	},
	spdxLicenseIdentifier: {
		overwrite: false,
		runOnCompile: true
	},
	typechain: {
		outDir: "build/types",
		target: "ethers-v5"
	},
	watcher: {
		compile: {
			tasks: ["compile"],
			files: ["./src"],
			verbose: true
		}
	},
	tenderly: {
		username: "hypr",
		project: "dev"
	}
};

export default config;
