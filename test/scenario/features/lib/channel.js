/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');
const testUtil = require('./utils.js');

const path = require('path');
const fs = require('fs');

/**
 * Create the channels located in the given common connection profile.
 * @param {string} configPath The path to the Fabric network common connection profile and associated data.
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {Boolean} tls Boolean true if tls network; false if not
 * @return {Promise} The return promise.
 */
async function create_channels(configPath, ccp, tls) {
	Client.setConfigSetting('request-timeout', 60000);
	const channels = ccp.getChannels();
	if (!Object.keys(channels) || Object.keys(channels).length === 0) {
		return Promise.reject(new Error('No channel information found'));
	}

	try {
		for (const channelName in channels) {
			const channel = channels[channelName];

			testUtil.logMsg('Creating channel [' + channelName + '] ...');

			// Acting as a client in first org when creating the channel
			const client = new Client();
			const orgs = ccp.getOrganizations();
			const orgName = Object.keys(orgs)[0];
			const org = orgs[orgName];

			const ordererName = channel.orderers[0];
			const caRootsPath = ccp.getOrderer(ordererName).tlsCACerts.path;
			const data = fs.readFileSync(caRootsPath);
			const caroots = Buffer.from(data).toString();

			// Conditional action on TLS enablement
			if (tls) {
				const caName = org.certificateAuthorities[0];
				const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
				const tlsInfo = await testUtil.tlsEnroll(fabricCAEndpoint, caName);
				client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
			}

			const orderer = client.newOrderer(
				ccp.getOrderer(ordererName).url,
				{
					'pem': caroots,
					'ssl-target-name-override': ccp.getOrderer(ordererName).grpcOptions['ssl-target-name-override']
				}
			);

			let config = null;
			const signatures = [];

			const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(org)});
			client.setStateStore(store);
			const cryptoSuite = Client.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(org)}));
			client.setCryptoSuite(cryptoSuite);

			// Run this to set the required identity on the client object
			await testUtil.getOrdererAdmin(client, ordererName, ccp);

			// use the config update created by the configtx tool
			const envelope_bytes = fs.readFileSync((path.join(configPath, 'crypto-config', channelName + '.tx')));
			config = client.extractChannelConfig(envelope_bytes);

			// sign the config for each org
			for (const organization in ccp.getOrganizations()) {
				client._userContext = null;
				await testUtil.getSubmitter(client, true, organization, ccp);
				// sign the config
				const signature = client.signChannelConfig(config).toBuffer().toString('hex');
				signatures.push(signature);
			}

			client._userContext = null;

			// Run this to set the required identity on the client object
			await testUtil.getOrdererAdmin(client, ordererName, ccp);

			// sign the config
			const signature = client.signChannelConfig(config);
			// collect signature from orderer admin
			signatures.push(signature);
			// build up the create request
			const tx_id = client.newTransactionID();
			const request = {
				name: channelName,
				config: config,
				signatures: signatures,
				orderer: orderer,
				txId: tx_id
			};

			// send create request to orderer
			const result = await client.createChannel(request);
			if (result.status && result.status === 'SUCCESS') {
				testUtil.logMsg('Successfully created channel [' + channelName + ']');
				await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
				return Promise.resolve();
			} else {
				throw new Error('Failed to create channels, with status: ' + result.status);
			}
		}
	} catch (err) {
		testUtil.logError('Failed to create channels ' + (err.stack ? err.stack : err));
		return Promise.reject(err);
	}
}

/**
 * Join the peers of the given organization to the given channel.
 * @param {CommonConnectionProfile} ccp The common connection profile
 * @param {Boolean} tls true if a tls network; false if not
 * @param {String} channelName the name of the channel to join
 * @param {String} orgName the name of the org
 */
async function join_channel(ccp, tls, channelName, orgName) {
	Client.setConfigSetting('request-timeout', 60000);
	const client = new Client();
	const channel = client.newChannel(channelName);
	const targets = [];

	const ordererName = ccp.getOrderersForChannel(channelName)[0];
	const caRootsPath = ccp.getOrderer(ordererName).tlsCACerts.path;
	let data = fs.readFileSync(caRootsPath);
	const caroots = Buffer.from(data).toString();
	let genesis_block = null;

	try {
		testUtil.logMsg('Joining organization [' + orgName + '] to channel [' + channelName + '] ...');

		// Conditional action on TLS enablement
		if (tls) {
			const caName = ccp.getCertificatAuthoritiesForOrg(orgName)[0];
			const fabricCAEndpoint = ccp.getCertificateAuthority(caName).url;
			const tlsInfo = await testUtil.tlsEnroll(fabricCAEndpoint, caName);
			client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);
		}

		const store = await Client.newDefaultKeyValueStore({path: testUtil.storePathForOrg(orgName)});
		client.setStateStore(store);

		// set user internal to client
		await testUtil.getOrdererAdmin(client, ordererName, ccp);

		channel.addOrderer(
			client.newOrderer(
				ccp.getOrderer(ordererName).url,
				{
					'pem': caroots,
					'ssl-target-name-override': ccp.getOrderer(ordererName).grpcOptions['ssl-target-name-override']
				}
			)
		);

		let tx_id = client.newTransactionID();
		let request = {
			txId: tx_id
		};

		const block = await channel.getGenesisBlock(request);
		genesis_block = block;

		// get the peer org's admin required to send join channel requests
		client._userContext = null;

		await testUtil.getSubmitter(client, true /* get peer org admin */, orgName, ccp);

		const peers = ccp.getOrganization(orgName).peers;
		peers.forEach((peerName) => {
			const peer = ccp.getPeer(peerName);
			data = fs.readFileSync(peer.tlsCACerts.path);
			targets.push(
				client.newPeer(
					peer.url,
					{
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': peer.grpcOptions['ssl-target-name-override']
					}
				)
			);
		});

		tx_id = client.newTransactionID();
		request = {
			targets: targets,
			block: genesis_block,
			txId: tx_id
		};

		const results = await channel.joinChannel(request, 130000);

		if (!(results && results[0] && results[0].response && results[0].response.status === 200)) {
			throw new Error('Unexpected join channel response: ' + results.toString());
		} else {
			testUtil.logMsg('Successfully joined organization [' + orgName + '] to channel [' + channelName + ']');
			await testUtil.sleep(testUtil.TIMEOUTS.SHORT_INC);
			return client;
		}
	} catch (err) {
		testUtil.logError(err);
		return Promise.reject(err);
	}
}

module.exports.create_channels = create_channels;
module.exports.join_channel = join_channel;
