/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path');
const fs = require('fs-extra');
const util = require('util');


const Client = require('fabric-client');
const copService = require('fabric-ca-client/lib/FabricCAServices.js');
const User = require('fabric-client/lib/User.js');
const Constants = require('./constants.js');

const logger = require('fabric-client/lib/utils.js').getLogger('TestUtil');

module.exports.CHAINCODE_PATH = 'github.com/example_cc';
module.exports.CHAINCODE_UPGRADE_PATH = 'github.com/example_cc1';
module.exports.CHAINCODE_UPGRADE_PATH_V2 = 'github.com/example_cc2';
module.exports.CHAINCODE_PATH_PRIVATE_DATA = 'github.com/example_cc_private';

module.exports.END2END = {
	channel: 'mychannel',
	chaincodeId: 'end2endnodesdk',
	chaincodeIdPrivateData: 'end2endnodesdk_privatedata',
	chaincodeVersion: 'v0'
};

module.exports.NODE_CHAINCODE_PATH = path.resolve(__dirname, '../fixtures/src/node_cc/example_cc');
module.exports.NODE_CHAINCODE_UPGRADE_PATH = path.resolve(__dirname, '../fixtures/src/node_cc/example_cc1');
module.exports.NODE_CHAINCODE_UPGRADE_PATH_V2 = path.resolve(__dirname, '../fixtures/src/node_cc/example_cc2');
module.exports.METADATA_PATH = path.resolve(__dirname, '../fixtures/metadata');
module.exports.METADATA_PATH_PRIVATE_DATA = path.resolve(__dirname, '../fixtures/src/github.com/example_cc_private/META-INF');
module.exports.COLLECTIONS_CONFIG_PATH = path.resolve(__dirname, '../fixtures/src/github.com/example_cc_private/collections_config.json');

module.exports.JAVA_CHAINCODE_PATH = path.resolve(__dirname, '../fixtures/src/java_cc/example_cc');
module.exports.JAVA_CHAINCODE_UPGRADE_PATH = path.resolve(__dirname, '../fixtures/src/java_cc/example_cc1');

module.exports.NODE_END2END = {
	channel: 'mychannel',
	chaincodeId: 'e2enodecc',
	chaincodeLanguage: 'node',
	chaincodeVersion: 'v0'
};

module.exports.NETWORK_END2END = {
	channel: 'mychannel',
	chaincodeId: 'network-e2enodecc',
	chaincodeLanguage: 'node',
	chaincodeVersion: 'v0'
};

// all temporary files and directories are created under here
const tempdir = Constants.tempdir;

logger.info(util.format(
	'\n\n*******************************************************************************' +
	'\n*******************************************************************************' +
	'\n*                                          ' +
	'\n* Using temp dir: %s' +
	'\n*                                          ' +
	'\n*******************************************************************************' +
	'\n*******************************************************************************\n', tempdir));

module.exports.getTempDir = function() {
	fs.ensureDirSync(tempdir);
	return tempdir;
};

// directory for file based KeyValueStore
module.exports.KVS = path.join(tempdir, 'hfc-test-kvs');
module.exports.storePathForOrg = function(org) {
	return module.exports.KVS + '_' + org;
};

// temporarily set $GOPATH to the test fixture folder
module.exports.setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, '../fixtures');
};

// specifically set the values to defaults because they may have been overridden when
// running in the overall test bucket ('gulp test')
module.exports.resetDefaults = function() {
	global.hfc.config = undefined;
	require('nconf').reset();
};

module.exports.cleanupDir = function(keyValStorePath) {
	const absPath = path.join(process.cwd(), keyValStorePath);
	const exists = module.exports.existsSync(absPath);
	if (exists) {
		fs.removeSync(absPath);
	}
};

module.exports.getUniqueVersion = function(prefix) {
	if (!prefix) prefix = 'v';
	return prefix + Date.now();
};

// utility function to check if directory or file exists
// uses entire / absolute path from root
module.exports.existsSync = function(absolutePath /*string*/) {
	try  {
		const stat = fs.statSync(absolutePath);
		if (stat.isDirectory() || stat.isFile()) {
			return true;
		} else
			return false;
	}
	catch (e) {
		return false;
	}
};

