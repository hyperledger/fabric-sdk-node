/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';

var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('ONLY-ADMIN');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Client = require('fabric-client');
var util = require('util');
var fs = require('fs');
var path = require('path');

var testUtil = require('../unit/util.js');

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

	let client_org1 = await getClientForOrg(t, 'org1');
	let client_org2 = await getClientForOrg(t, 'org2');

	let channel = await setupChannel(t, client_org1, client_org2, channel_name);

	let tx_id_string = await invoke(t, client_org1, channel);
	await queries(t, client_org1, channel, tx_id_string);

	await manually(t, client_org1);

	t.end();
});

async function getClientForOrg(t, org) {
	// build a 'Client' instance that knows of a network
	//  this network config does not have the client information, we will
	//  load that later so that we can switch this client to be in a different
	//  organization
	var client = Client.loadFromConfig('test/fixtures/network-ad.yaml');
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
	await getTlsCACerts(t, client);

	return client;
}

async function getTlsCACerts(t, client) {
	// get the CA associated with this client's organization
	// ---- this must only be run after the client has been loaded with a
	// client section of the connection profile
	let caService = client.getCertificateAuthority();
	t.pass('Successfully got the CertificateAuthority from the client');

	let request = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw',
		profile: 'tls'
	};
	let enrollment = await caService.enroll(request);

	t.pass('Successfully called the CertificateAuthority to get the TLS material');
	let key = enrollment.key.toBytes();
	let cert = enrollment.certificate;

	// set the material on the client to be used when building endpoints for the user
	client.setTlsClientCertAndKey(cert, key);

	return;
}

