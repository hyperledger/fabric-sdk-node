/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('ONLY-ADMIN');

const tape = require('tape');
const _test = require('tape-promise');
const test = _test(tape);

const Client = require('fabric-client');
const util = require('util');
const fs = require('fs');
const path = require('path');

const testUtil = require('../unit/util.js');

// Testing will demostrate how the connetion profile configuration may hold a
// admin user identity and it will be used for all fabric interactions.
// However since the network is using mutual TLS, the TLS connection will get
// valid certificates from the CertificateAuthority as a testing convenience.
// The CertificateAuthority will not be used to get the required signing certificates
// for the fabric requests.
//
// Testing will also demostrate how to read and set the admin identity manually
// Only one call will be made with this, however if the identity has access, all
// the calls made by connection profile demonstration may also be made.
test('\n\n***** use only admin identity  *****\n\n', async function(t) {
	const channel_name = 'adminconfig';

	const client_org1 = await getClientForOrg(t, 'org1');
	const client_org2 = await getClientForOrg(t, 'org2');

	const channel = await setupChannel(t, client_org1, client_org2, channel_name);
	const tx_id_string = await invoke(t, client_org1, channel);

	await queries(t, client_org1, channel, tx_id_string);
	await manually(t, client_org1);

	t.end();
});

test('\n\n***** D I S C O V E R Y  *****\n\n', async function(t) {
	const client = await getClientForOrg(t, 'org1');
	const channel = client.getChannel('adminconfig');

	let q_results = await channel.queryInstantiatedChaincodes('peer0.org1.example.com', true);
	const chaincode_id = q_results.chaincodes[0].name;
	const version = q_results.chaincodes[0].version;

	let results = await channel._discover({
		target:'peer0.org1.example.com',
		chaincodeId: chaincode_id //to get a chaincode query
	});

	t.equals(results.config.msps.OrdererMSP.id, 'OrdererMSP', 'Checking MSP ID');
	t.equals(results.config.msps.Org1MSP.id, 'Org1MSP', 'Checking MSP ID');
	t.equals(results.config.msps.Org2MSP.id, 'Org2MSP', 'Checking MSP ID');
	t.equals(results.config.orderers.OrdererMSP.endpoints[0].host, 'orderer.example.com', 'Checking orderer host');
	t.equals(results.config.orderers.OrdererMSP.endpoints[0].port, 7050, 'Checking orderer port');
	t.equals(results.peers_by_org.Org1MSP.peers[0].endpoint, 'peer0.org1.example.com:7051', 'Checking peer endpoint');
	t.equals(results.peers_by_org.Org1MSP.peers[0].ledger_height.low, 3, 'Checking peer ledger_height');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].name, 'example', 'Checking peer chaincode name');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].version, 'v2', 'Checking peer chaincode version');
	t.equals(results.endorsement_targets.example.groups.G0.peers[0].endpoint, 'peer0.org1.example.com:7051', 'Checking peer endpoint');
	t.equals(results.endorsement_targets.example.groups.G0.peers[0].ledger_height.low, 3, 'Checking peer ledger_height');
	t.equals(results.endorsement_targets.example.groups.G0.peers[0].chaincodes[0].name, chaincode_id, 'Checking peer chaincode name');
	t.equals(results.endorsement_targets.example.groups.G0.peers[0].chaincodes[0].version, version, 'Checking peer chaincode version');
	t.equals(results.endorsement_targets.example.layouts[0].quantities_by_group.G0, 1, 'Checking layout quantities_by_group');
	//logger.info('D I S C O V E R Y   R E S U L T S \n %j', results);

	// try without the target specfied
	results = await channel._discover({
		chaincodeId: chaincode_id //to get a chaincode query
	});

	t.equals(results.config.msps.OrdererMSP.id, 'OrdererMSP', 'Checking MSP ID');
	t.equals(results.config.msps.Org1MSP.id, 'Org1MSP', 'Checking MSP ID');
	t.equals(results.config.msps.Org2MSP.id, 'Org2MSP', 'Checking MSP ID');
	t.equals(results.config.orderers.OrdererMSP.endpoints[0].host, 'orderer.example.com', 'Checking orderer host');
	t.equals(results.config.orderers.OrdererMSP.endpoints[0].port, 7050, 'Checking orderer port');
	t.equals(results.peers_by_org.Org1MSP.peers[0].endpoint, 'peer0.org1.example.com:7051', 'Checking peer endpoint');
	t.equals(results.peers_by_org.Org1MSP.peers[0].ledger_height.low, 3, 'Checking peer ledger_height');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].name, 'example', 'Checking peer chaincode name');
	t.equals(results.peers_by_org.Org1MSP.peers[0].chaincodes[0].version, 'v2', 'Checking peer chaincode version');
	t.equals(results.endorsement_targets.example.groups.G0.peers[0].endpoint, 'peer0.org1.example.com:7051', 'Checking peer endpoint');
	t.equals(results.endorsement_targets.example.groups.G0.peers[0].ledger_height.low, 3, 'Checking peer ledger_height');
	t.equals(results.endorsement_targets.example.groups.G0.peers[0].chaincodes[0].name, 'example', 'Checking peer chaincode name');
	t.equals(results.endorsement_targets.example.groups.G0.peers[0].chaincodes[0].version, 'v2', 'Checking peer chaincode version');
	t.equals(results.endorsement_targets.example.layouts[0].quantities_by_group.G0, 1, 'Checking layout quantities_by_group');

	results = await channel._discover({
		chaincodeId: chaincode_id,
		target_names: true,
		hostname: 'localhost'
	});
	t.equals(channel.getOrderers()[0].getUrl(), 'grpcs://localhost:7050', 'Checking orderer url');
	t.equals(channel.getPeers()[0].getUrl(), 'grpcs://localhost:7051', 'Checking peer url');

	q_results = await channel.queryInstantiatedChaincodes(null, true);
	t.equals(q_results.chaincodes[0].name, chaincode_id, 'Checking able to query using a discovered peer');

	const tx_id_string = await invoke(t, client, channel);

	await queries(t, client, channel, tx_id_string);

	t.pass('Successfully completed testing');
	t.end();
});

