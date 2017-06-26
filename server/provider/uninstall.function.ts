import {
	loadSystemjsConfigFileMultiParts,
	ModuleFileMapping,
	SystemjsConfigFile,
} from "@gongt/ts-stl-server/express/render/jspm";
import {saveSystemjsConfigFileMultiParts} from "@gongt/ts-stl-server/express/render/jspm.write";
import {getBundleFileName, getBundleLocation, getBundleTempLocation, getJspmConfigFile} from "../library/files";
import {generateJspmConfig} from "../route/jspm.config";
import {removeFile, splitName, TransitionHandler} from "./socket-handler";

export function findFullFormat(configs: SystemjsConfigFile[], packageBase: string) {
	let ret: string;
	configs.some((config) => {
		if (config.map &&
		    config.map[packageBase] &&
		    (typeof config.map[packageBase] === 'string')
		) {
			ret = <string>config.map[packageBase];
			return true;
		}
		if (config.browserConfig.map &&
		    config.browserConfig.map[packageBase] &&
		    (typeof config.browserConfig.map[packageBase] === 'string')
		) {
			ret = <string>config.browserConfig.map[packageBase];
			return true;
		}
	});
	return ret;
}

function removeDepCache(spark: any, configs: SystemjsConfigFile[], packageBase: string) {
	const fullPackageName = findFullFormat(configs, packageBase);
	if (!fullPackageName) {
		return;
	}
	
	const remove = (depCache: ModuleFileMapping) => {
		for (let i in depCache) {
			if (!depCache.hasOwnProperty(i)) {
				continue;
			}
			if (i.indexOf(fullPackageName) === 0) {
				spark.write(`remove depCache: ${i}\n`);
				delete depCache[i];
			}
		}
	};
	configs.forEach((conf) => {
		if (conf.depCache) {
			remove(conf.depCache)
		}
		if (conf.browserConfig.depCache) {
			remove(conf.browserConfig.depCache)
		}
	});
}

function removeBundles(spark: any, configs: SystemjsConfigFile[], packageBase: string) {
	const bundleFile = getBundleFileName(packageBase);
	configs.forEach((config) => {
		if (config.bundles && config.bundles[bundleFile]) {
			spark.write(`remove bundle: ${bundleFile}\n`);
			delete config.bundles[bundleFile];
		}
		if (config.browserConfig && config.browserConfig.bundles && config.browserConfig.bundles[bundleFile]) {
			spark.write(`remove bundle: ${bundleFile}\n`);
			delete config.browserConfig.bundles[bundleFile];
		}
	});
}

export async function handleUninstall(handler: TransitionHandler, spark: any, fn: string, args: string[]) {
	let success: boolean;
	const bases = args.map((name) => {
		const [registry, base] = splitName(name);
		return base;
	});
	const configs = loadSystemjsConfigFileMultiParts(getJspmConfigFile());
	
	success = await handler.create(['uninstall', '-y', ...bases]);
	if (!success) {
		throw new Error('unable to uninstall.');
	}
	
	for (let base of bases) {
		removeBundles(spark, configs, base);
		
		await removeFile(spark, getBundleLocation(base));
		await removeFile(spark, getBundleTempLocation(base));
	}
	
	spark.write(`save jspm.config.js real content\n`);
	await saveSystemjsConfigFileMultiParts(getJspmConfigFile(), configs);
	
	spark.write(`update jspm.config.js cache content\n`);
	generateJspmConfig();
	
	await handler.create(['clean']);
}