async function setupChannel(t, client_org1, client_org2, channel_name) {
	let channel_org1 = null; // these are for the same
	let channel_org2 = null;
	try {
		// get the config envelope created by the configtx tool
		let envelope_bytes = fs.readFileSync(path.join(__dirname, '../fixtures/channel/adminconfig.tx'));
		// Have the sdk get the config update object from the envelope.
		// the config update object is what is required to be signed by all
		// participating organizations
		let config = client_org1.extractChannelConfig(envelope_bytes);
		t.pass('Successfully extracted the config update from the configtx envelope');

		let signatures = [];
		// sign the config by the  admins
		let signature1 = client_org1.signChannelConfig(config);
		signatures.push(signature1);
		t.pass('Successfully signed config update for org1');
		let signature2 = client_org2.signChannelConfig(config);
		signatures.push(signature2);
		t.pass('Successfully signed config update for org2');
		// now we have enough signatures...

		// get an admin based transaction
		let create_tx_id = client_org1.newTransactionID(true);

		let create_request = {
			config: config,
			signatures : signatures,
			name : channel_name,
			orderer : 'orderer.example.com',
			txId  : create_tx_id
		};

		let create_results = await client_org1.createChannel(create_request);
		if(create_results.status && create_results.status === 'SUCCESS') {
			t.pass('Successfully created the channel.');
			await sleep(5000);
		} else {
			t.fail('Failed to create the channel. ');
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
		let gen_tx_id = client_org1.newTransactionID(true);
		request = {
			txId : 	gen_tx_id
		};

		let genesis_block = await channel_org1.getGenesisBlock(request);
		t.pass('Successfully got the genesis block');

		let join_tx_id = client_org1.newTransactionID(true);
		request = {
			targets: ['peer0.org1.example.com'],
			block : genesis_block,
			txId : 	join_tx_id
		};

		// send join request to peer on org2 as admin of org2
		let join_results = await channel_org1.joinChannel(request, 30000);
		if(join_results && join_results[0] && join_results[0].response && join_results[0].response.status == 200) {
			t.pass('Successfully joined channnel on org1');
		} else {
			t.fail('Failed to join channel on org1');
			throw new Error('Failed to join channel on org1');
		}

		join_tx_id = client_org2.newTransactionID(true);
		request = {
			targets: ['peer0.org2.example.com'],
			block : genesis_block,
			txId : 	join_tx_id
		};

		// send join request to peer on org2 as admin of org2
		join_results = await channel_org2.joinChannel(request, 30000);
		if(join_results && join_results[0] && join_results[0].response && join_results[0].response.status == 200) {
			t.pass('Successfully joined channnel on org2');
		} else {
			t.fail('Failed to join channel on org2');
			throw new Error('Failed to join channel on org2');
		}

		await sleep(10000);
		t.pass('Successfully waited for peers to join the channel');

		/*
		 *  I N S T A L L   C H A I N C O D E
		 */
		process.env.GOPATH = path.join(__dirname, '../fixtures');
		let install_tx_id = client_org1.newTransactionID(true);//get an admin transaction ID
		var request = {
			targets: ['peer0.org1.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v2',
			txId : install_tx_id
		};

		// send install request as admin of org1
		let install_results = await client_org1.installChaincode(request);
		if(install_results && install_results[0] && install_results[0][0].response && install_results[0][0].response.status == 200) {
			t.pass('Successfully installed chain code on org1');
		} else {
			t.fail(' Failed to install chaincode on org1');
			throw new Error('Failed to install chain code on org1');
		}

		install_tx_id = client_org2.newTransactionID(true); //get an admin transaction ID
		var request = {
			targets: ['peer0.org2.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v2',
			txId : install_tx_id
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

		let instan_tx_id = client_org1.newTransactionID(true);
		request = {
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v2',
			args: ['a', '100', 'b', '200'],
			txId: instan_tx_id,
			targets: ['peer0.org1.example.com','peer0.org2.example.com'],
		};

		// send proposal
		let instan_results = await channel_org1.sendInstantiateProposal(request);
		var proposalResponses = instan_results[0];
		var proposal = instan_results[1];
		if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
			t.pass('Successfully sent Proposal and received ProposalResponse');
		} else {
			t.fail('Failed to send  Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}

		let commit_request = {
			proposalResponses: proposalResponses,
			proposal: proposal,
			txId : instan_tx_id
		};

		// submit the transaction to the orderer
		let commit_response = await channel_org1.sendTransaction(commit_request);
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

async function invoke(t, client, channel) {
	let tx_id_string = null;
	try {
		// get a admin based transaction id
		let tx_id = client.newTransactionID(true);
		tx_id_string = tx_id.getTransactionID();
		let request = {
			chaincodeId : 'example',
			fcn: 'move',
			args: ['a', 'b','100'],
			txId: tx_id
		};

		let results = await channel.sendTransactionProposal(request);
		let proposalResponses = results[0];
		let proposal = results[1];
		let all_good = true;
		for(var i in proposalResponses) {
			let one_good = false;
			let proposal_response = proposalResponses[i];
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

		let responses = await send_and_wait_on_events(t, channel, request, tx_id_string);
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
	let promises = [];
	promises.push(channel.sendTransaction(request));

	let channel_event_hubs = channel.getChannelEventHubsForOrg();
	for(let i in channel_event_hubs) {
		let channel_event_hub = channel_event_hubs[i];
		let event_monitor = transaction_monitor(t, channel_event_hub, tx_id);
		promises.push(event_monitor);
	}

	return Promise.all(promises);
}

function transaction_monitor(t, channel_event_hub, tx_id) {
	let a_promise = new Promise((resolve, reject) => {
		let handle = setTimeout(() => {
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
		t.pass('Successfully registered event for '+tx_id);

		// this connect will send a request to the peer event service that has
		// been signed by the admin identity
		channel_event_hub.connect();
		t.pass('Successfully called connect on '+ channel_event_hub.getPeerAddr());
	});

	return a_promise;
}

async function queries(t, client, channel, tx_id_string) {
	try {
		let request = {
			chaincodeId : 'example',
			fcn: 'query',
			args: ['b']
		};

		let response_payloads = await channel.queryByChaincode(request, true);
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
}

async function manually(t, client) {
	try {
		let data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/keystore/ef8e88d28a86f23466ad378003d819561adbedc77fe90cc250424ce4de179a3c_sk'));
		let key = data;
		let keyPem = Buffer.from(data).toString();
		data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/signcerts/Admin@example.com-cert.pem'));
		let cert = Buffer.from(data).toString();
		data = fs.readFileSync(path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tlscacerts/example.com-cert.pem'));
		let pem = Buffer.from(data).toString();
		t.pass('Successfully read all crypto material');

		client.setAdminSigningIdentity(key, cert, 'OrdererMSP');
		t.pass('Successfully set the client with admin signing identity');

		let sys_channel = client.newChannel('testchainid');

		let options = {
			pem: pem,
			'ssl-target-name-override': 'orderer.example.com'
		};

		// this is to allow mutual TLS on the orderer by adding client TLS
		// information into the options object used to create the orderer
		client.addTlsClientCertAndKey(options);

		let orderer = client.newOrderer(
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
		let user = await client.createUser({
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
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
