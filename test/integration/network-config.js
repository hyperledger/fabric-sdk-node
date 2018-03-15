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
var logger = utils.getLogger('connection profile');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Client = require('fabric-client');
var util = require('util');
var fs = require('fs');
var fsx = require('fs-extra');

var path = require('path');
var grpc = require('grpc');

var testUtil = require('../unit/util.js');


test('\n\n***** clean up the connection profile testing stores  *****\n\n', function(t) {
	/*
	 * The following is just testing housekeeping... cleanup from the last time
	 * this test was run, a real application would not do this.
	 */
	let client = Client.loadFromConfig('test/fixtures/org1.yaml');
	let client_config = client.getClientConfig();

	let store_path = client_config.credentialStore.path;
	logger.debug('removing org1 credentialStore %s',store_path);
	fsx.removeSync(store_path);

	let crypto_path = client_config.credentialStore.cryptoStore.path;
	logger.debug('removing org1 cryptoStore %s',crypto_path);
	fsx.removeSync(crypto_path);

	client.loadFromConfig('test/fixtures/org2.yaml');
	client_config = client.getClientConfig();

	store_path = client_config.credentialStore.path;
	logger.debug('removing org2 credentialStore %s',store_path);
	fsx.removeSync(store_path);

	crypto_path = client_config.credentialStore.cryptoStore.path;
	logger.debug('removing org2 cryptoStore %s',crypto_path);
	fsx.removeSync(crypto_path);

	t.pass('Successfully removed all connection profile stores from previous testing');

	t.end();
});