async function getClientForOrg(t, org) {
	// build a 'Client' instance that knows of a network
	//  this network config does not have the client information, we will
	//  load that later so that we can switch this client to be in a different
	//  organization
	const client = Client.loadFromConfig('test/fixtures/network-ad.yaml');
	t.pass('Successfully loaded a network configuration');

	// load the client information for this organization
	// this file only has the client section
	client.loadFromConfig('test/fixtures/'+ org +'.yaml');
	t.pass('Successfully loaded client section of network config for organization:'+ org);
	if(client._adminSigningIdentity) {
		t.pass('Successfully assigned an admin idenity to this client');
	} else {
		t.fail('Failed to assigne an admin idenity to this client');
	}

	// tell this client instance where the state and key stores are located
	await client.initCredentialStores();
	t.pass('Successfully created the key value store  and crypto store based on the config and network config');

	// the network is using mutual TLS, get the client side certs from the CA
	await getTlsCACerts(t, client, org);

	return client;
}

async function getTlsCACerts(t, client) {
	// get the CA associated with this client's organization
	// ---- this must only be run after the client has been loaded with a
	// client section of the connection profile
	const caService = client.getCertificateAuthority();
	t.pass('Successfully got the CertificateAuthority from the client');

	const request = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw',
		profile: 'tls'
	};
	const enrollment = await caService.enroll(request);

	t.pass('Successfully called the CertificateAuthority to get the TLS material');
	const key = enrollment.key.toBytes();
	const cert = enrollment.certificate;

	// set the material on the client to be used when building endpoints for the user
	client.setTlsClientCertAndKey(cert, key);

	return;
}

