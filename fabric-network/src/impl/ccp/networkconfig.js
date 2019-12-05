/*
 Copyright 2019 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

const fs = require('fs-extra');
const {Utils: utils} = require('fabric-common');

const logger = utils.getLogger('NetworkConfig');

/**
 * This is an implementation of the [NetworkConfig]{@link module:api.NetworkConfig} API.
 * It will be used to work with the v1.0.1 version of a JSON based common connection profile.
 * (also known as a network configuration).
 *
 * @class
 */
class NetworkConfig {

	static async loadFromConfig(client, config = {}) {
		const method = 'buildChannel';
		logger.debug('%s - start', method);

		// create peers
		if (config.peers) {
			for (const peer_name in config.peers) {
				await buildPeer(client, peer_name, config.peers[peer_name], config);
			}
		}
		// create orderers
		if (config.peers) {
			for (const orderer_name in config.orderers) {
				await buildOrderer(client, orderer_name, config.orderers[orderer_name]);
			}
		}
		// build channels
		if (config.channels) {
			for (const channel_name in config.channels) {
				buildChannel(client, channel_name, config.channels[channel_name]);
			}
		}

		logger.debug('%s - end', method);
	}
}

async function buildChannel(client, channel_name, channel_config, config) {
	const method = 'buildChannel';
	logger.debug('%s - start - %s', method, channel_name);

	const channel = client.getChannel(channel_name);
	for (const peer_name in channel_config.peers) {
		const peer = client.getEndorser(peer_name);
		channel.addEndorser(peer);
		logger.debug('%s - added endorsing peer :: %s', method, peer.name);
	}
	for (const orderer_name of channel_config.orderers) {
		const orderer = client.getCommitter(orderer_name);
		channel.addCommitter(orderer);
		logger.debug('%s - added orderer :: %s', method, orderer.name);
	}
}

async function buildOrderer(client, orderer_name, orderer_config) {
	const method = 'buildOrderer';
	logger.debug('%s - start - %s', method, orderer_name);

	const mspid = orderer_config.mspid;
	const options = buildOptions(orderer_config);
	const end_point = client.newEndpoint(options);
	try {
		logger.debug('%s - about to connect to committer %s url:%s mspid:%s', method, orderer_name, orderer_config.url, mspid);
		// since the client saves the orderer, no need to save here
		const orderer = client.getCommitter(orderer_name, mspid);
		await orderer.connect(end_point);
		logger.debug('%s - connected to committer %s url:%s', method, orderer_name, orderer_config.url);
	} catch (error) {
		logger.error('%s - Unable to connect to the committer %s due to %s', method, orderer_name, error);
	}
}

async function buildPeer(client, peer_name, peer_config, config) {
	const method = 'buildPeer';
	logger.debug('%s - start - %s', method, peer_name);

	const mspid = findPeerMspid(peer_name, config);
	const options = buildOptions(peer_config);
	const end_point = client.newEndpoint(options);
	try {
		logger.debug('%s - about to connect to endorser %s url:%s mspid:%s', method, peer_name, peer_config.url, mspid);
		// since this adds to the clients list, no need to save
		const peer = client.getEndorser(peer_name, mspid);
		await peer.connect(end_point);
		logger.debug('%s - connected to endorser %s url:%s', method, peer_name, peer_config.url);
	} catch (error) {
		logger.error('%s - Unable to connect to the endorser %s due to %s', method, peer_name, error);
	}
}

function findPeerMspid(name, config) {
	const method = 'findPeerMspid';
	logger.debug('%s - start for %s', method, name);

	let mspid = null;
	here: for (const org_name in config.organizations) {
		const org = config.organizations[org_name];
		for (const peer of org.peers) {
			logger.debug('%s - checking peer %s in org %s', method, peer, org_name);
			if (peer === name) {
				mspid = org.mspid;
				logger.debug('%s - found mspid %s for %s', method, mspid, name);
				break here;
			}
		}
	}

	return mspid;
}

function buildOptions(endpoint_config) {
	const method = 'buildOptions';
	logger.debug(`${method} - start`);
	const pem = getPEMfromConfig(endpoint_config.tlsCACerts);
	const options = {
		url: endpoint_config.url,
		pem: pem
	};
	Object.assign(options, endpoint_config.grpcOptions);

	if (options['request-timeout'] && !options.requestTimeout) {
		options.requestTimeout = options['request-timeout'];
	}

	return options;
}

function getPEMfromConfig(config) {
	let result = null;
	if (config) {
		if (config.pem) {
			// cert value is directly in the configuration
			result = config.pem;
		} else if (config.path) {
			// cert value is in a file
			const data = fs.readFileSync(config.path);
			result = Buffer.from(data).toString();
			result = utils.normalizeX509(result);
		}
	}

	return result;
}

module.exports = NetworkConfig;
