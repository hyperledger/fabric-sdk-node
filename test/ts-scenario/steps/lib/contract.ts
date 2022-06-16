/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from '../constants';
import * as BaseUtils from './utility/baseUtils';
import {CommandResult, CommandRunner} from './utility/commandRunner';

import * as path from 'path';

const commandRunner: CommandRunner = CommandRunner.getInstance();

// CLI verbosity in commands
const VERBOSE_CLI: boolean = BaseUtils.getVerboseCLI();

/**
 * Use the CLI container to install chaincode on an organization peer
 * @param {string} ccType The type of chaincode being installed (golang | node | java)
 * @param {string} ccName The name of the chaincode being installed
 * @param {string} ccVersion The version of the chaincode being installed
 * @param {string} orgName The name of the organization to install on
 */
export async function cli_chaincode_install_for_org(ccType: string, ccName: string, ccVersion: string, orgName: string): Promise<void> {

	const persistName = `${ccName}@${ccVersion}`;

	try {
		// Use CLI container to install smart contract (no TLS options required)
		BaseUtils.logMsg(`Attempting to install smart contract ${persistName} for organization ${orgName} using the CLI`);

		const ccPath: string = path.join('/', 'opt', 'gopath', 'src', 'github.com', 'chaincode', ccType, ccName);
		const installCommand: string[] = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'chaincode', 'install',
			'-l', ccType,
			'-n', ccName,
			'-v', ccVersion,
			'-p', ccPath,
			'--connTimeout', Constants.CLI_TIMEOUT,
		];

		await commandRunner.runShellCommand(true, installCommand.join(' '), VERBOSE_CLI);
		await BaseUtils.sleep(Constants.INC_SHORT);
		BaseUtils.logMsg(`Smart contract ${persistName} has been installed for organization ${orgName} using the CLI`);
	} catch (err) {
		BaseUtils.logError(`Failed to install smart contract ${ccName} using the CLI`, err);
		return Promise.reject(err);
	}
}

/**
 * Use the CLI container to check if chaincode is installed on an organization peer
 * @param {string} ccName The name of the chaincode being checked
 * @param {string} ccVersion The version of the chaincode being checked
 * @param {string} orgName The name of the organization to checked
 */
export async function cli_is_chaincode_install_for_org(ccName: string, ccVersion: string, orgName: string): Promise<boolean> {

	const persistName = `${ccName}@${ccVersion}`;

	try {
		// Use CLI container check for installed smart contract (no TLS options required)
		BaseUtils.logMsg(`Attempting to check for install smart contract ${persistName} for organization ${orgName} using the CLI`);

		const command: string[] = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'chaincode', 'list',
			'--installed',
			'--connTimeout', Constants.CLI_TIMEOUT,
		];

		const results = await commandRunner.runShellCommand(true, command.join(' '), VERBOSE_CLI) ;
		const list = results.stdout;
		BaseUtils.logMsg(`\n CLI found ==>${list}<==`);

		let found = false;
		let not = 'not';
		if (list.includes(ccName)) {
			not = '';
			found = true;
		}
		BaseUtils.logMsg(`Smart contract ${persistName} has ${not} been installed for organization ${orgName} using the CLI`);

		return found;
	} catch (err) {
		BaseUtils.logError(`Failed to check if install smart contract ${ccName} using the CLI`, err);
		return Promise.reject(err);
	}
}

/**
 * Use the CLI container to check if chaincode is instantiated on an organization peer
 * @param {string} channelName The name of the channel being checked
 * @param {string} ccName The name of the chaincode being checked
 * @param {string} ccVersion The version of the chaincode being checked
 * @param {string} orgName The name of the organization to check
 */
export async function cli_is_chaincode_instantiated_for_org(channelName: string,
	ccName: string, ccVersion: string, orgName: string): Promise<boolean> {

	const persistName = `${ccName}@${ccVersion}`;

	try {
		// Use CLI container check for installed smart contract (no TLS options required)
		BaseUtils.logMsg(`Attempting to check for instantiated smart contract ${persistName} for organization ${orgName} using the CLI`);

		const command: string[] = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'chaincode', 'list',
			'--channelID', channelName,
			'--instantiated',
			'--connTimeout', Constants.CLI_TIMEOUT,
		];

		const results = await commandRunner.runShellCommand(true, command.join(' '), VERBOSE_CLI) ;
		const list = results.stdout;
		BaseUtils.logMsg(`\n CLI found ==>${list}<==`);

		let found = false;
		let not = 'not';
		if (list.includes(ccName)) {
			not = '';
			found = true;
		}
		BaseUtils.logMsg(`Smart contract ${persistName} has ${not} been instantiated for organization ${orgName} using the CLI`);

		return found;
	} catch (err) {
		BaseUtils.logError(`Failed to check if instantiated smart contract ${ccName} using the CLI`, err);
		return Promise.reject(err);
	}
}

