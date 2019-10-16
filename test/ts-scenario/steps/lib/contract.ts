/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from '../constants';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';
import { CommandRunner } from './utility/commandRunner';
import { StateStore } from './utility/stateStore';

import * as path from 'path';

const commandRunner = CommandRunner.getInstance();
const stateStore = StateStore.getInstance();

// Policies to use
const ENDORSEMENT_POLICY_1OF_ANY = '"OR (\'Org1MSP.member\',\'Org2MSP.member\')"';
const ENDORSEMENT_POLICY_2OF_ANY = '"AND (\'Org1MSP.member\',\'Org2MSP.member\')"';

// CLI verbosity in commands
const VERBOSE_CLI = JSON.parse(Constants.CLI_VERBOSITY);

export async function cli_chaincode_install_for_org(ccType: string, ccName: string, ccVersion: string, orgName: string) {

	const persistName = `${ccName}@${ccVersion}`;
	if (AdminUtils.isContractInstalled(persistName)) {
		// Do not reinstall
		BaseUtils.logMsg(`Smart contract ${persistName} has already been installed on the peers for organization ${orgName}`, undefined);
		return;
	} else {
		try {
			// Use CLI container to install smart contract (no TLS options required)
			BaseUtils.logMsg(`Attempting to install smart contract ${persistName} for organization ${orgName} using the CLI`, undefined);

			const ccPath = path.join('/', 'opt', 'gopath', 'src', 'github.com', 'chaincode', ccType, ccName);
			let installCommand: string[];
			installCommand = [
				'docker', 'exec', `${orgName}_cli`, 'peer', 'chaincode', 'install',
				'-l', ccType,
				'-n', ccName,
				'-v', ccVersion,
				'-p', ccPath,
			];

			await commandRunner.runShellCommand(true, installCommand.join(' '), VERBOSE_CLI);
			await BaseUtils.sleep(Constants.INC_SHORT);

			// Update state store with <name>@<version>
			AdminUtils.addToInstalledContracts(persistName);
			BaseUtils.logMsg(`Smart contract ${persistName} has been installed for organization ${orgName} using the CLI`, undefined);
		} catch (err) {
			BaseUtils.logError(`Failed to install smart contract ${ccName} using the CLI`, err);
			return Promise.reject(err);
		}
	}
}

export async function cli_chaincode_instantiate(ccType: string, ccName: string, ccVersion: string, initArgs: string, channelName: string, policy: string, tls: boolean) {
	try {
		// Use CLI container to instantiate smart contract
		const persistName = `${ccName}@${ccVersion}`;
		BaseUtils.logMsg(`Attempting to instantiate smart contract ${persistName} on channel ${channelName} with args ${initArgs} using default container ${Constants.DEFAULT_CLI_CONTAINER}`, undefined);

		if (AdminUtils.isInstantiatedOnChannel(persistName, channelName)) {
			// Do not run instantiate
			BaseUtils.logMsg(`Smart contract ${ccName} at version ${ccVersion} has already been instantiated on channel ${channelName}`, undefined);
			return;
		}

		let tlsOptions: string[];
		if (tls) {
			tlsOptions = ['--tls', 'true', '--cafile', '/etc/hyperledger/configtx/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem'];
		} else {
			tlsOptions = [];
		}

		let ccPolicy: string[];
		switch (policy) {
			case 'none':
				ccPolicy = [];
				break;
			case '1ofAny':
				ccPolicy = ['-P', ENDORSEMENT_POLICY_1OF_ANY];
				break;
			case '2ofAny':
				ccPolicy = ['-P', ENDORSEMENT_POLICY_2OF_ANY];
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
		const timeoutId = setTimeout(() => { throw new Error(`instantiate smart contract ${ccName} on channel ${channelName} exceeded the default timeout ${Constants.INSTANTIATE_TIMEOUT}ms`); }, Constants.INSTANTIATE_TIMEOUT);
		let deployed = false;
		while (!deployed) {
			const response = await cli_chaincode_list_instantiated(channelName) as string;
			if (response.includes(`Name: ${ccName}, Version: ${ccVersion}`)) {
				deployed = true;
			} else {
				BaseUtils.logMsg('Awaiting smart contract instantiation ...', undefined);
				await BaseUtils.sleep(Constants.INC_SHORT);
			}
		}
		clearTimeout(timeoutId);

		// Update state store with <name>@<version> for channels
		AdminUtils.addToInstantiatedContractsOnChannel(persistName, channelName);
		BaseUtils.logMsg(`Smart contract ${ccName} has been instantiated on channel ${channelName} using the CLI`, undefined);
	} catch (err) {
		BaseUtils.logError(`Failed to instantiate smart contract ${ccName} on channel ${channelName} using the CLI`, err);
		return Promise.reject(err);
	}
}

export async function cli_chaincode_list_instantiated(channelName: string) {
	const listInstantiatedCommand = [
		'docker', 'exec', `${Constants.DEFAULT_CLI_CONTAINER}_cli`, 'peer', 'chaincode', 'list',
		'-o', 'orderer.example.com:7050',
		'--instantiated',
		'-C', channelName,
	];

	const instantiated = await commandRunner.runShellCommand(true, listInstantiatedCommand.join(' '), VERBOSE_CLI) as any;
	return instantiated.stdout as string;
}