module.exports.readFile = readFile;

Client.addConfigFile(path.join(__dirname, '../integration/e2e/config.json'));
const ORGS = Client.getConfigSetting('test-network');

const	tlsOptions = {
	trustedRoots: [],
	verify: false
};

function getMember(username, password, client, t, userOrg) {
	const caUrl = ORGS[userOrg].ca.url;

	return client.getUserContext(username, true)
		.then((user) => {
			// eslint-disable-next-line no-unused-vars
			return new Promise((resolve, reject) => {
				if (user && user.isEnrolled()) {
					t.pass('Successfully loaded member from persistence');
					return resolve(user);
				}

				const member = new User(username);
				let cryptoSuite = client.getCryptoSuite();
				if (!cryptoSuite) {
					cryptoSuite = Client.newCryptoSuite();
					if (userOrg) {
						cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: module.exports.storePathForOrg(ORGS[userOrg].name)}));
						client.setCryptoSuite(cryptoSuite);
					}
				}
				member.setCryptoSuite(cryptoSuite);

				// need to enroll it with CA server
				const cop = new copService(caUrl, tlsOptions, ORGS[userOrg].ca.name, cryptoSuite);

				return cop.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					t.pass('Successfully enrolled user \'' + username + '\'');

					return member.setEnrollment(enrollment.key, enrollment.certificate, ORGS[userOrg].mspid);
				}).then(() => {
					let skipPersistence = false;
					if (!client.getStateStore()) {
						skipPersistence = true;
					}
					return client.setUserContext(member, skipPersistence);
				}).then(() => {
					return resolve(member);
				}).catch((err) => {
					t.fail('Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err);
					t.end();
				});
			});
		});
}

module.exports.setAdmin = function(client, userOrg) {
	return getAdmin(client, null, userOrg);
};

function getAdmin(client, t, userOrg) {
	const keyPath = path.join(__dirname, util.format('../fixtures/channel/crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/keystore', userOrg, userOrg));
	const keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	const certPath = path.join(__dirname, util.format('../fixtures/channel/crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/signcerts', userOrg, userOrg));
	const certPEM = readAllFiles(certPath)[0];

	const cryptoSuite = Client.newCryptoSuite();
	if (userOrg) {
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: module.exports.storePathForOrg(ORGS[userOrg].name)}));
		client.setCryptoSuite(cryptoSuite);
	}

	return Promise.resolve(client.createUser({
		username: 'peer'+userOrg+'Admin',
		mspid: ORGS[userOrg].mspid,
		cryptoContent: {
			privateKeyPEM: keyPEM.toString(),
			signedCertPEM: certPEM.toString()
		}
	}));
}

function getOrdererAdmin(client, t) {
	const keyPath = path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/keystore');
	const keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	const certPath = path.join(__dirname, '../fixtures/channel/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/signcerts');
	const certPEM = readAllFiles(certPath)[0];
	t.comment('getOrdererAdmin');

	return Promise.resolve(client.createUser({
		username: 'ordererAdmin',
		mspid: 'OrdererMSP',
		cryptoContent: {
			privateKeyPEM: keyPEM.toString(),
			signedCertPEM: certPEM.toString()
		}
	}));
}

function readFile(path) {
	return new Promise((resolve, reject) => {
		fs.readFile(path, (err, data) => {
			if (err)
				reject(new Error('Failed to read file ' + path + ' due to error: ' + err));
			else
				resolve(data);
		});
	});
}