/**
 * Use the CLI container to instantiate chaincode
 * @param {string} ccType The chaincode type (golang | node | java)
 * @param {string} ccName The name of the chaincode being instantiated
 * @param {string} ccVersion The version of the chaincode being instantiated
 * @param {string} initArgs Init args to pass to the chaincode on instantiation
 * @param {string} channelName The channel to instantiate chaincode on
 * @param {string} policy The policy to use when instantiating
 * @param {boolean} tls boolean tls
 */
export async function cli_chaincode_instantiate(ccType: string, ccName: string,
	ccVersion: string, initArgs: string, channelName: string, policy: string, tls: boolean): Promise<void> {
	try {
		// Use CLI container to instantiate smart contract
		const persistName = `${ccName}@${ccVersion}`;
		BaseUtils.logMsg(`Attempting to instantiate smart contract ${persistName} on channel ${channelName} with args ${initArgs} using default container ${Constants.DEFAULT_CLI_CONTAINER}`);

		let tlsOptions: string[];
		if (tls) {
			tlsOptions = ['--tls', 'true', '--cafile', Constants.CLI_ORDERER_CA_FILE];
		} else {
			tlsOptions = [];
		}

		let ccPolicy: string[];
		switch (policy) {
			case 'none':
				ccPolicy = [];
				break;
			case '1ofAny':
				ccPolicy = ['-P', Constants.ENDORSEMENT_POLICY_1OF_ANY];
				break;
			case '2ofAny':
				ccPolicy = ['-P', Constants.ENDORSEMENT_POLICY_2OF_ANY];
				break;
			default:
				// leave it blank and let fabric decide
				ccPolicy = [];
		}

		const ccArgs = `"{\\"Args\\": ${JSON.stringify(initArgs)}}"`;

		let instantiateCommand: string[];
		instantiateCommand = [
			'docker', 'exec', `${Constants.DEFAULT_CLI_CONTAINER}_cli`, 'peer', 'chaincode', 'instantiate',
			'-o', 'orderer.example.com:7050',
			'-l', ccType,
			'-C', channelName,
			'-n', ccName,
			'-v', ccVersion,
			'-c', ccArgs,
		];

		instantiateCommand = instantiateCommand.concat(ccPolicy);
		instantiateCommand = instantiateCommand.concat(tlsOptions);
		await commandRunner.runShellCommand(true, instantiateCommand.join(' '), VERBOSE_CLI);

		// Since using the CLI we should be sure that the chaincode has *actually* been instantiated before progressing from here
		const timeoutId: NodeJS.Timeout = setTimeout(() => {
			throw new Error(`instantiate smart contract ${ccName} on channel ${channelName} exceeded the default timeout ${Constants.INSTANTIATE_TIMEOUT}ms`);
		}, Constants.INSTANTIATE_TIMEOUT);
		let deployed = false;
		while (!deployed) {
			const response: string = await cli_chaincode_list_instantiated(channelName);
			if (response.includes(`Name: ${ccName}, Version: ${ccVersion}`)) {
				deployed = true;
			} else {
				BaseUtils.logMsg('Awaiting smart contract instantiation ...');
				await BaseUtils.sleep(Constants.INC_SHORT);
			}
		}
		clearTimeout(timeoutId);
		BaseUtils.logMsg(`Smart contract ${ccName} has been instantiated on channel ${channelName} using the CLI`);
	} catch (err) {
		BaseUtils.logError(`Failed to instantiate smart contract ${ccName} on channel ${channelName} using the CLI`, err);
		return Promise.reject(err);
	}
}

/**
 * Use the CLI container to list instantiated chaincode
 * @param {string} channelName the channel to query
 */
export async function cli_chaincode_list_instantiated(channelName: string): Promise<string> {
	const listInstantiatedCommand: string[] = [
		'docker', 'exec', `${Constants.DEFAULT_CLI_CONTAINER}_cli`, 'peer', 'chaincode', 'list',
		'-o', 'orderer.example.com:7050',
		'--instantiated',
		'-C', channelName,
	];

	const instantiated = await commandRunner.runShellCommand(true, listInstantiatedCommand.join(' '), VERBOSE_CLI) ;
	return instantiated.stdout;
}

/**
 * Use the CLI container to list lifecycle installed chaincode
 * @param {string} orgName the organization to use
 */
export async function cli_lifecycle_chaincode_query_installed(orgName: string): Promise<string> {
	const queryInstalledCommand: string[] = [
		'docker', 'exec', `${orgName}_cli`, 'peer', 'lifecycle', 'chaincode', 'queryinstalled',
	];

	const installed = await commandRunner.runShellCommand(true, queryInstalledCommand.join(' '), VERBOSE_CLI) ;
	return installed.stdout;
}

