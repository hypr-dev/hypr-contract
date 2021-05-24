import fs from "fs";
import {
	DEFAULT_FILENAME_PAIRS,
	DEFAULT_FILENAME_FARMS,
	DEFAULT_FILENAME_COMPS
} from "../constants";

function main(): Promise<void> {
	if (
		!fs.existsSync(
			`./dist/${process.env.FILENAME_PAIRS ?? DEFAULT_FILENAME_PAIRS}`
		)
	)
		fs.writeFileSync(
			`./dist/${process.env.FILENAME_PAIRS ?? DEFAULT_FILENAME_PAIRS}`,
			"{}"
		);

	if (
		!fs.existsSync(
			`./dist/${process.env.FILENAME_FARMS ?? DEFAULT_FILENAME_FARMS}`
		)
	)
		fs.writeFileSync(
			`./dist/${process.env.FILENAME_FARMS ?? DEFAULT_FILENAME_FARMS}`,
			"{}"
		);

	if (
		!fs.existsSync(
			`./dist/${process.env.FILENAME_COMPS ?? DEFAULT_FILENAME_COMPS}`
		)
	)
		fs.writeFileSync(
			`./dist/${process.env.FILENAME_COMPS ?? DEFAULT_FILENAME_COMPS}`,
			"{}"
		);

	return Promise.resolve();
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
