/**
 * Copyright 2017 IBM All Rights Reserved.
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
var logger = utils.getLogger('Network Config');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Client = require('fabric-client');
var util = require('util');
var fs = require('fs');
var path = require('path');
var grpc = require('grpc');

var testUtil = require('../unit/util.js');

var channel_name = 'mychannel2';

test('\n\n***** use the network configuration file  *****\n\n', function(t) {
	var memoryUsage = process.memoryUsage();
	logger.debug(' Memory usage :: %j',memoryUsage);
	testUtil.resetDefaults();
	Client.setConfigSetting('request-timeout', 60000);

	// build a 'Client' instance that knows the network
	//  this network config does not have the client information, we will
	//  load that later so that we can switch this client to be in a different
	//  organization
	var client = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');

	var config = null;
	var signatures = [];
	var genesis_block = null;
	var channel = null;
	var query_tx_id = null;
	var instansiate_tx_id = null;

	// lets load the client information for this organization
	// the file only has the client section
	client.loadFromConfig('test/fixtures/org1.yaml');
	// tell this client instance where the state and key stores are located
	client.initCredentialStores()
	.then((nothing) => {
		t.pass('Successfully created the key value store  and crypto store based on the config and network config');

		// get the config envelope created by the configtx tool
		let envelope_bytes = fs.readFileSync(path.join(__dirname, '../fixtures/channel/mychannel2.tx'));
		// have the sdk get the config update object from the envelope
		// the config update object is what is required to be signed by all
		// participating organizations
		config = client.extractChannelConfig(envelope_bytes);
		t.pass('Successfully extracted the config update from the configtx envelope');

		// sign the config by admin from org1
		var signature = client.signChannelConfig(config);
		// convert signature to a storable string
		// fabric-client SDK will convert any strings it finds back
		// to GRPC protobuf objects during the channel create
		var string_signature = signature.toBuffer().toString('hex');
		t.pass('Successfully signed config update by org1');
		// collect signature from org1 admin
		signatures.push(string_signature);

		/*
		 * switch to organization org2
		 */

		return client.loadFromConfig('test/fixtures/org2.yaml');
	}).then((nothing) =>{
		t.pass('Successfully loaded the client configuration for org2');

		// reset the stores to be using the ones for this organization
		return client.initCredentialStores();
	}).then((nothing) =>{
		t.pass('Successfully set the stores for org2');

		var memoryUsage = process.memoryUsage();
		logger.debug(' Memory usage :: %j',memoryUsage);

		// sign the config by admin from org2
		var signature = client.signChannelConfig(config);
		t.pass('Successfully signed config update for org2');

		// collect signature from org2 admin
		signatures.push(signature);

		// now we have enough signatures...

		// get an admin based transaction
		let tx_id = client.newTransactionID(true);
		// build up the create request
		let request = {
			config: config,
			signatures : signatures,
			name : channel_name,
			orderer : 'orderer.example.com', //this assumes we have loaded a network config
			txId  : tx_id
		};

		// send create request to orderer
		return client.createChannel(request); //logged in as org2
	}).then((result) => {
		logger.debug('\n***\n completed the create \n***\n');

		logger.debug(' response ::%j',result);
		t.pass('Successfully created the channel.');
		if(result.status && result.status === 'SUCCESS') {
			return sleep(5000);
		} else {
			t.fail('Failed to create the channel. ');
			throw new Error('Failed to create the channel. ');
		}
	}).then((nothing) => {
		t.pass('Successfully waited to make sure new channel was created.');

		// have the client build a channel with all peers and orderers
		channel = client.getChannel(channel_name);

		// get an admin based transaction
		let tx_id = client.newTransactionID(true);
		let request = {
			txId : 	tx_id
		};

		return channel.getGenesisBlock(request); //admin from org2
	}).then((block) =>{
		t.pass('Successfully got the genesis block');
		genesis_block = block;

		let tx_id = client.newTransactionID(true);
		let request = {
			//targets: // this time we will leave blank so that we can use
				       // all the peers assigned to the channel ...some may fail
				       // if the submitter is not allowed, let's see what we get
			block : genesis_block,
			txId : 	tx_id
		};

		return channel.joinChannel(request); //admin from org2
	}).then((results) => {
		logger.debug(util.format('Join Channel R E S P O N S E using default targets: %j', results));

		// first of the results should not have good status as submitter does not have permission
		if(results && results[0] && results[0].response && results[0].response.status == 200) {
			t.fail(util.format('Successfully had peer in organization %s join the channel', 'org1'));
			throw new Error('Should not have been able to join channel with this submitter');
		} else {
			t.pass(' Submitter on "org2" Failed to have peer on org1 channel');
		}

		// second of the results should have good status
		if(results && results[1] && results[1].response && results[1].response.status == 200) {
			t.pass(util.format('Successfully had peer in organization %s join the channel', 'org2'));
		} else {
			t.fail(' Failed to join channel');
			throw new Error('Failed to join channel');
		}

		/*
		 * switch to organization org1
		 */
		client.loadFromConfig('test/fixtures/org1.yaml');
		t.pass('Successfully loaded \'admin\' for org1');

		return client.initCredentialStores();
	}).then((nothing) => {
		t.pass('Successfully created the key value store  and crypto store based on the config and network config');

		let tx_id = client.newTransactionID(true);
		let request = {
			targets: ['peer0.org1.example.com'], // this does assume that we have loaded a
			                                     // network config with a peer by this name
			block : genesis_block,
			txId : 	tx_id
		};

		return channel.joinChannel(request); //logged in as org1
	}).then((results) => {
		logger.debug(util.format('Join Channel R E S P O N S E  for a string target: %j', results));

		if(results && results[0] && results[0].response && results[0].response.status == 200) {
			t.pass(util.format('Successfully had peer in organization %s join the channel', 'org1'));
		} else {
			t.fail(' Failed to join channel on org1');
			throw new Error('Failed to join channel on org1');
		}
		return sleep(10000);
	}).then(()=>{
		t.pass('Successfully waited for peers to join the channel');

		var memoryUsage = process.memoryUsage();
		logger.debug(' Memory usage :: %j',memoryUsage);

		process.env.GOPATH = path.join(__dirname, '../fixtures');
		let tx_id = client.newTransactionID(true);
		// send proposal to endorser
		var request = {
			targets: ['peer0.org1.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			chaincodePackage: '',
			txId : tx_id
		};

		return client.installChaincode(request); //still logged as org1
	}).then((results) => {
		if(results && results[0] && results[0][0].response && results[0][0].response.status == 200) {
			t.pass('Successfully installed chain code on org1');
		} else {
			t.fail(' Failed to install chaincode on org1');
			throw new Error('Failed to install chain code on org1');
		}

		/*
		 * switch to organization org2
		 */

		client.loadFromConfig('test/fixtures/org2.yaml');

		return client.initCredentialStores();
	}).then((nothing) => {
		t.pass('Successfully created the key value store  and crypto store based on the config and network config');

		let tx_id = client.newTransactionID(true); // be sure to get a admin transaction ID
		// send proposal to endorser
		var request = {
			targets: ['peer0.org2.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			chaincodePackage: '',
			txId : tx_id
		};

		return client.installChaincode(request); // org2 admin is the signer
	}).then((results) => {
		if(results && results[0] && results[0][0].response && results[0][0].response.status == 200) {
			t.pass('Successfully installed chain code on org2');
		} else {
			t.fail(' Failed to install chaincode');
			throw new Error('Failed to install chain code');
		}

		/*
		 *  I N S T A N S I A T E
		 */

		let tx_id = client.newTransactionID(true);
		instansiate_tx_id = tx_id;
		let request = {
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			args: ['a', '100', 'b', '200'],
			txId: tx_id
			// targets is not required, however the logged in user may not have
			// admin access to all the peers defined in the network configuration
			//targets: ['peer0.org1.example.com'],
		};

		return channel.sendInstantiateProposal(request); // still have org2 admin signer
	}).then((results) => {
		var proposalResponses = results[0];
		var proposal = results[1];
		if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
			t.pass('Successfully sent Proposal and received ProposalResponse');
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				txId : instansiate_tx_id //required to indicate that this is an admin transaction
				//orderer : not specifying, the first orderer defined in the
				//          network configuration for this channel will be used
			};

			return channel.sendTransaction(request); // still have org2 admin as signer
		} else {
			t.fail('Failed to send  Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}).then((response) => {
		if (!(response instanceof Error) && response.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to instantiate the chaincode to the orderer.');
			return sleep(10000); // use sleep for now until the eventhub is integrated into the network config changes
		} else {
			t.fail('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
			throw new Error('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
		}
	}).then((results) => {
		t.pass('Successfully waited for chaincodes to startup');

		var memoryUsage = process.memoryUsage();
		logger.debug(' Memory usage :: %j',memoryUsage);

		/*
		 *  S T A R T   U S I N G
		 */
		return client.setUserContext({username:'admin', password:'adminpw'});
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org2');

		let tx_id = client.newTransactionID(); // get a non admin transaction ID
		query_tx_id = tx_id.getTransactionID();
		var request = {
			chaincodeId : 'example',
			fcn: 'move',
			args: ['a', 'b','100'],
			txId: tx_id
			//targets - Letting default to all endorsing peers defined on the channel in the network configuration
		};

		return channel.sendTransactionProposal(request); //logged in as org2 user
	}).then((results) => {
		var proposalResponses = results[0];
		var proposal = results[1];
		var all_good = true;
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
		var request = {
			proposalResponses: proposalResponses,
			proposal: proposal,
			admin : true
		};

		var promises = [];
		promises.push(channel.sendTransaction(request));

		// be sure to get an eventhub the current user is authorized to use
		var eventhub = client.getEventHub('peer0.org2.example.com');
		eventhub.connect();

		let txPromise = new Promise((resolve, reject) => {
			let handle = setTimeout(() => {
				eventhub.disconnect();
				t.fail('REQUEST_TIMEOUT --- eventhub did not report back');
				reject(new Error('REQUEST_TIMEOUT:' + eventhub._ep._endpoint.addr));
			}, 30000);

			eventhub.registerTxEvent(query_tx_id, (tx, code) => {
				clearTimeout(handle);
				eventhub.disconnect();

				if (code !== 'VALID') {
					t.fail('transaction was invalid, code = ' + code);
					reject(new Error('INVALID:' + code));
				} else {
					t.pass('transaction has been committed on peer ' + eventhub._ep._endpoint.addr);
					resolve();
				}
			});
		});
		promises.push(txPromise);

		return Promise.all(promises);
	}).then((results) => {
		return results[0]; // the first returned value is from the 'sendTransaction()' call
	}).then((response) => {
		if (!(response instanceof Error) && response.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to invoke the chaincode to the orderer.');

			return;
		} else {
			t.fail('Failed to order the transaction to invoke the chaincode. Error code: ' + response.status);
			throw new Error('Failed to order the transaction to invoke the chaincode. Error code: ' + response.status);
		}
	}).then((results) => {
		t.pass('Successfully moved to take place');

		// check that we can get the user again without password
		// also verifies that we can get a complete user properly stored
		// when using a network config
		return client.setUserContext({username:'admin'});
	}).then((admin) => {
		t.pass('Successfully loaded user \'admin\' from store for org2');

		var request = {
			chaincodeId : 'example',
			fcn: 'query',
			args: ['b']
		};

		return channel.queryByChaincode(request); //logged in as user on org1
	}).then((response_payloads) => {
		if (response_payloads) {
			for(let i = 0; i < response_payloads.length; i++) {
				t.equal(
					response_payloads[i].toString('utf8'),
					'300',
					'checking query results are correct that user b has 300 now after the move');
			}
		} else {
			t.fail('response_payloads is null');
			throw new Error('Failed to get response on query');
		}

		var memoryUsage = process.memoryUsage();
		logger.debug(' Memory usage :: %j',memoryUsage);

		return client.queryChannels('peer0.org2.example.com');
	}).then((results) => {
		logger.debug(' queryChannels ::%j',results);
		let found = false;
		for(let i in results.channels) {
			logger.debug(' queryChannels has found %s', results.channels[i].channel_id);
			if(results.channels[i].channel_id === channel_name) {
				found = true;
			}
		}
		if(found) {
			t.pass('Successfully found our channel in the result list');
		} else {
			t.fail('Failed to find our channel in the result list');
		}

		return client.queryInstalledChaincodes('peer0.org2.example.com', true); // use admin
	}).then((results) => {
		logger.debug(' queryInstalledChaincodes ::%j',results);
		let found = false;
		for(let i in results.chaincodes) {
			logger.debug(' queryInstalledChaincodes has found %s', results.chaincodes[i].name);
			if(results.chaincodes[i].name === 'example') {
				found = true;
			}
		}
		if(found) {
			t.pass('Successfully found our chaincode in the result list');
		} else {
			t.fail('Failed to find our chaincode in the result list');
		}

		return channel.queryBlock(1);
	}).then((results) => {
		logger.debug(' queryBlock ::%j',results);
		t.equals(1, results.header.number.low, 'Should be able to find our block number');

		return channel.queryInfo();
	}).then((results) => {
		logger.debug(' queryInfo ::%j',results);
		t.equals(3, results.height.low, 'Should be able to find our block height');

		return channel.queryBlockByHash(results.previousBlockHash);
	}).then((results) => {
		logger.debug(' queryBlockHash ::%j',results);
		t.equals(1, results.header.number.low, 'Should be able to find our block number by hash');

		return channel.queryTransaction(query_tx_id);
	}).then((results) => {
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode');

		return channel.queryBlock(1,'peer0.org1.example.com');
	}).then((results) => {
		logger.debug(' queryBlock ::%j',results);
		t.equals(1, results.header.number.low, 'Should be able to find our block number with string peer name');

		return channel.queryInfo('peer0.org1.example.com');
	}).then((results) => {
		logger.debug(' queryInfo ::%j',results);
		t.equals(3, results.height.low, 'Should be able to find our block height with string peer name');

		return channel.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com');
	}).then((results) => {
		logger.debug(' queryBlockHash ::%j',results);
		t.equals(1, results.header.number.low, 'Should be able to find our block number by hash with string peer name');

		return channel.queryTransaction(query_tx_id,'peer0.org1.example.com');
	}).then((results) => {
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode with string peer name');

		return channel.queryBlock(1,'peer0.org1.example.com', true);
	}).then((results) => {
		logger.debug(' queryBlock ::%j',results);
		t.equals(1, results.header.number.low, 'Should be able to find our block number by admin');

		return channel.queryInfo('peer0.org1.example.com', true);
	}).then((results) => {
		logger.debug(' queryInfo ::%j',results);
		t.equals(3, results.height.low, 'Should be able to find our block height by admin');

		return channel.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com', true);
	}).then((results) => {
		logger.debug(' queryBlockHash ::%j',results);
		t.equals(1, results.header.number.low, 'Should be able to find our block number by hash by admin');

		return channel.queryTransaction(query_tx_id,'peer0.org1.example.com', true);
	}).then((results) => {
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode by admin');

		return true;
	}).then((results) => {
		var memoryUsage = process.memoryUsage();
		logger.debug(' Memory usage :: %j',memoryUsage);

		t.end();
	}).catch((error) =>{
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
		t.end();
	});
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