/**
 * Use the CLI container to retrieve a package id for lifecycle installed chaincode
 * @param {string} label the chaincode label name of interest
 * @param {string} orgName the organization to use
 */
export async function retrievePackageIdForLabelOnOrg(label: string, orgName: string): Promise<string> {
	const response: string = await cli_lifecycle_chaincode_query_installed(orgName);

	// Break into an array
	const responseArray: string[] = response.split('\n');

	for (const row of responseArray) {
		if (row.includes(`Label: ${label}`)) {
			// strip out the ID
			const segment: string = row.split(',')[0];
			return segment.substr(segment.lastIndexOf(' ') + 1) ;
		}
	}

	// if it is not found in the above, throw
	const msg = `Unable to find packageId for contract label ${label}`;
	BaseUtils.logMsg(msg);
	throw new Error(msg);
}

/**
 * Use the CLI container to lifecycle package chaincode
 * @param {string} ccType the type of chaincode being packaged (golang | node | java)
 * @param {string} ccName the name of the chaincode
 * @param {string} orgName the organization to use
 */
export async function cli_lifecycle_chaincode_package(ccType: string, ccName: string, orgName: string, label: string): Promise<void> {

	try {
		// Use CLI container to package smart contract (no TLS options required)
		BaseUtils.logMsg(`Attempting lifecyle package of smart contract ${ccName} with label ${label} for organization ${orgName} using the CLI`);

		const ccPath: string = path.join('/', 'opt', 'gopath', 'src', 'github.com', 'chaincode', ccType, ccName);
		const packageCommand: string[] = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'lifecycle', 'chaincode', 'package',
			`${ccName}.tar.gz`,
			'--lang', ccType,
			'--label', label,
			'--path', ccPath,
		];

		await commandRunner.runShellCommand(true, packageCommand.join(' '), VERBOSE_CLI);
		await BaseUtils.sleep(Constants.INC_SHORT);
		BaseUtils.logMsg(`Smart contract ${ccName} with label ${label} has been packaged for organization ${orgName} using the CLI`);
	} catch (err) {
		BaseUtils.logError(`Failed to package smart contract ${ccName} with label ${label} using the CLI`, err);
		return Promise.reject(err);
	}
}

/**
 * Use the CLI container to lifecycle install chaincode
 * @param {string} packageName the name of the package to install
 * @param {string} orgName the organization to use
 */
export async function cli_lifecycle_chaincode_install(packageName: string, orgName: string): Promise<void> {
	try {
		// Use CLI container to package smart contract (no TLS options required)
		BaseUtils.logMsg(`Attempting lifecycle install of smart contract package ${packageName} for organization ${orgName} using the CLI`);

		const installCommand: string[] = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'lifecycle', 'chaincode', 'install',
			`${packageName}.tar.gz`,
			'--connTimeout', Constants.CLI_TIMEOUT,
		];

		await commandRunner.runShellCommand(true, installCommand.join(' '), VERBOSE_CLI);
		await BaseUtils.sleep(Constants.INC_SHORT);
		BaseUtils.logMsg(`Smart contract package ${packageName} has been installed for organization ${orgName} using the CLI`);
	} catch (err) {
		BaseUtils.logError(`Failed to install smart contract package ${packageName} using the CLI`, err);
		return Promise.reject(err);
	}
}

/**
 * Use the CLI container to lifecycle approve installed chaincode
 * @param {string} ccReference the chaincode reference id
 * @param {string} ccVersion the version of the chaincode
 * @param {string} orgName the organization to use
 * @param {string} channelName the channel name
 * @param {string} packageId the package id of the smart contract
 * @param {string} sequence the sequence of the smart contract
 * @param {boolean} tls tls boolean
 */
export async function cli_lifecycle_chaincode_approve(
	ccReference: string,
	ccVersion: string,
	orgName: string,
	channelName: string,
	packageId: string,
	sequence: string,
	tls: boolean,
	ccType: string,
	ccName: string,
	init: boolean
): Promise<void> {
	try {
		// Use CLI container to package smart contract
		BaseUtils.logMsg(`Attempting lifecycle approve of smart contract with reference ${ccReference} for organization ${orgName} using the CLI`);
		const colPath: string = path.join('/', 'opt', 'gopath', 'src', 'github.com', 'chaincode', ccType, ccName, 'metadata/collections.json');

		const approveCommand: string[] = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'lifecycle', 'chaincode', 'approveformyorg',
			'--channelID', channelName,
			'--name', ccReference,
			'--version', ccVersion,
			'--package-id', packageId,
			'--sequence', sequence,
			'--waitForEvent',
			'--collections-config', colPath,
		];

		if (init) {
			approveCommand.push('--init-required');
		}
		if (tls) {
			approveCommand.push('--tls', 'true', '--cafile', Constants.CLI_ORDERER_CA_FILE);
		}

		await commandRunner.runShellCommand(true, approveCommand.join(' '), VERBOSE_CLI);
		await BaseUtils.sleep(Constants.INC_SHORT);
		BaseUtils.logMsg(`Smart contract with reference ${ccReference} has been approved for organization ${orgName} using the CLI`);
	} catch (err) {
		BaseUtils.logError(`Failed to approve smart contract with reference ${ccReference} using the CLI`, err);
		return Promise.reject(err);
	}
}

