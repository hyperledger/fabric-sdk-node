/**
 * Copyright Zhao Chaoyi. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as test from 'tape';
import * as util from 'util';

import FabricCAServices = require('fabric-ca-client');
import Client = require('fabric-client');

import utils = require('fabric-client/lib/utils');
const logger = utils.getLogger('connection profile');

import { IEnrollmentRequest } from 'fabric-ca-client';
import {
	Block,
	BlockchainInfo,
	BroadcastResponse,
	ChaincodeInstallRequest,
	ChaincodeInstantiateUpgradeRequest,
	ChaincodeInvokeRequest,
	ChaincodeQueryRequest,
	ChaincodeQueryResponse,
	Channel,
	ChannelEventHub,
	ChannelQueryResponse,
	ChannelRequest,
	ConfigSignature,
	ICryptoKeyStore,
	ICryptoSuite,
	JoinChannelRequest,
	Orderer,
	OrdererRequest,
	Peer,
	Proposal,
	ProposalResponse,
	ProposalResponseObject,
	TransactionId,
	TransactionRequest,
	User,
} from 'fabric-client';

const configNetwork: string = path.resolve(__dirname, '../fixtures/network-ts.yaml');
const configOrg1: string = path.resolve(__dirname, '../fixtures/org1.yaml');
const configOrg2: string = path.resolve(__dirname, '../fixtures/org2.yaml');
const channelName: string = 'mychannelts';

test('\n\n ** test TypeScript **', (t: any) => {
	const client: Client = new Client();
	t.equal(client.constructor.name, 'Client');

	let p: Peer = client.newPeer('grpc://localhost:7051');
	t.equal(p.constructor.name, 'Peer');

	p = new Peer('grpc://localhost:7051');
	t.equal(p.constructor.name, 'Peer');

	const u: User = new User('testUser');
	t.equal(u.constructor.name, 'User');

	let o: Orderer = new Orderer('grpc://localhost:7050');
	t.equal(o.constructor.name, 'Orderer');

	o = client.newOrderer('grpc://localhost:7050');
	t.equal(o.constructor.name, 'Orderer');

	const channel: Channel = new Channel('mychannel', client);
	t.equal(channel.constructor.name, 'Channel');

	const ceh = new ChannelEventHub(channel, p);
	t.equal(ceh.constructor.name, 'ChannelEventHub');

	t.pass('Pass all Class check');
	t.end();
});

test('test-crypto-key-store', (t: any) => {
	const store: ICryptoKeyStore = Client.newCryptoKeyStore();
	const cryptoSuite: ICryptoSuite = Client.newCryptoSuite();
	cryptoSuite.setCryptoKeyStore(store);
	t.end();
});

test('use the connection profile file', (t: any) => {
	let client = Client.loadFromConfig(configNetwork);
	t.pass('Successfully load config from network.yaml');

	client.loadFromConfig(configOrg1);

	let config: Buffer;
	const signatures: any[] = [];
	let channel: Channel;
	let genesisBlock: any;
	let instansiateTxId: TransactionId;
	let queryTxId: string;

	client.initCredentialStores()
		.then(() => {
			t.pass('Successfully created the key value store and crypto store based on the sdk config and connection profile');
			const envelopeBytes = fs.readFileSync(path.join(__dirname, '../fixtures/channel/mychannelts.tx'));
			config = client.extractChannelConfig(envelopeBytes);

			const signature: ConfigSignature = client.signChannelConfig(config);

			const stringSignature = signature.toBuffer().toString('hex');
			t.pass('Successfully signed config update by org1');
			// collect signature from org1 admin
			signatures.push(stringSignature);
			t.pass('Successfully extracted the config update from the configtx envelope');
			return client.loadFromConfig(configOrg2);
		}).then(() => {
			t.pass('Successfully loaded the client configuration for org2');

			return client.initCredentialStores();
		}).then(() => {
			t.pass('Successfully set the stores for org2');
			const fabca: FabricCAServices = client.getCertificateAuthority();
			const req: IEnrollmentRequest = {
				enrollmentID: 'admin',
				enrollmentSecret: 'adminpw',
				profile: 'tls',
			};
			return fabca.enroll(req);
		}).then((enrollment: FabricCAServices.IEnrollResponse) => {
			t.pass('Successfully called the CertificateAuthority to get the TLS material for org2');
			const key = enrollment.key.toBytes();
			const cert = enrollment.certificate;

			// set the material on the client to be used when building endpoints for the user
			client.setTlsClientCertAndKey(cert, key);

			const signature: ConfigSignature = client.signChannelConfig(config);
			const stringSignature: string = signature.toBuffer().toString('hex');
			t.pass('Successfully signed config update by org2');
			// collect signature from org2 admin
			signatures.push(signature);
			t.pass('Successfully extracted the config update from the configtx envelope');

			const txId: TransactionId = client.newTransactionID(true);
			// build up the create request
			const request: ChannelRequest = {
				config,
				name: channelName,
				orderer: 'orderer.example.com', //this assumes we have loaded a connection profile
				signatures,
				txId,
			};
			return client.createChannel(request); //logged in as org2
		}).then((result: BroadcastResponse) => {
			logger.debug('\n***\n completed the create \n***\n');

			logger.debug(' response ::%j', result);
			t.pass('Successfully send create channel request');
			if (result.status && result.status === 'SUCCESS') {
				return sleep(10000);
			} else {
				t.fail('Failed to create the channel');
				throw new Error('Failed to create the channel. ');
			}
		}).then(() => {
			t.pass('Successfully waited to make sure new channel was created.');
			channel = client.getChannel(channelName);

			const txId = client.newTransactionID(true);
			const request: OrdererRequest = { txId };
			return channel.getGenesisBlock(request);
		}).then((block: Block) => {
			t.pass('Successfully got the genesis block');
			genesisBlock = block;

			const txId: TransactionId = client.newTransactionID(true);
			const request: JoinChannelRequest = {
				//targets: // this time we will leave blank so that we can use
				// all the peers assigned to the channel ...some may fail
				// if the submitter is not allowed, let's see what we get
				block,
				txId,
			};
			return channel.joinChannel(request); //admin from org2
		}).then((results: ProposalResponse[]) => {
			// first of the results should not have good status as submitter does not have permission
			if (results && results[0] && results[0].response && results[0].response.status === 200) {
				t.fail('Successfully had peer in organization org1 join the channel');
				throw new Error('Should not have been able to join channel with this submitter');
			} else {
				t.pass(' Submitter on "org2" Failed to have peer on org1 channel');
			}

			// second of the results should have good status
			if (results && results[1] && results[1].response && results[1].response.status === 200) {
				t.pass('Successfully had peer in organization org2 join the channel');
			} else {
				t.fail(' Failed to join channel');
				throw new Error('Failed to join channel');
			}

			/*
			 * switch to organization org1 (recreate client)
			 */
			client = Client.loadFromConfig(configNetwork);

			client.loadFromConfig(configOrg1);
			t.pass('Successfully loaded \'admin\' for org1');
			return client.initCredentialStores();
		}).then(() => {
			t.pass('Successfully created the key value store and crypto store based on the config and connection profile');
			const fabca: FabricCAServices = client.getCertificateAuthority();
			const req: IEnrollmentRequest = {
				enrollmentID: 'admin',
				enrollmentSecret: 'adminpw',
				profile: 'tls',
			};
			return fabca.enroll(req);
		}).then((enrollment: FabricCAServices.IEnrollResponse) => {
			t.pass('Successfully called the CertificateAuthority to get the TLS material for org1');
			const key = enrollment.key.toBytes();
			const cert = enrollment.certificate;

			// set the material on the client to be used when building endpoints for the user
			client.setTlsClientCertAndKey(cert, key);
			channel = client.getChannel(channelName);

			const txId: TransactionId = client.newTransactionID(true);
			const request: JoinChannelRequest = {
				block: genesisBlock,
				// this does assume that we have loaded a connection profile with a peer by this name
				targets: ['peer0.org1.example.com'],
				txId,
			};

			return channel.joinChannel(request); //logged in as org1
		}).then((results: ProposalResponse[]) => {
			if (results && results[0] && results[0].response && results[0].response.status === 200) {
				t.pass(util.format('Successfully had peer in organization %s join the channel', 'org1'));
			} else {
				t.fail(' Failed to join channel on org1');
				throw new Error('Failed to join channel on org1');
			}
			return sleep(10000);
		}).then(() => {
			t.pass('Successfully waited for peers to join the channel');
			process.env.GOPATH = path.join(__dirname, '../fixtures');
			logger.debug(`Set GOPATH to ${process.env.GOPATH}`);
			const txId: TransactionId = client.newTransactionID(true);
			// send proposal to endorser
			const request: ChaincodeInstallRequest = {
				chaincodeId: 'examplets',
				chaincodePath: 'github.com/example_cc',
				chaincodeVersion: 'v1',
				channelNames: 'mychannelts', //targets will based on peers in this channel
				targets: ['peer0.org1.example.com'],
				txId,
			};

			return client.installChaincode(request);
		}).then((results: ProposalResponseObject) => {
			const firstResponse = results[0][0];
			if (firstResponse instanceof Error || firstResponse.response.status !== 200) {
				t.fail(' Failed to install chaincode on org1');
				logger.debug('Failed due to: %j', results);
				throw new Error('Failed to install chain code on org1');
			}
			t.pass('Successfully installed chain code on org1');

			client.loadFromConfig(configOrg2);
			t.pass('Successfully loaded \'admin\' for org2');
			return client.initCredentialStores();
		}).then(() => {
			t.pass('Successfully loaded the client configuration for org2');
			const txId: TransactionId = client.newTransactionID(true);
			// send proposal to endorser
			const request: ChaincodeInstallRequest = {
				chaincodeId: 'examplets',
				chaincodePath: 'github.com/example_cc',
				chaincodeVersion: 'v1',
				channelNames: 'mychannelts', //targets will based on peers in this channel
				targets: ['peer0.org2.example.com'],
				txId,
			};

			return client.installChaincode(request);
		}).then((results: ProposalResponseObject) => {
			const firstResponse = results[0][0];
			if (firstResponse instanceof Error || firstResponse.response.status !== 200) {
				t.fail(' Failed to install chaincode on org2');
				logger.debug('Failed due to: %j', results);
				throw new Error('Failed to install chain code on org2');
			}
			t.pass('Successfully installed chain code on org2');

			// Back to org1 for instantiation
			client.loadFromConfig(configOrg1);
			t.pass('Successfully loaded \'admin\' for org1');
			return client.initCredentialStores();
		}).then(() => {
			/*
			 *  I N S T A N T I A T E
			 */
			const txId: TransactionId = client.newTransactionID(true);
			instansiateTxId = txId;
			const request: ChaincodeInstantiateUpgradeRequest = {
				args: ['a', '100', 'b', '200'],
				chaincodeId: 'examplets',
				chaincodeVersion: 'v1',
				txId,
			};

			return channel.sendInstantiateProposal(request); // still have org2 admin signer
		}).then((results: ProposalResponseObject) => {
			const proposalResponses = results[0];
			const proposal = results[1];

			const firstResponse = proposalResponses[0];
			if (firstResponse instanceof Error || firstResponse.response.status !== 200) {
				t.fail('Failed to send  Proposal or receive valid response. Response null or status is not 200. exiting...');
				throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
			}

			t.pass('Successfully sent Proposal and received ProposalResponse');
			const request: TransactionRequest = {
				proposal,
				proposalResponses: proposalResponses as ProposalResponse[],
				txId: instansiateTxId, //required to indicate that this is an admin transaction
				//orderer : not specifying, the first orderer defined in the
				//          connection profile for this channel will be used
			};

			return channel.sendTransaction(request); // still have org2 admin as signer
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

			const ca: FabricCAServices = client.getCertificateAuthority();
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

			const ca: FabricCAServices = client.getCertificateAuthority();
			if (ca) {
				t.equals(ca.getCaName(), 'ca-org1', 'checking that caname is correct after resetting the config');
			} else {
				t.fail('Failed - CertificateAuthority should have been created');
			}

			return ca.register({ enrollmentID: 'user2', affiliation: 'org1' }, admin);
		}).then((secret: string) => {
			t.pass('Successfully registered user \'user2\' for org1');

			return client.setUserContext({ username: 'user2', password: secret });
		}).then((user: User) => {
			t.pass('Successfully enrolled user \'user2\' for org1');

			// try again ...this time use a longer timeout
			const txId: TransactionId = client.newTransactionID(); // get a non admin transaction ID
			queryTxId = txId.getTransactionID(); //save transaction string for later
			const request: ChaincodeInvokeRequest = {
				args: ['a', 'b', '100'],
				chaincodeId: 'examplets',
				fcn: 'move',
				txId,
				//targets - Letting default to all endorsing peers defined on the channel in the connection profile
			};

			return channel.sendTransactionProposal(request); //logged in as org1 user
		}).then((results: ProposalResponseObject) => {
			const proposalResponses: Array<ProposalResponse | Error> = results[0];
			const proposal: Proposal = results[1];
			let allGood = true;
			// Will check to be sure that we see two responses as there are two peers defined on this
			// channel that are endorsing peers
			let endorsedResponses = 0;
			for (const proposalResponse of proposalResponses) {
				endorsedResponses++;
				if (proposalResponse instanceof Error || !proposalResponse.response || !proposalResponse.response.status) {
					t.fail('transaction response was unknown');
					logger.error('transaction response was unknown %s', proposalResponse);
					allGood = false;
				} else if (proposalResponse.response.status !== 200) {
					t.fail('transaction proposal was bad');
					t.comment(' response status:' + proposalResponse.response.status +
						' message:' + proposalResponse.response.message);
					allGood = false;
				} else {
					t.pass('transaction proposal has response status of good');
				}
			}
			t.equals(endorsedResponses, 2, 'Checking that there are the correct number of endorsed responses');
			if (!allGood) {
				t.fail('Failed to send invoke Proposal or receive valid response. Response null or status is not 200. exiting...');
				throw new Error('Failed to send invoke Proposal or receive valid response. Response null or status is not 200. exiting...');
			}
			const request: TransactionRequest = {
				proposal,
				proposalResponses: proposalResponses as ProposalResponse[],
			};

			const promises = [];

			// be sure to get an channel event hub the current user is authorized to use
			const eventhub = channel.newChannelEventHub('peer0.org1.example.com');

			const txPromise = new Promise((resolve, reject) => {
				const handle = setTimeout(() => {
					eventhub.unregisterTxEvent(queryTxId);
					eventhub.disconnect();
					t.fail('REQUEST_TIMEOUT --- eventhub did not report back');
					reject(new Error('REQUEST_TIMEOUT:' + eventhub.getPeerAddr()));
				}, 30000);

				eventhub.registerTxEvent(queryTxId, (tx, code, blockNum) => {
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
					{ disconnect: true }, //since this is a test and we will not be using later
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
			const eventResults = results[0]; // Promise all will return the results in order of the of Array
			const sendTransactionResults = results[1] as Client.BroadcastResponse;
			if (sendTransactionResults instanceof Error) {
				t.fail('Failed to order the transaction: ' + sendTransactionResults);
				throw sendTransactionResults;
			} else if (sendTransactionResults.status === 'SUCCESS') {
				t.pass('Successfully sent transaction to invoke the chaincode to the orderer.');
			} else {
				t.fail('Failed to order the transaction to invoke the chaincode. Error code: ' + sendTransactionResults.status);
				throw new Error('Failed to order the transaction to invoke the chaincode. Error code: ' + sendTransactionResults.status);
			}

			return new Promise((resolve, reject) => {
				// get a new ChannelEventHub when registering a listener
				// with startBlock or endBlock when doing a replay
				// The ChannelEventHub must not have been connected or have other
				// listeners.
				const channelEventHub: ChannelEventHub = channel.newChannelEventHub('peer0.org1.example.com');

				const handle = setTimeout(() => {
					t.fail('Timeout - Failed to receive replay the event for event1');
					channelEventHub.unregisterTxEvent(queryTxId);
					channelEventHub.disconnect(); //shutdown down since we are done
				}, 10000);

				channelEventHub.registerTxEvent(queryTxId, (txnid, code, blockNum) => {
					clearTimeout(handle);
					t.pass('Event has been replayed with transaction code:' + code + ' for transaction id:' + txnid + ' for block_num:' + blockNum);
					resolve('Got the replayed transaction');
				}, (error) => {
					clearTimeout(handle);
					t.fail('Failed to receive event replay for Event for transaction id ::' + queryTxId);
					throw (error);
				},
					// a real application would have remembered the last block number
					// received and used that value to start the replay
					// Setting the disconnect to true as we do not want to use this
					// ChannelEventHub after the event we are looking for comes in
					{ startBlock: 0, disconnect: true },
				);
				t.pass('Successfully registered transaction replay for ' + queryTxId);

				channelEventHub.connect(); //connect to receive filtered blocks
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
				const channelEventHubs: ChannelEventHub[] = channel.getChannelEventHubsForOrg();
				// we should have the an channel event hub defined on the "peer0.org1.example.com"
				t.equals(channelEventHubs.length, 1, 'Checking that the channel event hubs has one');

				const channelEventHub = channelEventHubs[0];
				t.equals(channelEventHub.getPeerAddr(), 'localhost:7051', ' channel event hub address ');

				const handle = setTimeout(() => {
					t.fail('Timeout - Failed to receive replay the event for event1');
					channelEventHub.unregisterTxEvent(queryTxId);
					channelEventHub.disconnect(); //shutdown down since we are done
				}, 10000);

				channelEventHub.registerTxEvent(queryTxId, (txnid, code, blockNum) => {
					clearTimeout(handle);
					t.pass('Event has been replayed with transaction code:' + code + ' for transaction id:' + txnid + ' for block_num:' + blockNum);
					resolve('Got the replayed transaction');
				}, (error) => {
					clearTimeout(handle);
					t.fail('Failed to receive event replay for Event for transaction id ::' + queryTxId);
					throw (error);
				},
					// a real application would have remembered the last block number
					// received and used that value to start the replay
					// Setting the disconnect to true as we do not want to use this
					// ChannelEventHub after the event we are looking for comes in
					{ startBlock: 0, disconnect: true },
				);
				t.pass('Successfully registered transaction replay for ' + queryTxId);

				channelEventHub.connect(); //connect to receive filtered blocks
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

			const request: ChaincodeQueryRequest = {
				args: ['b'],
				chaincodeId: 'examplets',
				fcn: 'query',
			};

			return channel.queryByChaincode(request); //logged in as user on org1
		}).then((responsePayloads) => {
			// should only be one response ...as only one peer is defined as CHAINCODE_QUERY_ROLE
			let queryResponses = 0;
			if (responsePayloads) {
				for (const responsePayload of responsePayloads) {
					queryResponses++;
					t.equal(
						responsePayload.toString('utf8'),
						'300',
						'checking query results are correct that user b has 300 now after the move');
				}
			} else {
				t.fail('response_payloads is null');
				throw new Error('Failed to get response on query');
			}
			t.equals(queryResponses, 1, 'Checking that only one response was seen');

			return client.queryChannels('peer0.org1.example.com');
		}).then((results: ChannelQueryResponse) => {
			logger.debug(' queryChannels ::%j', results);
			let found = false;
			for (const resultChannel of results.channels) {
				logger.debug(' queryChannels has found %s', resultChannel.channel_id);
				if (resultChannel.channel_id === channelName) {
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
			for (const resultChaincode of results.chaincodes) {
				logger.debug(' queryInstalledChaincodes has found %s', resultChaincode.name);
				if (resultChaincode.name === 'examplets') {
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

			return channel.queryTransaction(queryTxId);
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

			return channel.queryTransaction(queryTxId, 'peer0.org1.example.com');
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

			return channel.queryTransaction(queryTxId, 'peer0.org1.example.com', true);
		}).then((results) => {
			logger.debug(' queryTransaction ::%j', results);
			t.equals(0, results.validationCode, 'Should be able to find our transaction validationCode by admin');

			const txId = client.newTransactionID(); // get a non admin transaction ID
			const request: ChaincodeInvokeRequest = {
				args: ['a', 'b', '100'],
				chaincodeId: 'examplets',
				fcn: 'move',
				txId,
				//targets - Letting default to all endorsing peers defined on the channel in the connection profile
			};

			// put in a very small timeout to force a failure, thereby checking that the timeout value was being used
			return channel.sendTransactionProposal(request, 1); //logged in as org1 user
		}).then((results: ProposalResponseObject) => {
			const proposalResponses = results[0];
			for (const proposalResponse of proposalResponses) {
				if (proposalResponse instanceof Error && proposalResponse.toString().indexOf('REQUEST_TIMEOUT') > 0) {
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
		});
});

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
