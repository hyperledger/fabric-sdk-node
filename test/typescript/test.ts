/**
 * Copyright Zhao Chaoyi. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import * as test from 'tape';
import * as fs from 'fs-extra';
import * as util from 'util';

import Client = require('fabric-client');
import FabricCAServices = require('fabric-ca-client');

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('connection profile');

import {
	ConfigSignature,
	TransactionId,
	ChannelRequest,
	BroadcastResponse,
	Channel,
	OrdererRequest,
	JoinChannelRequest,
	Block,
	ProposalResponse,
	ChaincodeInstallRequest,
	ProposalResponseObject,
	ChaincodeInstantiateUpgradeRequest,
	TransactionRequest,
	User,
	ChaincodeInvokeRequest,
	Proposal,
	ChannelEventHub,
	ChaincodeQueryRequest,
	ChannelQueryResponse,
	ChaincodeQueryResponse,
	BlockchainInfo,
	Peer,
	Orderer,
	EventHub,
	ICryptoSuite,
	ICryptoKeyStore,
} from 'fabric-client';
import { IEnrollmentRequest } from 'fabric-ca-client';

const config_network: string = path.resolve(__dirname, 'test/fixtures/network.yaml');
const config_org1: string = path.resolve(__dirname, 'test/fixtures/org1.yaml');
const config_org2: string = path.resolve(__dirname, 'test/fixtures/org2.yaml');
const channel_name: string = 'mychannel';

test('test Peer', (t) => {
	let client: Client = new Client();
	t.equal(client.constructor.name, 'Client');

	let p: Peer = client.newPeer('grpc://localhost:7051');
	t.equal(p.constructor.name, 'Peer');

	p = new Peer('grpc://localhost:7051');
	t.equal(p.constructor.name, 'Peer');

	let u: User = new User('testUser');
	t.equal(u.constructor.name, 'User');

	let o: Orderer = new Orderer('grpc://localhost:7050');
	t.equal(o.constructor.name, 'Orderer');

	o = client.newOrderer('grpc://localhost:7050');
	t.equal(o.constructor.name, 'Orderer');

	let channel: Channel = new Channel('mychannel', client);
	t.equal(channel.constructor.name, 'Channel');

	let eh = new EventHub(client);
	t.equal(eh.constructor.name, 'EventHub');

	let ceh = new ChannelEventHub(channel, p);
	t.equal(ceh.constructor.name, 'ChannelEventHub');

	t.pass('Pass all Class check');
	t.end();
});

test('test-crypto-key-store', (t) => {
	const store:ICryptoKeyStore = Client.newCryptoKeyStore();
	const cryptoSuite: ICryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(store);
	t.end()
})

test('use the connection profile file', (t) => {
	const client = Client.loadFromConfig(config_network);
	t.pass('Successfully load config from network.yaml');

	client.loadFromConfig(config_org1);

	let config = null;
	let signatures = [];
	let channel: Channel = null;
	let genesis_block: any = null;
	let instansiate_tx_id: TransactionId = null;
	let query_tx_id: string = null;

	client.initCredentialStores()
		.then(() => {
			t.pass('Successfully created the key value store and crypto store based on the sdk config and connection profile');
			const fabca: FabricCAServices = client.getCertificateAuthority();
			const req: IEnrollmentRequest = {
				enrollmentID: 'admin',
				enrollmentSecret: 'adminpw',
				profile: 'tls'
			};
			return fabca.enroll(req);
		}).then((enrollment: FabricCAServices.IEnrollResponse) => {
			t.pass('Successfully called the CertificateAuthority to get the TLS material');
			const key = enrollment.key.toBytes();
			const cert = enrollment.certificate;

			// set the material on the client to be used when building endpoints for the user
			client.setTlsClientCertAndKey(cert, key);

			let envelope_bytes = fs.readFileSync(path.join(__dirname, '../../fixtures/channel/mychannel3.tx'));
			config = client.extractChannelConfig(envelope_bytes);

			let signature: ConfigSignature = client.signChannelConfig(config);

			let string_signature = signature.toBuffer().toString('hex');
			t.pass('Successfully signed config update by org1');
			// collect signature from org1 admin
			signatures.push(string_signature);
			t.pass('Successfully extracted the config update from the configtx envelope');
			return client.loadFromConfig(config_org2);
		}).then(() => {
			t.pass('Successfully loaded the client configuration for org2');

			return client.initCredentialStores();
		}).then(() => {
			t.pass('Successfully set the stores for org2');
			let signature: ConfigSignature = client.signChannelConfig(config);
			let string_signature: string = signature.toBuffer().toString('hex');
			t.pass('Successfully signed config update by org2');
			// collect signature from org1 admin
			signatures.push(signature);
			t.pass('Successfully extracted the config update from the configtx envelope');

			let txId: TransactionId = client.newTransactionID(true);
			// build up the create request
			let request: ChannelRequest = {
				config,
				signatures,
				txId,
				name: channel_name,
				orderer: 'orderer.example.com', //this assumes we have loaded a connection profile
			};
			return client.createChannel(request); //logged in as org2
		}).then((result: BroadcastResponse) => {
			logger.debug('\n***\n completed the create \n***\n');

			logger.debug(' response ::%j',result);
			t.pass('Successfully send create channel request');
			if (result.status && result.status === 'SUCCESS') {
				return sleep(10000);
			} else {
				t.fail('Failed to create the channel');
				throw new Error('Failed to create the channel. ');
			}
		}).then(() => {
			t.pass('Successfully waited to make sure new channel was created.');
			channel = client.getChannel(channel_name);

			let txId = client.newTransactionID(true);
			let request: OrdererRequest = { txId };
			return channel.getGenesisBlock(request);
		}).then((block: Block) => {
			t.pass('Successfully got the genesis block');
			genesis_block = block;

			let txId: TransactionId = client.newTransactionID(true);
			let request: JoinChannelRequest = {
				//targets: // this time we will leave blank so that we can use
				// all the peers assigned to the channel ...some may fail
				// if the submitter is not allowed, let's see what we get
				block,
				txId
			};
			return channel.joinChannel(request); //admin from org2
		}).then((results: ProposalResponse[]) => {
			// first of the results should not have good status as submitter does not have permission
			if (results && results[0] && results[0].response && results[0].response.status == 200) {
				t.fail('Successfully had peer in organization org1 join the channel');
				throw new Error('Should not have been able to join channel with this submitter');
			} else {
				t.pass(' Submitter on "org2" Failed to have peer on org1 channel');
			}

			// second of the results should have good status
			if (results && results[1] && results[1].response && results[1].response.status == 200) {
				t.pass('Successfully had peer in organization org1 join the channel');
			} else {
				t.fail(' Failed to join channel');
				throw new Error('Failed to join channel');
			}

			/*
			 * switch to organization org1
			 */
			client.loadFromConfig(config_org1);
			t.pass('Successfully loaded \'admin\' for org1');
			return client.initCredentialStores();
		}).then(() => {
			t.pass('Successfully created the key value store  and crypto store based on the config and connection profile');
			let txId: TransactionId = client.newTransactionID(true);
			let request: JoinChannelRequest = {
				targets: ['peer0.org1.example.com'], // this does assume that we have loaded a
				// connection profile with a peer by this name
				block: genesis_block,
				txId,
			};

			return channel.joinChannel(request); //logged in as org1
		}).then((results: ProposalResponse[]) => {
			if (results && results[0] && results[0].response && results[0].response.status == 200) {
				t.pass(util.format('Successfully had peer in organization %s join the channel', 'org1'));
			} else {
				t.fail(' Failed to join channel on org1');
				throw new Error('Failed to join channel on org1');
			}
			return sleep(10000);
		}).then(() => {
			t.pass('Successfully waited for peers to join the channel');
			process.env.GOPATH = path.join(__dirname, '../../fixtures');
			logger.debug(`Set GOPATH to ${process.env.GOPATH}`);
			let txId: TransactionId = client.newTransactionID(true);
			// send proposal to endorser
			const request: ChaincodeInstallRequest = {
				targets: ['peer0.org1.example.com'],
				chaincodePath: 'github.com/example_cc',
				chaincodeId: 'example',
				chaincodeVersion: 'v1',
				channelNames: 'mychannel3', //targets will based on peers in this channel
				txId,
			};

			return client.installChaincode(request);
		}).then((results: ProposalResponseObject) => {
			if (results && results[0] && results[0][0].response && results[0][0].response.status == 200) {
				t.pass('Successfully installed chain code on org1');
			} else {
				t.fail(' Failed to install chaincode on org1');
				logger.debug('Failed due to: %j', results);
				throw new Error('Failed to install chain code on org1');
			}

			/*
			 *  I N S T A N S I A T E
			 */
			let txId: TransactionId = client.newTransactionID(true);
			instansiate_tx_id = txId;
			let request: ChaincodeInstantiateUpgradeRequest = {
				chaincodeId: 'example',
				chaincodeVersion: 'v1',
				args: ['a', '100', 'b', '200'],
				txId: txId
			};

			return channel.sendInstantiateProposal(request); // still have org2 admin signer
		}).then((results: ProposalResponseObject) => {
			var proposalResponses = results[0];
			var proposal = results[1];
			if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
				t.pass('Successfully sent Proposal and received ProposalResponse');
				var request: TransactionRequest = {
					proposalResponses: proposalResponses,
					proposal: proposal,
					txId: instansiate_tx_id //required to indicate that this is an admin transaction
					//orderer : not specifying, the first orderer defined in the
					//          connection profile for this channel will be used
				};

				return channel.sendTransaction(request); // still have org2 admin as signer
			} else {
				t.fail('Failed to send  Proposal or receive valid response. Response null or status is not 200. exiting...');
				throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
			}
		}).then((response: BroadcastResponse) => {
			if (!(response instanceof Error) && response.status === 'SUCCESS') {
				t.pass('Successfully sent transaction to instantiate the chaincode to the orderer.');
				return sleep(10000);
			} else {
				t.fail('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
				throw new Error('Failed to order the transaction to instantiate the chaincode. Error code: ' + response.status);
			}
		}).then(() => {
			t.pass('Successfully waited for chaincode to startup');

			/*
			 *  S T A R T   U S I N G
			 */
			/*
			 * switch to organization org2
			 */

			client.loadFromConfig('test/fixtures/org2.yaml');

			return client.initCredentialStores();
		}).then(() => {
			t.pass('Successfully created the key value store  and crypto store based on the config and connection profile');

			let ca: FabricCAServices = client.getCertificateAuthority();
			if (ca) {
				t.equals(ca.getCaName(), 'ca-org2', 'checking that caname is correct for the newly created ca');
			} else {
				t.fail('Failed - CertificateAuthority should have been created');
			}

			/*
			 * switch to organization org1
			 */
			client.loadFromConfig('test/fixtures/org1.yaml');
			t.pass('Successfully loaded config for org1');

			return client.initCredentialStores();
		}).then(() => {
			t.pass('Successfully created the key value store and crypto store based on the config and network');

			return client.setUserContext({ username: 'admin', password: 'adminpw' });
		}).then((admin: User) => {
			t.pass('Successfully enrolled user \'admin\' for org1');

			let ca: FabricCAServices = client.getCertificateAuthority();
			if (ca) {
				t.equals(ca.getCaName(), 'ca-org1', 'checking that caname is correct after resetting the config');
			} else {
				t.fail('Failed - CertificateAuthority should have been created');
			}

			return ca.register({ enrollmentID: 'user1', affiliation: 'org1' }, admin);
		}).then((secret: string) => {
			t.pass('Successfully registered user \'user1\' for org1');

			return client.setUserContext({ username: 'user1', password: secret });
		}).then((user: User) => {
			t.pass('Successfully enrolled user \'user1\' for org1');

			// try again ...this time use a longer timeout
			let tx_id: TransactionId = client.newTransactionID(); // get a non admin transaction ID
			query_tx_id = tx_id.getTransactionID(); //save transaction string for later
			let request: ChaincodeInvokeRequest = {
				chaincodeId: 'example',
				fcn: 'move',
				args: ['a', 'b', '100'],
				txId: tx_id
				//targets - Letting default to all endorsing peers defined on the channel in the connection profile
			};

			return channel.sendTransactionProposal(request); //logged in as org1 user
		}).then((results: ProposalResponseObject) => {
			let proposalResponses: ProposalResponse[] = results[0];
			let proposal: Proposal = results[1];
			let all_good = true;
			// Will check to be sure that we see two responses as there are two peers defined on this
			// channel that are endorsing peers
			let endorsed_responses = 0;
			for (let i in proposalResponses) {
				let one_good = false;
				endorsed_responses++;
				let proposal_response: ProposalResponse = proposalResponses[i];
				if (proposal_response.response && proposal_response.response.status === 200) {
					t.pass('transaction proposal has response status of good');
					one_good = true;
				} else {
					t.fail('transaction proposal was bad');
					if (proposal_response.response && proposal_response.response.status) {
						t.comment(' response status:' + proposal_response.response.status +
							' message:' + proposal_response.response.message);
					} else {
						t.fail('transaction response was unknown');
						logger.error('transaction response was unknown %s', proposal_response);
					}
				}
				all_good = all_good && one_good;
			}
			t.equals(endorsed_responses, 2, 'Checking that there are the correct number of endorsed responses');
			if (!all_good) {
				t.fail('Failed to send invoke Proposal or receive valid response. Response null or status is not 200. exiting...');
				throw new Error('Failed to send invoke Proposal or receive valid response. Response null or status is not 200. exiting...');
			}
			let request: TransactionRequest = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				admin: true
			};

			let promises = [];

			// be sure to get an channel event hub the current user is authorized to use
			let eventhub = channel.newChannelEventHub('peer0.org1.example.com');

			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(() => {
					eventhub.unregisterTxEvent(query_tx_id);
					eventhub.disconnect();
					t.fail('REQUEST_TIMEOUT --- eventhub did not report back');
					reject(new Error('REQUEST_TIMEOUT:' + eventhub.getPeerAddr()));
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
					{ disconnect: true } //since this is a test and we will not be using later
				);
			});
			// connect(true) to receive full blocks (user must have read rights to the channel)
			// should connect after registrations so that there is an error callback
			// to receive errors if there is a problem on the connect.
			eventhub.connect(true);

			promises.push(txPromise);
			promises.push(channel.sendTransaction(request));

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
				let channel_event_hub: ChannelEventHub = channel.newChannelEventHub('peer0.org1.example.com');

				let handle = setTimeout(() => {
					t.fail('Timeout - Failed to receive replay the event for event1');
					channel_event_hub.unregisterTxEvent(query_tx_id);
					channel_event_hub.disconnect(); //shutdown down since we are done
				}, 10000);

				channel_event_hub.registerTxEvent(query_tx_id, (txnid, code, block_num) => {
					clearTimeout(handle);
					t.pass('Event has been replayed with transaction code:' + code + ' for transaction id:' + txnid + ' for block_num:' + block_num);
					resolve('Got the replayed transaction');
				}, (error) => {
					clearTimeout(handle);
					t.fail('Failed to receive event replay for Event for transaction id ::' + query_tx_id);
					throw (error);
				},
					// a real application would have remembered the last block number
					// received and used that value to start the replay
					// Setting the disconnect to true as we do not want to use this
					// ChannelEventHub after the event we are looking for comes in
					{ startBlock: 0, disconnect: true }
				);
				t.pass('Successfully registered transaction replay for ' + query_tx_id);

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
				let channel_event_hubs: ChannelEventHub[] = channel.getChannelEventHubsForOrg();
				// we should have the an channel event hub defined on the "peer0.org1.example.com"
				t.equals(channel_event_hubs.length, 1, 'Checking that the channel event hubs has just one');

				let channel_event_hub = channel_event_hubs[0];
				t.equals(channel_event_hub.getPeerAddr(), 'localhost:7051', ' channel event hub address ');

				let handle = setTimeout(() => {
					t.fail('Timeout - Failed to receive replay the event for event1');
					channel_event_hub.unregisterTxEvent(query_tx_id);
					channel_event_hub.disconnect(); //shutdown down since we are done
				}, 10000);

				channel_event_hub.registerTxEvent(query_tx_id, (txnid, code, block_num) => {
					clearTimeout(handle);
					t.pass('Event has been replayed with transaction code:' + code + ' for transaction id:' + txnid + ' for block_num:' + block_num);
					resolve('Got the replayed transaction');
				}, (error) => {
					clearTimeout(handle);
					t.fail('Failed to receive event replay for Event for transaction id ::' + query_tx_id);
					throw (error);
				},
					// a real application would have remembered the last block number
					// received and used that value to start the replay
					// Setting the disconnect to true as we do not want to use this
					// ChannelEventHub after the event we are looking for comes in
					{ startBlock: 0, disconnect: true }
				);
				t.pass('Successfully registered transaction replay for ' + query_tx_id);

				channel_event_hub.connect(); //connect to receive filtered blocks
				t.pass('Successfully called connect on the transaction replay event hub for filtered blocks');
			});
		}).then((results) => {
			t.pass('Successfully checked replay');
			// check that we can get the user again without password
			// also verifies that we can get a complete user properly stored
			// when using a connection profile
			return client.setUserContext({ username: 'admin' });
		}).then((admin: User) => {
			t.pass('Successfully loaded user \'admin\' from store for org1');

			var request: ChaincodeQueryRequest = {
				chaincodeId: 'example',
				fcn: 'query',
				args: ['b']
			};

			return channel.queryByChaincode(request); //logged in as user on org1
		}).then((response_payloads) => {
			// should only be one response ...as only one peer is defined as CHAINCODE_QUERY_ROLE
			var query_responses = 0;
			if (response_payloads) {
				for (let i = 0; i < response_payloads.length; i++) {
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
			t.equals(query_responses, 1, 'Checking that only one response was seen');

			return client.queryChannels('peer0.org1.example.com');
		}).then((results: ChannelQueryResponse) => {
			logger.debug(' queryChannels ::%j', results);
			let found = false;
			for (let i in results.channels) {
				logger.debug(' queryChannels has found %s', results.channels[i].channel_id);
				if (results.channels[i].channel_id === channel_name) {
					found = true;
				}
			}
			if (found) {
				t.pass('Successfully found our channel in the result list');
			} else {
				t.fail('Failed to find our channel in the result list');
			}

			return client.queryInstalledChaincodes('peer0.org1.example.com', true); // use admin
		}).then((results: ChaincodeQueryResponse) => {
			logger.debug(' queryInstalledChaincodes ::%j', results);
			let found = false;
			for (let i in results.chaincodes) {
				logger.debug(' queryInstalledChaincodes has found %s', results.chaincodes[i].name);
				if (results.chaincodes[i].name === 'example') {
					found = true;
				}
			}
			if (found) {
				t.pass('Successfully found our chaincode in the result list');
			} else {
				t.fail('Failed to find our chaincode in the result list');
			}

			return channel.queryBlock(1);
		}).then((results: Block) => {
			logger.debug(' queryBlock ::%j', results);
			t.equals('1', results.header.number, 'Should be able to find our block number');

			return channel.queryInfo();
		}).then((results: BlockchainInfo) => {
			logger.debug(' queryInfo ::%j', results);
			t.equals(3, results.height.low, 'Should be able to find our block height');

			return channel.queryBlockByHash(results.previousBlockHash);
		}).then((results: Block) => {
			logger.debug(' queryBlockHash ::%j', results);
			t.equals('1', results.header.number, 'Should be able to find our block number by hash');

			return channel.queryTransaction(query_tx_id);
		}).then((results) => {
			logger.debug(' queryTransaction ::%j', results);
			t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode');

			return channel.queryBlock(1, 'peer0.org1.example.com');
		}).then((results: Block) => {
			logger.debug(' queryBlock ::%j', results);
			t.equals('1', results.header.number, 'Should be able to find our block number with string peer name');

			return channel.queryInfo('peer0.org1.example.com');
		}).then((results: BlockchainInfo) => {
			logger.debug(' queryInfo ::%j', results);
			t.equals(3, results.height.low, 'Should be able to find our block height with string peer name');

			return channel.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com');
		}).then((results: Block) => {
			logger.debug(' queryBlockHash ::%j', results);
			t.equals('1', results.header.number, 'Should be able to find our block number by hash with string peer name');

			return channel.queryTransaction(query_tx_id, 'peer0.org1.example.com');
		}).then((results) => {
			logger.debug(' queryTransaction ::%j', results);
			t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode with string peer name');

			return channel.queryBlock(1, 'peer0.org1.example.com', true);
		}).then((results: Block) => {
			logger.debug(' queryBlock ::%j', results);
			t.equals('1', results.header.number, 'Should be able to find our block number by admin');

			return channel.queryInfo('peer0.org1.example.com', true);
		}).then((results: BlockchainInfo) => {
			logger.debug(' queryInfo ::%j', results);
			t.equals(3, results.height.low, 'Should be able to find our block height by admin');

			return channel.queryBlockByHash(results.previousBlockHash, 'peer0.org1.example.com', true);
		}).then((results: Block) => {
			logger.debug(' queryBlockHash ::%j', results);
			t.equals('1', results.header.number, 'Should be able to find our block number by hash by admin');

			return channel.queryTransaction(query_tx_id, 'peer0.org1.example.com', true);
		}).then((results) => {
			logger.debug(' queryTransaction ::%j', results);
			t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode by admin');

			let tx_id = client.newTransactionID(); // get a non admin transaction ID
			var request: ChaincodeInvokeRequest = {
				chaincodeId: 'example',
				fcn: 'move',
				args: ['a', 'b', '100'],
				txId: tx_id
				//targets - Letting default to all endorsing peers defined on the channel in the connection profile
			};

			// put in a very small timeout to force a failure, thereby checking that the timeout value was being used
			return channel.sendTransactionProposal(request, 1); //logged in as org1 user
		}).then((results: ProposalResponseObject) => {
			var proposalResponses = results[0];
			for (var i in proposalResponses) {
				let proposal_response = proposalResponses[i];
				if (proposal_response instanceof Error && proposal_response.toString().indexOf('REQUEST_TIMEOUT') > 0) {
					t.pass('Successfully cause a timeout error by setting the timeout setting to 1');
				} else {
					t.fail('Failed to get the timeout error');
				}
			}

			return true;
		}).then(() => {
			t.pass('Testing has completed successfully');
			t.end();
		}).catch((err: Error) => {
			t.fail(err.message);
			t.end();
			throw err;
		})
});

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
