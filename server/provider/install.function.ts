import {getBundleLocation, getBundleTempLocation} from "../library/files";
import {generateJspmConfig} from "../route/jspm.config";
import {createOpList} from "./cleanup.function";
import {removeFile, splitName, TransitionHandler} from "./socket-handler";

export async function jspmBundleCache(name: string, opList: string[], handler: TransitionHandler) {
	const [registry, base] = splitName(name);
	await handler.create([
		'bundle',
		'-y',
		// '--skip-rollup',
		'--minify',
		'--inject',
		// '--no-mangle',
		//'--format', 'cjs',
		'--source-map-contents',
		base,
		...opList,
		`${getBundleLocation(base)}`,
	]);
	await handler.create([
		'depcache',
		base,
	]);
}

export async function handleInstall(handler: TransitionHandler, spark: any, fn: string, args: string[]) {
	let success: boolean;
	success = await handler.create(['install', '-y', ...args]);
	if (!success) {
		return;
	}
	
	args = args.filter((n, i) => {
		return args.indexOf(n) === i;
	});
	
	const argsOpList = args.map((name, index) => {
		const extraOpList: string[] = createOpList(name)
			.concat(
				...args.filter((n, i) => i !== index).map((n) => ['-', n]),
			);
		return {
			name,
			opList: extraOpList,
		};
	});
	for (let {name, opList} of argsOpList) {
		await jspmBundleCache(name, opList, handler);
		
		const [registry, base] = splitName(name);
		
		await removeFile(spark, getBundleTempLocation(base));
	}
	
	spark.write(`update jspm.config.js cache content\n`);
	generateJspmConfig();
}