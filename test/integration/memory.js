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
var logger = utils.getLogger('Memory Usage');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Client = require('fabric-client');
var util = require('util');
var fs = require('fs');
var path = require('path');
var grpc = require('grpc');
var heapdump = require('heapdump');

var testUtil = require('../unit/util.js');

/*
	This is a test that may be used to check on memory usage.
	This test must be run with node.js version 8 to get 'async' and 'await' (tested with v8.4.0)
	It will first initialize a channel and then run a set of operations
	any number of times. Heapdumps will be taken at the start, after the first pass,
	and then after the last pass. These will be stored at the current location.
	These dumps may be analyzed by the Chrome dev tools under the memory tab. Load them
	in the order they were created to be able to see object differences.
	During each pass the results of the process.memoryUsage() will be written
	to the file 'test/memory-usage.csv', a csv file may be loaded into
	Excel to create a graph of the usage over time.

	use count=<number> to control the number of pass_results
	use skipcreate=<true> to not create join/create channel and install/start chaincode.

	This test must be started with the --expose-gc or comment out the global.gc() calls.

	node --expose-gc test/integration/memory.js count=1000
	node --expose-gc test/integration/memory.js count=1000 skipcreate=true
*/
test('\n\n***** use the network configuration file  *****\n\n', function(t) {
	looper(t);
	t.end();
});

async function looper(t) {
	//global.gc();
	//heapdump.writeSnapshot();
	var skip = getArg('skipcreate', false);
	if(skip === 'true') skip = true;

	if(!skip) await createChannel(t);
	var count = getArg('count', 1);

	for(let i = 0;i<count; i++) {
		logger.info('\n');
		logger.info('**********************************************');
		logger.info('************ Start pass :: %s ****************',i+1);
		logger.info('*********************************************\n');
		await actions(t);
		if(i==0) {
			//global.gc();
			//heapdump.writeSnapshot();
		}
	}
	//global.gc();
	//heapdump.writeSnapshot();
}

function getArg(arg_name, default_value) {
	let value = default_value;
	try {
		if (process.argv.length > 2) {
			for(let i in process.argv) {
				let arg = process.argv[i];
				if(arg && arg.indexOf(arg_name+'=') === 0) {
					value = arg.split('=')[1];
				}
			}
		}
	} catch(error) {
		logger.error(error);
	}

	return value;
}