function readAllFiles(dir) {
	const files = fs.readdirSync(dir);
	const certs = [];
	files.forEach((file_name) => {
		const file_path = path.join(dir,file_name);
		logger.debug(' looking at file ::'+file_path);
		const data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}

module.exports.getOrderAdminSubmitter = function(client, test) {
	return getOrdererAdmin(client, test);
};

module.exports.getSubmitter = function(client, test, peerOrgAdmin, org) {
	if (arguments.length < 2) throw new Error('"client" and "test" are both required parameters');

	let peerAdmin, userOrg;
	if (typeof peerOrgAdmin === 'boolean') {
		peerAdmin = peerOrgAdmin;
	} else {
		peerAdmin = false;
	}

	// if the 3rd argument was skipped
	if (typeof peerOrgAdmin === 'string') {
		userOrg = peerOrgAdmin;
	} else {
		if (typeof org === 'string') {
			userOrg = org;
		} else {
			userOrg = 'org1';
		}
	}

	if (peerAdmin) {
		return getAdmin(client, test, userOrg);
	} else {
		return getMember('admin', 'adminpw', client, test, userOrg);
	}
};

module.exports.checkResults = function(results, error_snip, t) {
	const proposalResponses = results[0];
	for(const i in proposalResponses) {
		const proposal_response = proposalResponses[i];
		if(proposal_response instanceof Error) {
			if(proposal_response.message.includes(error_snip)) {
				t.pass('Successfully got the error' + error_snip);
			} else {
				t.fail( 'Failed to get error with ' + error_snip + ' :: response message ' + proposal_response.message);
			}
		}
		else {
			t.fail(' Failed  :: no Error response message found and should have had an error with '+ error_snip);
		}
	}
};

module.exports.checkGoodResults = function(t, results) {
	let result = true;
	const proposalResponses = results[0];
	for(const i in proposalResponses) {
		const proposal_response = proposalResponses[i];
		if(proposal_response instanceof Error) {
			t.fail( 'Failed with error ' + proposal_response.toString());
			result = result & false;
		} else if( proposal_response && proposal_response.response && proposal_response.response.status === 200) {
			t.pass('transaction proposal has response status of good');
			result = result & true;
		} else {
			t.fail(' Unknown results ');
			result = result & false;
		}
	}

	return result;
};

module.exports.getClientForOrg = async function(t, org) {
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
	await module.exports.getTlsCACerts(t, client, org);

	return client;
};

module.exports.getTlsCACerts = async function(t, client) {
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
};

module.exports.setupChannel = async function(t, client_org1, client_org2, channel_name) {
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
				await module.exports.sleep(10000);
			} else {
				t.fail('Failed to create the channel. ' + create_results.status + ' :: ' + create_results.info);
				throw new Error('Failed to create the channel. ');
			}
		} catch(error) {
			logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
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

		const genesis_block = await channel_org1.getGenesisBlock(request);
		t.pass('Successfully got the genesis block');

		let promises = [];
		let join_monitor = module.exports.buildJoinEventMonitor(t, client_org1, channel_name, 'peer0.org1.example.com');
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
		join_monitor = module.exports.buildJoinEventMonitor(t, client_org2, channel_name, 'peer0.org2.example.com');
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
		const instan_results = await channel_org1.sendInstantiateProposal(request);
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
			await module.exports.sleep(10000); // use sleep for now until the eventhub is integrated into the network config changes
		} else {
			t.fail('Failed to order the transaction to instantiate the chaincode. Error code: ' + commit_response.status);
			throw new Error('Failed to order the transaction to instantiate the chaincode. Error code: ' + commit_response.status);
		}

		t.pass('Successfully waited for chaincodes to startup');
	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}

	// just return the one channel instance
	return channel_org1;
};


module.exports.buildJoinEventMonitor = function(t, client, channel_name, peer_name) {
	// no event available ... just going to wait
	const event_block_promise = new Promise(resolve => setTimeout(resolve, 10000));

	return event_block_promise;
};

module.exports.invokeAsAdmin = async function(t, client, channel, additional_request_opts) {
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

		request = Object.assign(request, additional_request_opts);
		logger.info('request:%j',request);

		const results = await channel.sendTransactionProposal(request);
		const proposalResponses = results[0];
		const proposal = results[1];
		let all_good = true;
		for(const i in proposalResponses) {
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
			// to use the admin idenity must include the transactionID
			// that was created for the proposal that was based on the admin Identity
			txId : tx_id
		};

		const responses = await module.exports.send_and_wait_on_events(t, channel, request, tx_id_string);
		if (!(responses[0] instanceof Error) && responses[0].status === 'SUCCESS') {
			t.pass('Successfully committed transaction ' + tx_id_string);
			await module.exports.sleep(5000);
		} else {
			t.fail('Failed transaction '+ tx_id_string);
			throw new Error('Failed transaction');
		}
	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}

	return tx_id_string;
};

