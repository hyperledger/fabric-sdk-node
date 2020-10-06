/*
 Copyright 2019 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/

import fs = require('fs');
import { Utils, Client, ConnectOptions } from 'fabric-common';

const logger = Utils.getLogger('NetworkConfig');

/**
 * Configures a client object using a supplied connection profile JSON object.
 * @private
 */
export async function loadFromConfig(client: Client, config: any = {}): Promise<void> {
	const method = 'loadFromConfig';
	logger.debug('%s - start', method);

	// create peers
	if (config.peers) {
		for (const peerName in config.peers) {
			await buildPeer(client, peerName, config.peers[peerName], config);
		}
	}
	// create orderers
	if (config.orderers) {
		for (const ordererName in config.orderers) {
			await buildOrderer(client, ordererName, config.orderers[ordererName]);
		}
	}
	// build channels
	if (config.channels) {
		for (const channelName in config.channels) {
			await buildChannel(client, channelName, config.channels[channelName]);
		}
	}

	logger.debug('%s - end', method);
}

async function buildChannel(client: Client, channelName: string, channelConfig: any): Promise<void> {
	const method = 'buildChannel';
	logger.debug('%s - start - %s', method, channelName);

	// this will add the channel to the client instance
	const channel = client.getChannel(channelName);

	const peers = channelConfig.peers;
	if (peers) {
		const peerNames: string[] = Array.isArray(peers) ? peers : Object.keys(peers);
		for (const peerName of peerNames) {
			const peer = client.getEndorser(peerName);
			channel.addEndorser(peer);
			logger.debug('%s - added endorsing peer :: %s', method, peer.name);
		}
	} else {
		logger.debug('%s - no peers in config', method);
	}

	if (channelConfig.orderers) {
		// using 'of' as orderers is an array
		for (const ordererName of channelConfig.orderers as string[]) {
			const orderer = client.getCommitter(ordererName);
			channel.addCommitter(orderer);
			logger.debug('%s - added orderer :: %s', method, orderer.name);
		}
	} else {
		logger.debug('%s - no orderers in config', method);
	}

}

async function buildOrderer(client: Client, ordererName: string, ordererConfig: any): Promise<void> {
	const method = 'buildOrderer';
	logger.debug('%s - start - %s', method, ordererName);

	const mspid: string = ordererConfig.mspid;
	const options = await buildOptions(ordererConfig);
	const endpoint = client.newEndpoint(options);
	logger.debug('%s - about to connect to committer %s url:%s mspid:%s', method, ordererName, ordererConfig.url, mspid);
	// since the client saves the orderer, no need to save here
	const orderer = client.getCommitter(ordererName, mspid);
	try {
		await orderer.connect(endpoint);
		logger.debug('%s - connected to committer %s url:%s', method, ordererName, ordererConfig.url);
	} catch (error) {
		logger.info('%s - Unable to connect to the committer %s due to %s', method, ordererName, error);
	}
}

async function buildPeer(client: Client, peerName: string, peerConfig: any, config: any): Promise<void> {
	const method = 'buildPeer';
	logger.debug('%s - start - %s', method, peerName);

	const mspid = findPeerMspid(peerName, config);
	const options = await buildOptions(peerConfig);
	const endpoint = client.newEndpoint(options);
	logger.debug('%s - about to connect to endorser %s url:%s mspid:%s', method, peerName, peerConfig.url, mspid);
	// since this adds to the clients list, no need to save
	const peer = client.getEndorser(peerName, mspid);
	try {
		await peer.connect(endpoint);
		logger.debug('%s - connected to endorser %s url:%s', method, peerName, peerConfig.url);
	} catch (error) {
		logger.info('%s - Unable to connect to the endorser %s due to %s', method, peerName, error);
	}
}

function findPeerMspid(name: string, config: any): string | undefined {
	const method = 'findPeerMspid';
	logger.debug('%s - start for %s', method, name);

	let mspid: string | undefined;
	here: for (const orgName in config.organizations) {
		const org = config.organizations[orgName];
		for (const peer of org.peers) {
			logger.debug('%s - checking peer %s in org %s', method, peer, orgName);
			if (peer === name) {
				mspid = org.mspid;
				logger.debug('%s - found mspid %s for %s', method, mspid, name);
				break here;
			}
		}
	}

	return mspid;
}

async function buildOptions(endpointConfig: any): Promise<ConnectOptions> {
	const method = 'buildOptions';
	logger.debug(`${method} - start`);
	const options: ConnectOptions = {
		url: endpointConfig.url
	};
	const pem = await getPEMfromConfig(endpointConfig.tlsCACerts);
	if (pem) {
		options.pem = pem;
	}
	Object.assign(options, endpointConfig.grpcOptions);

	if (options['request-timeout'] && !options.requestTimeout) {
		options.requestTimeout = options['request-timeout'];
	}

	return options;
}

async function getPEMfromConfig(config: ConnectOptions): Promise<string | undefined> {
	let result: string | undefined;
	if (config) {
		if (config.pem) {
			// cert value is directly in the configuration
			result = config.pem;
		} else if (config.path) {
			// cert value is in a file
			const data = await fs.promises.readFile(config.path);
			result = Buffer.from(data).toString();
			result = Utils.normalizeX509(result);
		}
	}

	return result;
}