async function createChannel(t) {
	logMemory(true);
	Client.setConfigSetting('request-timeout', 60000);
	logger.info('********** start createChannel ***************');

	// build a 'Client' instance that knows the network
	//  this network config does not have the client information, we will
	//  load that later so that we can switch this client to be in a different
	//  organization
	var client = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');

	var channel_name = 'mychannel2';
	var config = null;
	var signatures = [];
	var genesis_block = null;
	var channel = null;
	var query_tx_id = null;
	var instansiate_tx_id = null;
	var results = null;
	var response = null;
	var request = null;
	var tx_id = null;
	var found = null;
	try {
		// lets load the client information for this organization
		// the file only has the client section
		client.loadFromConfig('test/fixtures/org1.yaml');
		t.pass('Successfully loaded client section of network config');

		// tell this client instance where the state and key stores are located
		await client.initCredentialStores();
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

		await client.loadFromConfig('test/fixtures/org2.yaml');
		t.pass('Successfully loaded the client configuration for org2');

		// reset the stores to be using the ones for this organization
		await client.initCredentialStores();
		t.pass('Successfully set the stores for org2');

		// sign the config by admin from org2
		var signature = client.signChannelConfig(config);
		t.pass('Successfully signed config update for org2');

		// collect signature from org2 admin
		signatures.push(signature);

		// now we have enough signatures...

		// get an admin based transaction
		tx_id = client.newTransactionID(true);
		// build up the create request
		request = {
			config: config,
			signatures : signatures,
			name : channel_name,
			orderer : 'orderer.example.com', //this assumes we have loaded a network config
			txId  : tx_id
		};

		// send create request to orderer
		results = await client.createChannel(request); //logged in as org2
		logger.debug('\n***\n completed the create \n***\n');

		logger.debug(' response ::%j',results);
		t.pass('Successfully created the channel.');
		if(results.status && results.status === 'SUCCESS') {
			await sleep(5000);
		} else {
			t.fail('Failed to create the channel. ');
			throw new Error('Failed to create the channel. ');
		}
		t.pass('Successfully waited to make sure new channel was created.');

		// have the client build a channel with all peers and orderers
		channel = client.getChannel(channel_name);

		// get an admin based transaction
		tx_id = client.newTransactionID(true);
		request = {
			txId : 	tx_id
		};

		genesis_block = await channel.getGenesisBlock(request); //admin from org2
		t.pass('Successfully got the genesis block');

		tx_id = client.newTransactionID(true);
		request = {
			//targets: // this time we will leave blank so that we can use
				       // all the peers assigned to the channel ...some may fail
				       // if the submitter is not allowed, let's see what we get
			block : genesis_block,
			txId : 	tx_id
		};

		results = await channel.joinChannel(request, 30000); //admin from org2
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

		await client.initCredentialStores();
		t.pass('Successfully created the key value store  and crypto store based on the config and network config');

		tx_id = client.newTransactionID(true);
		request = {
			targets: ['peer0.org1.example.com'], // this does assume that we have loaded a
			                                     // network config with a peer by this name
			block : genesis_block,
			txId : 	tx_id
		};

		results = await channel.joinChannel(request, 30000); //logged in as org1
		logger.debug(util.format('Join Channel R E S P O N S E  for a string target: %j', results));

		if(results && results[0] && results[0].response && results[0].response.status == 200) {
			t.pass(util.format('Successfully had peer in organization %s join the channel', 'org1'));
		} else {
			t.fail(' Failed to join channel on org1');
			throw new Error('Failed to join channel on org1');
		}
		await sleep(10000);
		t.pass('Successfully waited for peers to join the channel');

		process.env.GOPATH = path.join(__dirname, '../fixtures');
		tx_id = client.newTransactionID(true);
		// send proposal to endorser
		var request = {
			targets: ['peer0.org1.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			chaincodePackage: '',
			txId : tx_id
		};

		results = await client.installChaincode(request); //still logged as org1
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

		await client.initCredentialStores();
		t.pass('Successfully created the key value store  and crypto store based on the config and network config');

		tx_id = client.newTransactionID(true); // be sure to get a admin transaction ID
		// send proposal to endorser
		var request = {
			targets: ['peer0.org2.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			chaincodePackage: '',
			txId : tx_id
		};

		results = await client.installChaincode(request); // org2 admin is the signer
		if(results && results[0] && results[0][0].response && results[0][0].response.status == 200) {
			t.pass('Successfully installed chain code on org2');
		} else {
			t.fail(' Failed to install chaincode');
			throw new Error('Failed to install chain code');
		}

		/*
		 *  I N S T A N S I A T E
		 */

		tx_id = client.newTransactionID(true);
		instansiate_tx_id = tx_id;
		request = {
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			args: ['a', '100', 'b', '200'],
			txId: tx_id
			// targets is not required, however the logged in user may not have
			// admin access to all the peers defined in the network configuration
			//targets: ['peer0.org1.example.com'],
		};

		results = await channel.sendInstantiateProposal(request); // still have org2 admin signer
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

			response = await channel.sendTransaction(request); // still have org2 admin as signer
		} else {
			t.fail('Failed to send  Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}

		if (!(response instanceof Error) && response.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to instantiate the chaincode to the orderer.');
			await sleep(10000); // use sleep for now until the eventhub is integrated into the network config changes
		} else {
			t.fail('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
			throw new Error('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
		}

		t.pass('Successfully waited for chaincodes to startup');


		logMemory();
	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}
	logger.info('********************  end of createChannel *********************');
}

async function actions(t) {
	Client.setConfigSetting('request-timeout', 60000);

	// build a 'Client' instance that knows the network
	//  this network config does not have the client information, we will
	//  load that later so that we can switch this client to be in a different
	//  organization
	var client = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a network configuration');

	var channel_name = 'mychannel2';
	var config = null;
	var signatures = [];
	var genesis_block = null;
	var channel = null;
	var query_tx_id = null;
	var instansiate_tx_id = null;
	var results = null;
	var response = null;
	var request = null;
	var tx_id = null;
	var found = null;
	try {
		// lets load the client information for this organization
		// the file only has the client section
		client.loadFromConfig('test/fixtures/org1.yaml');
		// tell this client instance where the state and key stores are located
		await client.initCredentialStores();
		t.pass('Successfully created the key value store  and crypto store based on the config and network config');
		// have the client build a channel with all peers and orderers
		channel = client.getChannel(channel_name);
		/*
		 *  S T A R T   U S I N G
		 */
		let admin = await client.setUserContext({username:'admin', password: 'adminpw'});
		t.pass('Successfully enrolled user \'admin\' for org1');

		tx_id = client.newTransactionID(); // get a non admin transaction ID
		query_tx_id = tx_id.getTransactionID();
		var request = {
			chaincodeId : 'example',
			fcn: 'move',
			args: ['a', 'b','100'],
			txId: tx_id
			//targets - Letting default to all endorsing peers defined on the channel in the network configuration
		};

		results = await channel.sendTransactionProposal(request); //logged in as org2 user
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
			admin : false
		};

		var eventhub = client.getEventHub('peer0.org1.example.com');

		response = await invoke(t, request, tx_id, client, channel, eventhub); //logged in as org2 user
		if (!(response[0] instanceof Error) && response[0].status === 'SUCCESS') {
			t.pass('Successfully sent transaction to invoke the chaincode to the orderer.');
		} else {
			t.fail('Failed to order the transaction to invoke the chaincode. Error code: ' + response.status);
			throw new Error('Failed to order the transaction to invoke the chaincode. Error code: ' + response.status);
		}

		var request = {
			chaincodeId : 'example',
			fcn: 'query',
			args: ['b']
		};

		let response_payloads = await channel.queryByChaincode(request); //logged in as user on org1
		if (response_payloads) {
			for(let i = 0; i < response_payloads.length; i++) {
				t.pass('Successfully got query results :: '+ response_payloads[i].toString('utf8'));
			}
		} else {
			t.fail('response_payloads is null');
			throw new Error('Failed to get response on query');
		}

		results = await client.queryChannels('peer0.org1.example.com');
		logger.debug(' queryChannels ::%j',results);
		found = false;
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

		results = await client.queryInstalledChaincodes('peer0.org1.example.com', true); // use admin
		logger.debug(' queryInstalledChaincodes ::%j',results);
		found = false;
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

		results = await channel.queryBlock(0);
		logger.debug(' queryBlock ::%j',results);
		t.equals('0', results.header.number, 'Should be able to find our block number');

		results = await channel.queryBlock(1);
		logger.debug(' queryBlock ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number');

		results = await channel.queryInfo();
		logger.debug(' queryInfo ::%j',results);
		t.pass('Successfully got the block height :: '+ results.height);

		results = await channel.queryBlockByHash(results.previousBlockHash);
		logger.debug(' queryBlockHash ::%j',results);
		t.pass('Successfully got block by hash ::'+ results.header.number);

		results = await channel.queryTransaction(query_tx_id);
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode');

		results = await channel.queryBlock(1,'peer0.org1.example.com');
		logger.debug(' queryBlock ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number with string peer name');

		results = await channel.queryInfo('peer0.org1.example.com');
		logger.info(' queryInfo ::%j',results);
		t.pass('Successfully got the block height :: '+ results.height);

		results = await channel.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com');
		logger.debug(' queryBlockHash ::%j',results);
		t.pass('Successfully got block by hash ::'+ results.header.number);

		results = await channel.queryTransaction(query_tx_id,'peer0.org1.example.com');
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode with string peer name');

		results = await channel.queryBlock(1,'peer0.org1.example.com', true);
		logger.debug(' queryBlock ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number by admin');

		results = await channel.queryInfo('peer0.org1.example.com', true);
		logger.debug(' queryInfo ::%j',results);
		t.pass('Successfully got the block height by admin:: '+ results.height);

		results = await channel.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com', true);
		logger.debug(' queryBlockHash ::%j',results);
		t.pass('Successfully got block by hash by admin ::' + results.header.number);

		results = await channel.queryTransaction(query_tx_id,'peer0.org1.example.com', true);
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode by admin');

		// close out connection
		channel.close();

		logMemory();
		//await sleep(2000);
		logger.info('***********  pass all done *************');
	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}
}

function invoke(t, request, tx_id, client, channel, eventhub) {

	var transactionID = tx_id.getTransactionID();
	var promises = [];
	promises.push(channel.sendTransaction(request));

	eventhub.disconnect(); // clean up any old registered events
	eventhub.connect();

	let txPromise = new Promise((resolve, reject) => {
		let handle = setTimeout(() => {
			eventhub.disconnect();
			t.fail('REQUEST_TIMEOUT -- eventhub did not respond');
			reject(new Error('REQUEST_TIMEOUT:' + eventhub._ep._endpoint.addr));
		}, 30000);

		eventhub.registerTxEvent(transactionID, (tx, code) => {
			clearTimeout(handle);
			eventhub.unregisterTxEvent(tx); // if we do not unregister then when
											// when we shutdown the eventhub the
											// error call back will get called
			eventhub.disconnect(); // all done

			if (code !== 'VALID') {
				t.fail('transaction was invalid, code = ' + code);
				reject(new Error('INVALID:' + code));
			} else {
				t.pass('transaction has been committed on peer ' + eventhub._ep._endpoint.addr);
				resolve();
			}
		}, (error) => {
			clearTimeout(handle);

			t.fail('Event registration for this transaction was invalid ::' + error);
			reject(error);
		});
	});
	promises.push(txPromise);

	return Promise.all(promises);
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function logMemory(clean) {
	var memory_usage = process.memoryUsage();
	logger.info(' Memory usage :: %j',memory_usage);
	//info: memory_usage : {"rss":214753280,"heapTotal":55156736,"heapUsed":36789336,"external":5236572}
	let now = new Date();
	let line = now.toString() + ',' + memory_usage.rss + ',' + memory_usage.heapTotal + ',' + memory_usage.heapUsed + ',' + memory_usage.external + '\n';
	let file_path = path.join(__dirname, '../memory-usage.csv');
	if(clean) {
		fs.writeFileSync(file_path, 'time,rss,heapTotal,heapUsed,external\n');
	}
	fs.appendFileSync(file_path, line);
}