module.exports.send_and_wait_on_events = async function(t, channel, request, tx_id) {
	const promises = [];
	promises.push(channel.sendTransaction(request));

	const channel_event_hubs = channel.getChannelEventHubsForOrg();
	for(const i in channel_event_hubs) {
		const channel_event_hub = channel_event_hubs[i];
		const event_monitor = module.exports.transaction_monitor(t, channel_event_hub, tx_id);
		promises.push(event_monitor);
	}

	return Promise.all(promises);
};

module.exports.transaction_monitor = function(t, channel_event_hub, tx_id) {
	const a_promise = new Promise((resolve, reject) => {
		const handle = setTimeout(() => {
			t.fail('Timeout - Failed to receive event for tx_id '+ tx_id);
			channel_event_hub.disconnect(); //shutdown
			throw new Error('TIMEOUT - no event received');
		}, 60000);

		channel_event_hub.registerTxEvent(tx_id, (txnid, code, block_num) => {
			clearTimeout(handle);
			t.pass('Event has been seen with transaction code:'+ code + ' for transaction id:'+ txnid + ' for block_num:' + block_num);
			resolve('Got the replayed transaction');
		}, (error) => {
			clearTimeout(handle);
			t.fail('Failed to receive event replay for Event for transaction id ::'+tx_id);
			reject(error);
		},{disconnect: true}
			// Setting the disconnect to true as we do not want to use this
			// ChannelEventHub after the event we are looking for comes in
		);
		t.pass('Successfully registered event for ' + tx_id);

		// this connect will send a request to the peer event service that has
		// been signed by the admin identity
		channel_event_hub.connect();
		t.pass('Successfully called connect on '+ channel_event_hub.getPeerAddr());
	});

	return a_promise;
};

module.exports.queryChannelAsAdmin = async function(t, client, channel, tx_id_string, peer, chaincode_id) {
	try {
		const request = {
			chaincodeId : chaincode_id,
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

		let results = await channel.queryBlock(1, peer, true);
		t.equals('1', results.header.number, 'Checking able to find our block number by admin');

		results = await channel.queryInfo(peer, true);
		t.pass('Successfully got the block height by admin:: '+ results.height);

		results = await channel.queryBlockByHash(results.previousBlockHash, peer, true);
		t.pass('Successfully got block by hash by admin ::' + results.header.number);

		results = await channel.queryTransaction(tx_id_string, peer, true);
		t.equals(0, results.validationCode, 'Checking able to find our transaction validationCode by admin');
	} catch(error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Test failed with '+ error);
	}

	return true;
};

module.exports.queryClientAsAdmin = async function(t, client, channel, peer) {
	let results = await client.queryInstalledChaincodes(peer, true); // use admin
	let found = false;
	for(const i in results.chaincodes) {
		if(results.chaincodes[i].name === 'example') {
			found = true;
		}
	}
	if(found) {
		t.pass('Successfully found our chaincode in the result list');
	} else {
		t.fail('Failed to find our chaincode in the result list');
	}

	results = await client.queryChannels(peer, true);
	found = false;
	for(const i in results.channels) {
		if(results.channels[i].channel_id === channel.getName()) {
			found = true;
		}
	}
	if(found) {
		t.pass('Successfully found our channel in the result list');
	} else {
		t.fail('Failed to find our channel in the result list');
	}
};

module.exports.sleep = function(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
};
exports.tapeAsyncThrow = async (t, asyncFun, regx, message) => {
	try {
		await asyncFun();
		t.fail(message);
	} catch (err) {
		if (err.toString().match(regx)) {
			t.pass(message);
		} else {
			t.fail(message);
			t.comment(err.toString());
		}
	}
};