test('\n\n***** use the connection profile file  *****\n\n', function(t) {
	var channel_name = 'mychannel2';
	testUtil.resetDefaults();

	// build a 'Client' instance that knows the connection profile
	//  this connection profile does not have the client information, we will
	//  load that later so that we can switch this client to be in a different
	//  organization.
	var client_org1 = Client.loadFromConfig('test/fixtures/network.yaml');
	var client_org2 = Client.loadFromConfig('test/fixtures/network.yaml');
	t.pass('Successfully loaded a connection profile');

	var config = null;
	var signatures = [];
	var genesis_block = null;
	var channel_on_org1 = null;
	var channel_on_org2 = null;
	var query_tx_id = null;
	var instansiate_tx_id = null;

	// Load the client information for an organization.
	// The file only has the client section.
	// A real application might do this when a new user logs in.
	client_org1.loadFromConfig('test/fixtures/org1.yaml');
	client_org2.loadFromConfig('test/fixtures/org2.yaml');

	// tell this client instance where the state and key stores are located
	client_org1.initCredentialStores()
	.then((nothing) => {
		t.pass('Successfully created the key value store and crypto store based on the sdk config and connection profile');

		// get the CA associated with this client's organization
		let caService = client_org1.getCertificateAuthority();
		t.equals(caService._fabricCAClient._caName,'ca-org1', 'checking that caname is correct after resetting the config');

		let request = {
			enrollmentID: 'admin',
			enrollmentSecret: 'adminpw',
			profile: 'tls'
		};
		return caService.enroll(request);
	}).then((enrollment) => {
		t.pass('Successfully called the CertificateAuthority to get the TLS material');
		let key = enrollment.key.toBytes();
		let cert = enrollment.certificate;

		// set the material on the client to be used when building endpoints for the user
		client_org1.setTlsClientCertAndKey(cert, key);

		// tell this client instance where the state and key stores are located
		return client_org2.initCredentialStores();
	}).then((nothing) => {
		t.pass('Successfully created the key value store and crypto store based on the sdk config and connection profile');

		// get the CA associated with this client's organization
		let caService = client_org2.getCertificateAuthority();
		t.equals(caService._fabricCAClient._caName,'ca-org2', 'checking that caname is correct after resetting the config');
		let request = {
			enrollmentID: 'admin',
			enrollmentSecret: 'adminpw',
			profile: 'tls'
		};
		return caService.enroll(request);
	}).then((enrollment) => {
		t.pass('Successfully called the CertificateAuthority to get the TLS material');
		let key = enrollment.key.toBytes();
		let cert = enrollment.certificate;

		// set the material on the client to be used when building endpoints for the user
		client_org2.setTlsClientCertAndKey(cert, key);

		// get the config envelope created by the configtx tool
		let envelope_bytes = fs.readFileSync(path.join(__dirname, '../fixtures/channel/mychannel2.tx'));
		// have the sdk get the config update object from the envelope generated by configtxgen
		// the config update object is what is required to be signed by all
		// participating organizations
		config = client_org1.extractChannelConfig(envelope_bytes);
		t.pass('Successfully extracted the config update from the configtx envelope');

		// Sign the config bytes
		// ---- the signChannelConfig() will have the admin identity sign the
		//      config if the client instance has been assigned an admin otherwise
		//      it will use the currently user context assigned. When loading a
		//      connection profile that has a client section that also has
		//      an admin defined for the organization defined in that client
		//      section it will be automatically assigned to the client instance.
		let signature1 = client_org1.signChannelConfig(config);
		// convert signature to a storable string
		// fabric-client SDK will convert any strings it finds back
		// to GRPC protobuf objects during the channel create
		let string_signature1 = signature1.toBuffer().toString('hex');
		t.pass('Successfully signed config update by org1');
		// collect signature from org1 admin
		signatures.push(string_signature1);

		// sign the config by admin from org2
		let signature2 = client_org2.signChannelConfig(config);
		t.pass('Successfully signed config update for org2');

		// collect the signature from org2's admin
		signatures.push(signature2);

		// now we have enough signatures...

		// get an admin based transaction
		// in this case we are assuming that the connection profile
		// has an admin defined for the current organization defined in the
		// client part of the connection profile, otherwise the setAdminSigningIdentity()
		// method would need to be called to setup the admin. If no admin is in the config
		// or has been assigned the transaction will based on the current user.
		let tx_id = client_org2.newTransactionID(true);
		// build up the create request
		let request = {
			config: config,
			signatures : signatures,
			name : channel_name,
			orderer : 'orderer.example.com', //this assumes we have loaded a connection profile
			txId  : tx_id
		};

		// send create request to orderer
		return client_org2.createChannel(request); //admin from org2
	}).then((result) => {
		logger.debug('\n***\n completed the create \n***\n');

		logger.debug(' response ::%j',result);
		t.pass('Successfully created the channel.');
		if(result.status && result.status === 'SUCCESS') {
			return sleep(10000);
		} else {
			t.fail('Failed to create the channel. ');
			throw new Error('Failed to create the channel. ');
		}
	}).then((nothing) => {
		t.pass('Successfully waited to make sure new channel was created on orderer.');

		// have the clients build a channel with all peers and orderers
		channel_on_org1 = client_org1.getChannel(channel_name);
		channel_on_org2 = client_org2.getChannel(channel_name);

		// get an admin based transaction
		let tx_id = client_org2.newTransactionID(true);
		let request = {
			txId : 	tx_id
		};

		return channel_on_org2.getGenesisBlock(request); //admin from org2
	}).then((block) =>{
		t.pass('Successfully got the genesis block');
		genesis_block = block;

		let tx_id = client_org2.newTransactionID(true);
		let request = {
			//targets: // this time we will leave blank so that we can use
				       // all the peers assigned to the channel ...some may fail
				       // if the submitter is not allowed, let's see what we get
			block : genesis_block,
			txId : 	tx_id
		};

		return channel_on_org2.joinChannel(request); //admin from org2
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


		let tx_id = client_org1.newTransactionID(true);
		let request = {
			targets: ['peer0.org1.example.com'], // this does assume that we have loaded a
			                                     // connection profile with a peer by this name
			block : genesis_block,
			txId : 	tx_id
		};

		return channel_on_org1.joinChannel(request);
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

		process.env.GOPATH = path.join(__dirname, '../fixtures');
		let tx_id = client_org1.newTransactionID(true);
		// send proposal to endorser
		let request = {
			//targets: get peers for this clients organization
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			chaincodePackage: '',
			txId : tx_id
		};

		return client_org1.installChaincode(request);
	}).then((results) => {
		if(results && results[0] && results[0][0].response && results[0][0].response.status == 200) {
			t.pass('Successfully installed chain code on org1');
		} else {
			t.fail(' Failed to install chaincode on org1');
			throw new Error('Failed to install chain code on org1');
		}

		let tx_id = client_org2.newTransactionID(true); // be sure to get a admin transaction ID
		// send proposal to endorser
		let request = {
			targets: ['peer0.org2.example.com'],
			chaincodePath: 'github.com/example_cc',
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			chaincodePackage: '',
			txId : tx_id
		};

		return client_org2.installChaincode(request);
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

		let tx_id = client_org1.newTransactionID(true);
		instansiate_tx_id = tx_id;
		let request = {
			chaincodeId: 'example',
			chaincodeVersion: 'v1',
			args: ['a', '100', 'b', '200'],
			txId: tx_id
			// targets is not required, however the logged in user may not have
			// admin access to all the peers defined in the connection profile
			//targets: ['peer0.org1.example.com'],
		};

		return channel_on_org1.sendInstantiateProposal(request);
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
				//          connection profile for this channel will be used
			};

			return channel_on_org1.sendTransaction(request);
		} else {
			t.fail('Failed to send  Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}).then((response) => {
		if (!(response instanceof Error) && response.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to instantiate the chaincode to the orderer.');
			return sleep(10000);
		} else {
			t.fail('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
			throw new Error('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
		}
	}).then((results) => {
		t.pass('Successfully waited for chaincode to startup');

		// this will enroll the user using the ca as defined in the connection profile
		// for this organization and then set in on the client as the current user context
		return client_org1.setUserContext({username:'admin', password:'adminpw'});
	}).then((admin) => {
		t.pass('Successfully enrolled user \'admin\' for org1');

		let ca1 = client_org1.getCertificateAuthority();
		return ca1.register({enrollmentID: 'user1', affiliation: 'org1'}, admin);
	}).then((secret) => {
		t.pass('Successfully registered user \'user1\' for org1');

		return client_org1.setUserContext({username:'user1', password:secret});
	}).then((user)=> {
		t.pass('Successfully enrolled user \'user1\' for org1');

		// try again ...this time use a longer timeout
		let tx_id = client_org1.newTransactionID(); // get a non admin transaction ID
		query_tx_id = tx_id.getTransactionID(); //save transaction string for later
		let request = {
			chaincodeId : 'example',
			fcn: 'move',
			args: ['a', 'b','100'],
			txId: tx_id
			//targets - Letting default to all endorsing peers defined on the channel in the connection profile
		};

		return channel_on_org1.sendTransactionProposal(request); //logged in as org1 user
	}).then((results) => {
		let proposalResponses = results[0];
		let proposal = results[1];
		let all_good = true;
		// Will check to be sure that we see two responses as there are two peers defined on this
		// channel that are endorsing peers
		let endorsed_responses = 0;
		for(let i in proposalResponses) {
			let one_good = false;
			endorsed_responses++;
			let proposal_response = proposalResponses[i];
			if( proposal_response.response && proposal_response.response.status === 200) {
				t.pass('transaction proposal has response status of good');
				one_good = true;
			} else {
				t.fail('transaction proposal was bad');
				if( proposal_response.response && proposal_response.response.status) {
					t.comment(' response status:' + proposal_response.response.status +
					' message:' + proposal_response.response.message);
				} else {
					t.fail('transaction response was unknown' );
					logger.error('transaction response was unknown %s', proposal_response);
				}
			}
			all_good = all_good & one_good;
		}
		t.equals(endorsed_responses, 2, 'Checking that there are the correct number of endorsed responses');
		if (!all_good) {
			t.fail('Failed to send invoke Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send invoke Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
		let request = {
			proposalResponses: proposalResponses,
			proposal: proposal,
			admin : true
		};

		let promises = [];

		// be sure to get an channel event hub the current user is authorized to use
		let eventhub = channel_on_org1.newChannelEventHub('peer0.org1.example.com');

		let txPromise = new Promise((resolve, reject) => {
			let handle = setTimeout(() => {
				eventhub.unregisterTxEvent(query_tx_id);
				eventhub.disconnect();
				t.fail('REQUEST_TIMEOUT --- eventhub did not report back');
				reject(new Error('REQUEST_TIMEOUT:' + eventhub._ep._endpoint.addr));
			}, 30000);

			eventhub.registerTxEvent(query_tx_id, (tx, code, block_num) => {
				clearTimeout(handle);
				if (code !== 'VALID') {
					t.fail('transaction was invalid, code = ' + code);
					reject(new Error('INVALID:' + code));
				} else {
					t.pass('transaction has been committed on peer ' + eventhub.getPeerAddr());
					resolve('COMMITTED');
				}
			}, (error) => {
				clearTimeout(handle);
				t.fail('transaction event failed:' + error);
				reject(error);
			},
				{disconnect: true} //since this is a test and we will not be using later
			);
		});
		// connect(true) to receive full blocks (user must have read rights to the channel)
		// should connect after registrations so that there is an error callback
		// to receive errors if there is a problem on the connect.
		eventhub.connect(true);

		promises.push(txPromise);
		promises.push(channel_on_org1.sendTransaction(request));

		return Promise.all(promises);
	}).then((results) => {
		let event_results = results[0]; // Promise all will return the results in order of the of Array
		let sendTransaction_results = results[1];
		if (sendTransaction_results instanceof Error) {
			t.fail('Failed to order the transaction: ' + sendTransaction_results);
			throw sendTransaction_results;
		} else if (sendTransaction_results.status === 'SUCCESS') {
			t.pass('Successfully sent transaction to invoke the chaincode to the orderer.');
		} else {
			t.fail('Failed to order the transaction to invoke the chaincode. Error code: ' + sendTransaction_results.status);
			throw new Error('Failed to order the transaction to invoke the chaincode. Error code: ' + sendTransaction_results.status);
		}

		return new Promise((resolve, reject) => {
			// get a new ChannelEventHub when registering a listener
			// with startBlock or endBlock when doing a replay
			// The ChannelEventHub must not have been connected or have other
			// listeners.
			let channel_event_hub = channel_on_org1.newChannelEventHub('peer0.org1.example.com');

			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive replay the event for event1');
				channel_event_hub.unregisterTxEvent(query_tx_id);
				channel_event_hub.disconnect(); //shutdown down since we are done
			}, 10000);

			channel_event_hub.registerTxEvent(query_tx_id, (txnid, code, block_num) => {
				clearTimeout(handle);
				t.pass('Event has been replayed with transaction code:'+ code + ' for transaction id:'+ txnid + ' for block_num:' + block_num);
				resolve('Got the replayed transaction');
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to receive event replay for Event for transaction id ::'+query_tx_id);
				throw(error);
			},
				// a real application would have remembered the last block number
				// received and used that value to start the replay
				// Setting the disconnect to true as we do not want to use this
				// ChannelEventHub after the event we are looking for comes in
				{startBlock : 0, disconnect: true}
			);
			t.pass('Successfully registered transaction replay for '+query_tx_id);

			channel_event_hub.connect(); //connect to receive filtered blocks
			t.pass('Successfully called connect on the transaction replay event hub for filtered blocks');
		});
	}).then((results) => {
		t.pass('Successfully checked channel event hub replay');

		return new Promise((resolve, reject) => {
			// Get the list of channel event hubs for the current organization.
			// These will be peers with the "eventSource" role setting of true
			// and not the peers that have an "eventURL" defined. Peers with the
			// eventURL defined are peers with the legacy Event Hub that is on
			// a different port than the peer services. The peers with the
			// "eventSource" tag are running the channel-based event service
			// on the same port as the other peer services.
			let channel_event_hubs = channel_on_org1.getChannelEventHubsForOrg();
			// we should have the an channel event hub defined on the "peer0.org1.example.com"
			t.equals(channel_event_hubs.length,1,'Checking that the channel event hubs has just one');

			let channel_event_hub = channel_event_hubs[0];
			t.equals(channel_event_hub.getPeerAddr(),'localhost:7051',' channel event hub address ');

			let handle = setTimeout(() => {
				t.fail('Timeout - Failed to receive replay the event for event1');
				channel_event_hub.unregisterTxEvent(query_tx_id);
				channel_event_hub.disconnect(); //shutdown down since we are done
			}, 10000);

			channel_event_hub.registerTxEvent(query_tx_id, (txnid, code, block_num) => {
				clearTimeout(handle);
				t.pass('Event has been replayed with transaction code:'+ code + ' for transaction id:'+ txnid + ' for block_num:' + block_num);
				resolve('Got the replayed transaction');
			}, (error) => {
				clearTimeout(handle);
				t.fail('Failed to receive event replay for Event for transaction id ::'+query_tx_id);
				throw(error);
			},
				// a real application would have remembered the last block number
				// received and used that value to start the replay
				// Setting the disconnect to true as we do not want to use this
				// ChannelEventHub after the event we are looking for comes in
				{startBlock : 0, disconnect: true}
			);
			t.pass('Successfully registered transaction replay for '+query_tx_id);

			channel_event_hub.connect(); //connect to receive filtered blocks
			t.pass('Successfully called connect on the transaction replay event hub for filtered blocks');
		});
	}).then((results) => {
		t.pass('Successfully checked replay');
		// check that we can get the user again without password
		// also verifies that we can get a complete user properly stored
		// when using a connection profile
		return client_org1.setUserContext({username:'admin'});
	}).then((admin) => {
		t.pass('Successfully loaded user \'admin\' from store for org1');

		var request = {
			chaincodeId : 'example',
			fcn: 'query',
			args: ['b']
		};

		return channel_on_org1.queryByChaincode(request); //logged in as user on org1
	}).then((response_payloads) => {
		// should only be one response ...as only one peer is defined as CHAINCODE_QUERY_ROLE
		var query_responses = 0;
		if (response_payloads) {
			for(let i = 0; i < response_payloads.length; i++) {
				query_responses++;
				t.equal(
					response_payloads[i].toString('utf8'),
					'300',
					'checking query results are correct that user b has 300 now after the move');
			}
		} else {
			t.fail('response_payloads is null');
			throw new Error('Failed to get response on query');
		}
		t.equals(query_responses,1,'Checking that only one response was seen');

		return client_org1.queryChannels('peer0.org1.example.com');
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

		return client_org1.queryInstalledChaincodes('peer0.org1.example.com', true); // use admin
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

		return channel_on_org1.queryBlock(1);
	}).then((results) => {
		logger.debug(' queryBlock ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number');

		return channel_on_org1.queryInfo();
	}).then((results) => {
		logger.debug(' queryInfo ::%j',results);
		t.equals(3, results.height.low, 'Should be able to find our block height');

		return channel_on_org1.queryBlockByHash(results.previousBlockHash);
	}).then((results) => {
		logger.debug(' queryBlockHash ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number by hash');

		return channel_on_org1.queryTransaction(query_tx_id);
	}).then((results) => {
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode');

		return channel_on_org1.queryBlock(1,'peer0.org1.example.com');
	}).then((results) => {
		logger.debug(' queryBlock ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number with string peer name');

		return channel_on_org1.queryInfo('peer0.org1.example.com');
	}).then((results) => {
		logger.debug(' queryInfo ::%j',results);
		t.equals(3, results.height.low, 'Should be able to find our block height with string peer name');

		return channel_on_org1.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com');
	}).then((results) => {
		logger.debug(' queryBlockHash ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number by hash with string peer name');

		return channel_on_org1.queryTransaction(query_tx_id,'peer0.org1.example.com');
	}).then((results) => {
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode with string peer name');

		return channel_on_org1.queryBlock(1,'peer0.org1.example.com', true);
	}).then((results) => {
		logger.debug(' queryBlock ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number by admin');

		return channel_on_org1.queryInfo('peer0.org1.example.com', true);
	}).then((results) => {
		logger.debug(' queryInfo ::%j',results);
		t.equals(3, results.height.low, 'Should be able to find our block height by admin');

		return channel_on_org1.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com', true);
	}).then((results) => {
		logger.debug(' queryBlockHash ::%j',results);
		t.equals('1', results.header.number, 'Should be able to find our block number by hash by admin');

		return channel_on_org1.queryTransaction(query_tx_id,'peer0.org1.example.com', true);
	}).then((results) => {
		logger.debug(' queryTransaction ::%j',results);
		t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode by admin');

		let tx_id = client_org1.newTransactionID(); // get a non admin transaction ID
		var request = {
			chaincodeId : 'example',
			fcn: 'move',
			args: ['a', 'b','100'],
			txId: tx_id
			//targets - Letting default to all endorsing peers defined on the channel in the connection profile
		};

		// put in a very small timeout to force a failure, thereby checking that the timeout value was being used
		return channel_on_org1.sendTransactionProposal(request, 1); //logged in as org1 user
	}).then((results) => {
		var proposalResponses = results[0];
		for(var i in proposalResponses) {
			let proposal_response = proposalResponses[i];
			if( proposal_response instanceof Error && proposal_response.toString().indexOf('REQUEST_TIMEOUT') > 0) {
				t.pass('Successfully cause a timeout error by setting the timeout setting to 1');
			} else {
				t.fail('Failed to get the timeout error');
			}
		}

		return true;
	}).then((results) => {
		t.pass('Testing has completed successfully');

		t.end();
	}).catch((error) =>{
		logger.error('catch connection profile test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
		t.end();
	});
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
