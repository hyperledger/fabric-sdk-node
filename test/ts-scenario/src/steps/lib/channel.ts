/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from '../constants';
import * as AdminUtils from './utility/adminUtils';
import * as BaseUtils from './utility/baseUtils';
import {CommandRunner} from './utility/commandRunner';
import * as util from 'util';

const commandRunner: CommandRunner = CommandRunner.getInstance();

// CLI verbosity in commands
const VERBOSE_CLI: boolean = BaseUtils.getVerboseCLI();
/**
 * Create a channel
 * @param {string} channelName the channel to create
 * @param {Boolean} tls Boolean true if tls network; false if not *
 * @async
 */
export async function cli_channel_create(channelName: string, tls: boolean): Promise<void> {
	try {
		// Use CLI container to create a channel
		BaseUtils.logMsg(`Attempting to create channel ${channelName} of type ${tls ? 'tls' : 'non-tls'}`);

		let tlsOptions: string[];
		if (tls) {
			tlsOptions = ['--tls', 'true', '--cafile', '/etc/hyperledger/configtx/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem'];
		} else {
			tlsOptions = [];
		}

		let createChannelCommand: string[];
		createChannelCommand = [
			'docker', 'exec', `${Constants.DEFAULT_CLI_CONTAINER}_cli`, 'peer', 'channel', 'create',
			'-o', 'orderer.example.com:7050',
			'-c', channelName,
			'-f', `/etc/hyperledger/configtx/channel-config/${channelName}.tx`,
			'--outputBlock', `/etc/hyperledger/configtx/channel-config/${channelName}.block`,
		];

		createChannelCommand = createChannelCommand.concat(tlsOptions);
		await commandRunner.runShellCommand(true, createChannelCommand.join(' '), VERBOSE_CLI);
		await BaseUtils.sleep(Constants.INC_SHORT);

		BaseUtils.logMsg(`Channel ${channelName} has been created`);
		AdminUtils.addToCreatedChannels(channelName);
	} catch (err) {
		BaseUtils.logError(`Failed to create channel ${channelName}`, err);
		return Promise.reject(err);
	}
}

/**
 * Join the peers of the given organization to the given channel.
 * @param {String} orgName the name of the org to join to the named chanel
 * @param {String} channelName the name of the channel to join
 * @param {Boolean} tls true if a tls network; false if not
 * @async
 */
export async function cli_join_org_to_channel(orgName: string, channelName: string, tls: boolean): Promise<void> {

	try {
		// Use CLI container to join org to channel
		BaseUtils.logMsg(`Attempting to join organization ${orgName} to channel ${channelName} of type ${tls ? 'tls' : 'non-tls'}`);

		let tlsOptions: string[];
		if (tls) {
			tlsOptions = ['--tls', 'true', '--cafile', '/etc/hyperledger/configtx/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem'];
		} else {
			tlsOptions = [];
		}
		let joinChannelCommand: string[];
		joinChannelCommand = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'channel', 'join',
			'-b', `/etc/hyperledger/configtx/channel-config/${channelName}.block`,
		];

		joinChannelCommand = joinChannelCommand.concat(tlsOptions);
		await commandRunner.runShellCommand(true, joinChannelCommand.join(' '), VERBOSE_CLI);

		await BaseUtils.sleep(Constants.INC_SHORT);
		BaseUtils.logMsg(`Channel ${channelName} has been joined by organization ${orgName}`);
	} catch (err) {
		BaseUtils.logError('Join Channel failure: ', err);
		return Promise.reject(err);
	}
}

/**
 * Gets a list of channels the peer has joined.
 * @param {String} orgName the name of the org to join to the named chanel
 * @param {Boolean} tls true if a tls network; false if not
 * @async
 */
export async function cli_get_channels(orgName: string, tls: boolean): Promise<string> {

	try {
		// Use CLI container to join org to channel
		BaseUtils.logMsg(`Attempting to get list of channels for organization ${orgName} of type ${tls ? 'tls' : 'non-tls'}`);

		let tlsOptions: string[];
		if (tls) {
			tlsOptions = ['--tls', '--cafile', '/etc/hyperledger/configtx/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem'];
		} else {
			tlsOptions = [];
		}
		let command: string[];
		command = [
			'docker', 'exec', `${orgName}_cli`, 'peer', 'channel', 'list'
		];

		command = command.concat(tlsOptions);
		const channelNames = await commandRunner.runShellCommand(true, command.join(' '), VERBOSE_CLI) ;
		const results = channelNames.stdout;
		BaseUtils.logMsg(`Channel names ==>${results}<== have been joined by organization ${orgName}`);

		return results;
	} catch (err) {
		BaseUtils.logError('Get channel names failure: ', err);
		return Promise.reject(err);
	}
}

/**
 * Update a channel with a new config file
 * @param {String} channelName the name of the channel to update
 * @param {String} updateTx the name of the update tx file to use
 * @param {Boolean} tls true if a tls network; false if not
 */
export async function cli_channel_update(channelName: string, updateTx: string, tls: boolean): Promise<void> {

	try {

		if (AdminUtils.channelHasBeenUpdated(channelName, updateTx)) {
			BaseUtils.logMsg(`Channel ${channelName} has already been updated, skipping ...`);
		} else {
			// Use CLI container to update channel
			BaseUtils.logMsg(`Using default CLI container ${Constants.DEFAULT_CLI_CONTAINER} to update channel ${channelName} of type ${tls ? 'tls' : 'non-tls'} with updateTx ${updateTx}`);

			let tlsOptions: string[];
			if (tls) {
				tlsOptions = ['--tls', 'true', '--cafile', '/etc/hyperledger/configtx/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem'];
			} else {
				tlsOptions = [];
			}
			let updateChannelCommand: string[];
			updateChannelCommand = [
				'docker', 'exec', `${Constants.DEFAULT_CLI_CONTAINER}_cli`, 'peer', 'channel', 'update',
				'-o', 'orderer.example.com:7050',
				'-c', `${channelName}`,
				'-f', `/etc/hyperledger/configtx/channel-config/${updateTx}`,
			];

			updateChannelCommand = updateChannelCommand.concat(tlsOptions);
			await commandRunner.runShellCommand(true, updateChannelCommand.join(' '), VERBOSE_CLI);
			await BaseUtils.sleep(Constants.INC_SHORT);

			AdminUtils.addToUpdatedChannel(channelName, updateTx);
			BaseUtils.logMsg(`Channel ${channelName} has been updated`);
		}
	} catch (err) {
		BaseUtils.logError(`Failed to update channels: ${util.inspect(err)}`);
		return Promise.reject(err);
	}
}