/**
 * Use the CLI container to lifecycle query committed chaincode
 * @param {string} ccName the chaincode name
 * @param {string} orgName the organization to use
 * @param {string} channelName the channel name
 * @param {boolean} tls tls boolean
 */
export async function cli_lifecycle_chaincode_query_commit(
	ccName: string,
	orgName: string,
	channelName: string,
	tls: boolean
): Promise<boolean> {
	try {
		// Use CLI container to query for a committed smart contract
		BaseUtils.logMsg(`Attempting lifecycle query for committed smart contract with name ${ccName} for organization ${orgName} using the CLI`);

		const command: string[] = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'lifecycle', 'chaincode', 'querycommitted',
			'--channelID', channelName,
			'--name', ccName,
			'--output', 'json'
		];

		if (tls) {
			command.push('--tls', 'true', '--cafile', Constants.CLI_ORDERER_CA_FILE);
		}

		// will throw an error if not committed
		await commandRunner.runShellCommand(true, command.join(' '), VERBOSE_CLI);
		// const results: any = await commandRunner.runShellCommand(true, command.join(' '), VERBOSE_CLI) as any;
		// const committed = results.stdout; // use this to see the JSON results

		BaseUtils.logMsg(`Smart contract with name ${ccName} is committed for organization ${orgName} using the CLI`);
		return Promise.resolve(true);
	} catch (err: unknown) {
		if ((err as CommandResult).stderr.includes('404')) {
			BaseUtils.logMsg(`Smart contract with name ${ccName} is not committed for organization ${orgName} using the CLI`);
			return Promise.resolve(false);
		}

		// only show error if not expected
		BaseUtils.logError(`Failed to query committed smart contract with name ${ccName} using the CLI`, err);
		return Promise.reject(err);
	}
}

/**
 * Use the CLI container to lifecycle commit chaincode
 * @param {string} ccReference the chaincode reference
 * @param {string} ccVersion the chaincode version
 * @param {string} orgName the organization to use
 * @param {string} channelName the channel name
 * @param {string} ccp a CommonConnectionProfile helper
 * @param {string} sequence the sequence of the process
 * @param {boolean} tls tls boolean
 */
export async function cli_lifecycle_chaincode_commit(
	ccReference: string,
	ccVersion: string,
	orgName: string,
	channelName: string,
	sequence: string,
	tls: boolean,
	ccType: string,
	ccName: string,
	init: boolean
): Promise<void> {
	try {
		// Use CLI container to commit smart contract
		BaseUtils.logMsg(`Attempting lifecycle commit of smart contract with reference ${ccReference} for organization ${orgName} using the CLI`);

		const colPath: string = path.join('/', 'opt', 'gopath', 'src', 'github.com', 'chaincode', ccType, ccName, 'metadata/collections.json');

		// --peerAddresses
		const peerAddresses = `${Constants.CLI_ORG1_PEER_ADDRESS} ${Constants.CLI_ORG2_PEER_ADDRESS}`;
		const commitCommand: string[] = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'lifecycle', 'chaincode', 'commit',
			'-o', 'orderer.example.com:7050',
			'--channelID', channelName,
			'--name', ccReference,
			'--version', ccVersion,
			'--sequence', sequence,
			'--peerAddresses', peerAddresses,
			'--waitForEvent',
			'--collections-config', colPath,
		];
		if (init) {
			commitCommand.push('--init-required');
		}
		if (tls) {
			const tlsCerts = `${Constants.CLI_ORG1_CA_FILE} ${Constants.CLI_ORG2_CA_FILE}`;
			commitCommand.push('--tlsRootCertFiles', tlsCerts, '--tls', 'true', '--cafile', Constants.CLI_ORDERER_CA_FILE);
		}

		await commandRunner.runShellCommand(true, commitCommand.join(' '), VERBOSE_CLI);
		await BaseUtils.sleep(Constants.INC_SHORT);
		BaseUtils.logMsg(`Smart contract with reference ${ccReference} has been committed for organization ${orgName} using the CLI`);
	} catch (err) {
		BaseUtils.logError(`Failed to commit smart contract with reference ${ccReference} using the CLI`, err);
		return Promise.reject(err);
	}
}
