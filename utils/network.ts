import axios, { AxiosResponse } from "axios";
import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import secrets from "../secrets.json";

export const getRemoteContract = <TContract = Contract>(
	address?: string,
	localAddress?: string
): Promise<(TContract & Contract) | null> =>
	new Promise<(TContract & Contract) | null>(resolve =>
		address
			? axios
					.get("https://api.bscscan.com/api?", {
						params: {
							apiKey: secrets.bscscan_api,
							module: "contract",
							action: "getabi",
							address: address
						}
					})
					.then((res: AxiosResponse<{ result: string }>) =>
						ethers
							.getContractAt(
								JSON.parse(res.data.result),
								localAddress ?? address
							)
							.then(contract =>
								resolve(contract as TContract & Contract)
							)
					)
			: resolve(null)
	);

export const wait = <
	TReceipt,
	TTransaction extends { wait: () => Promise<TReceipt> }
>(
	tx: TTransaction
): Promise<TReceipt> => tx.wait();