async function setupChannel(t, client_org1, client_org2, channel_name) {
	let channel_org1 = null; // these are for the same
	let channel_org2 = null;
	try {
		// get the config envelope created by the configtx tool
		const envelope_bytes = fs.readFileSync(path.join(__dirname, '../fixtures/channel/adminconfig.tx'));
		// Have the sdk get the config update object from the envelope.
		// the config update object is what is required to be signed by all
		// participating organizations
		const config = client_org1.extractChannelConfig(envelope_bytes);
		t.pass('Successfully extracted the config update from the configtx envelope');

		const signatures = [];
		// sign the config by the  admins
		const signature1 = client_org1.signChannelConfig(config);
		signatures.push(signature1);
		t.pass('Successfully signed config update for org1');
		const signature2 = client_org2.signChannelConfig(config);
		signatures.push(signature2);
		t.pass('Successfully signed config update for org2');
		// now we have enough signatures...

		// get an admin based transaction
		let tx_id = client_org1.newTransactionID(true);

		let request = {
			config: config,
			signatures : signatures,
			name : channel_name,
			orderer : 'orderer.example.com',
			txId  : tx_id
		};

		try {
			const create_results = await client_org1.createChannel(request);
			if(create_results.status && create_results.status === 'SUCCESS') {
				t.pass('Successfully created the channel.');
				await sleep(10000);
			} else {
				t.fail('Failed to create the channel. ' + create_results.status + ' :: ' + create_results.info);
				throw new Error('Failed to create the channel. ');
			}
		} catch(error) {
			t.fail('Failed to create channel :'+ error);
			throw new Error('Failed to create the channel. ');
		}


		// have the client build a channel instance with all peers and orderers
		// as defined in the loaded connection profile
		// The channel will hold a reference to client
		// --- the TLS certs will be applied from the client to each of the
		//     of the orderes and peers as they are added to the channel
		channel_org1 = client_org1.getChannel(channel_name);
		channel_org2 = client_org2.getChannel(channel_name);

		// get an admin based transaction
		tx_id = client_org1.newTransactionID(true);
		request = {
			txId : 	tx_id
		};

		let genesis_block = await channel_org1.getGenesisBlock(request);
		t.pass('Successfully got the genesis block');

		let promises = [];
		let join_monitor = buildJoinEventMonitor(t, client_org1, channel_name, 'peer0.org1.example.com');
		promises.push(join_monitor);

		tx_id = client_org1.newTransactionID(true);
		request = {
			targets: ['peer0.org1.example.com'],
			block : genesis_block,
			txId : 	tx_id
		};
		// join request to peer on org1 as admin of org1
		let join_promise = channel_org1.joinChannel(request, 30000);
		promises.push(join_promise);

		let join_results = await Promise.all(promises);
		logger.debug(util.format('Join Channel R E S P O N S E : %j', join_results));

		// lets check the results of sending to the peers which is
		// last in the results array
		let peer_results = join_results.pop();
		if(peer_results && peer_results[0] && peer_results[0].response && peer_results[0].response.status == 200) {
			t.pass('Successfully joined channnel on org1');
		} else {
			t.fail('Failed to join channel on org1');
			throw new Error('Failed to join channel on org1');
		}

		promises = [];
		join_monitor = buildJoinEventMonitor(t, client_org2, channel_name, 'peer0.org2.example.com');
		promises.push(join_monitor);

		tx_id = client_org2.newTransactionID(true);
		request = {
			targets: ['peer0.org2.example.com'],
			block : genesis_block,
			txId : 	tx_id
		};
		// join request to peer on org2 as admin of org2
		join_promise = channel_org2.joinChannel(request, 30000);
		promises.push(join_promise);

		join_results = await Promise.all(promises);
		logger.debug(util.format('Join Channel R E S P O N S E : %j', join_results));

		// lets check the results of sending to the peers which is
		// last in the results array
		peer_results = join_results.pop();
		if(peer_results && peer_results[0] && peer_results[0].response && peer_results[0].response.status == 200) {
			t.pass('Successfully joined channnel on org2');
		} else {
			t.fail('Failed to join channel on org2');
			throw new Error('Failed to join channel on org2');
		}

		/*
		 *  I N S T A L L   C H A I N C O D E
		 */
		process.env.GOPATH = path.join(__dirname, '../fixtures');
		tx_id = client_org1.newTransactionID(true);//get an admin transaction ID
		request = {
			targets: ['peer0.org1.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v2',
			txId : tx_id
		};

		// send install request as admin of org1
		let install_results = await client_org1.installChaincode(request);
		if(install_results && install_results[0] && install_results[0][0].response && install_results[0][0].response.status == 200) {
			t.pass('Successfully installed chain code on org1');
		} else {
			t.fail(' Failed to install chaincode on org1');
			throw new Error('Failed to install chain code on org1');
		}

		tx_id = client_org2.newTransactionID(true); //get an admin transaction ID
		request = {
			targets: ['peer0.org2.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v2',
			txId : tx_id
		};

		// send install as org2 admin
		install_results = await client_org2.installChaincode(request);
		if(install_results && install_results[0] && install_results[0][0].response && install_results[0][0].response.status == 200) {
			t.pass('Successfully installed chain code on org2');
		} else {
			t.fail(' Failed to install chaincode');
			throw new Error('Failed to install chain code');
		}

		/*
		 *  I N S T A N S I A T E
		 */

		tx_id = client_org1.newTransactionID(true);
		request = {
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v2',
			args: ['a', '100', 'b', '200'],
			txId: tx_id,
			targets: ['peer0.org1.example.com','peer0.org2.example.com'],
		};

		// send proposal
		let instan_results = await channel_org1.sendInstantiateProposal(request);
		const proposalResponses = instan_results[0];
		const proposal = instan_results[1];
		if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
			t.pass('Successfully sent Proposal and received ProposalResponse');
		} else {
			t.fail('Failed to send  Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}

		request = {
			proposalResponses: proposalResponses,
			proposal: proposal,
			txId : tx_id
		};

		// submit the transaction to the orderer
		const commit_response = await channel_org1.sendTransaction(request);
		if (!(commit_response instanceof Error) && commit_response.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to instantiate the chaincode to the orderer.');
			await sleep(10000); // use sleep for now until the eventhub is integrated into the network config changes
		} else {
			t.fail('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
			throw new Error('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
		}

		t.pass('Successfully waited for chaincodes to startup');
	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}

	// just return the one channel instance
	return channel_org1;
}


function buildJoinEventMonitor(t, client, channel_name, peer_name) {
	const event_hub = client.getEventHub(peer_name);
	const event_block_promise = new Promise((resolve, reject) => {
		let registration_id = null;
		const event_timeout = setTimeout(() => {
			let message = 'REQUEST_TIMEOUT:' + event_hub._ep._endpoint.addr;
			logger.error(message);
			event_hub.disconnect();
			reject(new Error(message));
		}, 30000);
		registration_id = event_hub.registerBlockEvent((block) => {
			clearTimeout(event_timeout);
			// A peer may have more than one channel, check that this block came
			// is from the channel that is being joined.
			// ... also this will be the first block channel, and the channel may
			// have many more blocks
			if (block.data.data.length === 1) {
				const channel_header = block.data.data[0].payload.header.channel_header;
				if (channel_header.channel_id === channel_name) {
					const message = util.format('EventHub %s has reported a block update for channel %s',event_hub._ep._endpoint.addr,channel_name);
					t.pass(message);
					event_hub.unregisterBlockEvent(registration_id);
					event_hub.disconnect();
					t.pass(util.format('EventHub %s has been disconnected',event_hub._ep._endpoint.addr));
					resolve(message);
				} else {
					t.pass('Keep waiting for the right block');
				}
			}
		}, (err) => {
			clearTimeout(event_timeout);
			const message = 'Problem setting up the event hub :'+ err.toString();
			t.fail(message);
			event_hub.disconnect();
			reject(new Error(message));
		});
		event_hub.connect();
	});

	return event_block_promise;
}

async function invoke(t, client, channel) {
	let tx_id_string = null;
	try {
		// get a admin based transaction id
		const tx_id = client.newTransactionID(true);
		tx_id_string = tx_id.getTransactionID();
		let request = {
			chaincodeId : 'example',
			fcn: 'move',
			args: ['a', 'b','100'],
			txId: tx_id
		};

		const results = await channel.sendTransactionProposal(request);
		const proposalResponses = results[0];
		const proposal = results[1];
		let all_good = true;
		for(let i in proposalResponses) {
			let one_good = false;
			const proposal_response = proposalResponses[i];
			if( proposal_response.response && proposal_response.response.status === 200) {
				t.pass('transaction proposal has response status of good');
				one_good = true;
			} else {
				t.fail('transaction proposal was bad');
			}
			all_good = all_good & one_good;
		}

		if (!all_good) {
			t.fail('Failed to send invoke Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send invoke Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
		request = {
			proposalResponses: proposalResponses,
			proposal: proposal,
			txId : tx_id // to use the admin idenity must include the transactionID
			             // that was created for the proposal that was based on the admin Identity
		};

		const responses = await send_and_wait_on_events(t, channel, request, tx_id_string);
		if (!(responses[0] instanceof Error) && responses[0].status === 'SUCCESS') {
			t.pass('Successfully committed transaction ' + tx_id_string);
			await sleep(5000);
		} else {
			t.fail('Failed transaction '+ tx_id_string);
			throw new Error('Failed transaction');
		}
	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}

	return tx_id_string;
}

async function send_and_wait_on_events(t, channel, request, tx_id) {
	const promises = [];
	promises.push(channel.sendTransaction(request));

	let channel_event_hubs = channel.getChannelEventHubsForOrg();
	for(let i in channel_event_hubs) {
		const channel_event_hub = channel_event_hubs[i];
		const event_monitor = transaction_monitor(t, channel_event_hub, tx_id);
		promises.push(event_monitor);
	}

	return Promise.all(promises);
}

function transaction_monitor(t, channel_event_hub, tx_id) {
	const a_promise = new Promise((resolve, reject) => {
		const handle = setTimeout(() => {
			t.fail('Timeout - Failed to receive event for tx_id '+ tx_id);
			channel_event_hub.disconnect(); //shutdown
			throw new Error('TIMEOUT - no event received');
		}, 10000);

		channel_event_hub.registerTxEvent(tx_id, (txnid, code, block_num) => {
			clearTimeout(handle);
			t.pass('Event has been seen with transaction code:'+ code + ' for transaction id:'+ txnid + ' for block_num:' + block_num);
			resolve('Got the replayed transaction');
		}, (error) => {
			clearTimeout(handle);
			t.fail('Failed to receive event replay for Event for transaction id ::'+tx_id);
			throw(error);
		},
			// Setting the disconnect to true as we do not want to use this
			// ChannelEventHub after the event we are looking for comes in
			{disconnect: true}
		);
		t.pass('Successfully registered event for ' + tx_id);

		// this connect will send a request to the peer event service that has
		// been signed by the admin identity
		channel_event_hub.connect();
		t.pass('Successfully called connect on '+ channel_event_hub.getPeerAddr());
	});

	return a_promise;
}

async function queries(t, client, channel, tx_id_string) {
	try {
		const request = {
			chaincodeId : 'example',
			fcn: 'query',
			args: ['b']
		};

		const response_payloads = await channel.queryByChaincode(request, true);
		if (response_payloads) {
			for(let i = 0; i < response_payloads.length; i++) {
				t.pass('Successfully got query results :: '+ response_payloads[i].toString('utf8'));
			}
		} else {
			t.fail('response_payloads is null');
			throw new Error('Failed to get response on query');
		}

		let results = await client.queryChannels('peer0.org1.example.com', true);
		let found = false;
		for(let i in results.channels) {
			if(results.channels[i].channel_id === channel.getName()) {
				found = true;
			}
		}
		if(found) {
			t.pass('Successfully found our channel in the result list');
		} else {
			t.fail('Failed to find our channel in the result list');
		}

		results = await client.queryInstalledChaincodes('peer0.org1.example.com', true); // use admin
		found = false;
		for(let i in results.chaincodes) {
			if(results.chaincodes[i].name === 'example') {
				found = true;
			}
		}
		if(found) {
			t.pass('Successfully found our chaincode in the result list');
		} else {
			t.fail('Failed to find our chaincode in the result list');
		}

		results = await channel.queryBlock(1, 'peer0.org1.example.com', true);
		t.equals('1', results.header.number, 'Checking able to find our block number by admin');

		results = await channel.queryInfo('peer0.org1.example.com', true);
		t.pass('Successfully got the block height by admin:: '+ results.height);

		results = await channel.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com', true);
		t.pass('Successfully got block by hash by admin ::' + results.header.number);

		results = await channel.queryTransaction(tx_id_string, 'peer0.org1.example.com', true);
		t.equals(0, results.validationCode, 'Checking able to find our transaction validationCode by admin');
	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}

	return true;
}

async function manually(t, client) {
	try {
		let data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/keystore/ef8e88d28a86f23466ad378003d819561adbedc77fe90cc250424ce4de179a3c_sk'));
		const key = data;
		const keyPem = Buffer.from(data).toString();
		data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/signcerts/Admin@example.com-cert.pem'));
		const cert = Buffer.from(data).toString();
		data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'));
		const pem = Buffer.from(data).toString();
		t.pass('Successfully read all crypto material');

		client.setAdminSigningIdentity(key, cert, 'OrdererMSP');
		t.pass('Successfully set the client with admin signing identity');

		const sys_channel = client.newChannel('testchainid');

		const options = {
			pem: pem,
			'ssl-target-name-override': 'orderer.example.com'
		};

		// this is to allow mutual TLS on the orderer by adding client TLS
		// information into the options object used to create the orderer
		client.addTlsClientCertAndKey(options);

		const orderer = client.newOrderer(
			'grpcs://localhost:7050',
			options
		);

		sys_channel.addOrderer(orderer);
		t.pass('Successfully added orderer to channel');

		let config_envelope = await sys_channel.getChannelConfigFromOrderer();
		t.pass('Successfully got the config envelope by using the admin identity');

		client._adminSigningIdentity = null; //remove the admin assigned above
		client._userContext = null;

		// this will create the user and also assign it to client instance
		// as a userContext
		const user = await client.createUser({
			username: 'ordererAdmin',
			mspid: 'OrdererMSP',
			cryptoContent: { privateKeyPEM: keyPem, signedCertPEM: cert }
		});
		t.equals(user.getName(), 'ordererAdmin', 'Checking that the user was created');
		t.equals(client._userContext.getName(), 'ordererAdmin', 'Checking that the user was set');

		config_envelope = await sys_channel.getChannelConfigFromOrderer();
		t.pass('Successfully got the config envelope by user the user context');

	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}

	return true;
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
