/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('unit.client');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const util = require('util');

const Client = require('fabric-client');
const User = require('fabric-client/lib/User.js');
const Peer = require('fabric-client/lib/Peer.js');
const Orderer = require('fabric-client/lib/Orderer.js');
const Organization = require('fabric-client/lib/Organization.js');
const CertificateAuthority = require('fabric-client/lib/CertificateAuthority.js');
const NetworkConfig = require('fabric-client/lib/impl/NetworkConfig_1_0.js');
const testutil = require('./util.js');


test('\n\n ** configuration testing **\n\n', (t) => {
	testutil.resetDefaults();

	t.doesNotThrow(
		() => {
			const config_loc = path.resolve('test/fixtures/profiles/network.yaml');
			const file_data = fs.readFileSync(config_loc);
			const network_data = yaml.safeLoad(file_data);
			const client = Client.loadFromConfig(network_data);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client.loadFromConfig(network_data);
			const channel = client.getChannel('mychannel');
			t.equals(channel.getPeers()[0].getUrl(), 'grpcs://localhost:7051', ' check to see that the peer has been added to the channel');
			t.equals(channel.getPeers()[1].getUrl(), 'grpcs://localhost:8051', ' check to see that the peer has been added to the channel');
		},
		'3 Should be able to instantiate a new instance of "Channel" with the definition in the common connection profile'
	);

	const network_config = {};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig(network_config, client);
			client.newChannel('mychannel');
		},
		'Should be able to instantiate a new instance of "Channel" with blank definition in the common connection profile'
	);

	network_config.version = '1.0.0';
	network_config.channels = {
		'mychannel': {
		}
	};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.newChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
		},
		'Should be able to instantiate a new instance of "Channel" with an empty channel definition in the common connection profile'
	);

	network_config.channels = {
		'mychannel': {
			orderers: ['orderer0']
		}
	};

	network_config.orderers = {
		'orderer0': {
			url: 'grpcs://localhost:7050',
			'tlsCACerts': {
				path: 'test/fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem'
			}
		}
	};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.getChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
			const orderer = channel.getOrderers()[0];
			if (orderer instanceof Orderer) {
				t.pass('Successfully got an orderer');
			} else {
				t.fail('Failed to get an orderer');
			}
			t.equals('orderer0', orderer.getName(), 'Orderer should be named');
		},
		'Should be able to instantiate a new instance of "Channel" with only orderer definition in the common connection profile'
	);

	network_config.channels = {
		'mychannel': {
			peers: {
				peer1: {},
				peer2: {},
				peer3: {},
				peer4: {}
			},
			orderers: ['orderer0']
		}
	};
	network_config.orgainizations = {'org1': {}};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.getChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
			t.equals(channel.getPeers().length, 0, 'Peers should be empty');
			const orderer = channel.getOrderers()[0];
			if (orderer instanceof Orderer) {
				t.pass('Successfully got an orderer');
			} else {
				t.fail('Failed to get an orderer');
			}
		},
		'Should be able to instantiate a new instance of "Channel" with org that does not exist in the common connection profile'
	);

	network_config.organizations = {
		'org1': {
			mspid: 'mspid1',
			peers: ['peer1', 'peer2'],
			certificateAuthorities: ['ca1']
		},
		'org2': {
			mspid: 'mspid2',
			peers: ['peer3', 'peer4'],
			certificateAuthorities: ['ca2']
		}
	};

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.getChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
			t.equals(channel.getPeers().length, 0, 'Peers should be empty');
			const orderer = channel.getOrderers()[0];
			if (orderer instanceof Orderer) {
				t.pass('Successfully got an orderer');
			} else {
				t.fail('Failed to get an orderer');
			}
		},
		'Should be able to instantiate a new instance of "Channel" with a peer in the org that does not exist in the common connection profile'
	);

	network_config.peers = {
		'peer1': {
			url: 'grpcs://localhost:7051',
			'tlsCACerts': {
				pem: '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'
			}
		},
		'peer2': {
			url: 'grpcs://localhost:7052',
			'tlsCACerts': {
				path: 'test/fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem'
			}
		},
		'peer3': {
			url: 'grpcs://localhost:7053',
			'tlsCACerts': {
				path: 'test/fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem'
			}
		},
		'peer4': {
			url: 'grpcs://localhost:7054',
			'tlsCACerts': {
				path: 'test/fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem'
			}
		},
	};

	network_config.certificateAuthorities = {
		'ca1': {
			url: 'https://localhost:7051',
			'tlsCACerts': {
				pem: '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'
			},
			grpcOptions: {verify: true},
			registrar: {enrollId: 'admin1', enrollSecret: 'adminpw1'}
		},
		'ca2': {
			url: 'https://localhost:7052',
			'tlsCACerts': {
				path: 'test/fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem'
			},
			grpcOptions: {verify: true},
			registrar: {enrollId: 'admin2', enrollSecret: 'adminpw2'}
		}
	};
	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const channel = client.getChannel('mychannel');
			t.equals('mychannel', channel.getName(), 'Channel should be named');
			t.equals(channel.getPeers().length, 4, 'Peers should be four');
			const peer = channel.getPeers()[0];
			if (peer && peer.constructor && peer.constructor.name === 'ChannelPeer') {
				t.pass('Successfully got a channel peer');
			} else {
				t.fail('Failed to get a channel peer');
			}
		},
		'Should be able to instantiate a new instance of "Channel" with orderer, org and peer defined in the common connection profile'
	);

	const peer1 = new Peer('grpcs://localhost:9999', {pem: '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'});

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);

			let targets = client.getTargetPeers('peer1', client);
			if (Array.isArray(targets)) {
				t.pass('targets is an array');
			} else {
				t.fail('targets is not an array');
			}
			if (targets[0] instanceof Peer) {
				t.pass('targets has a peer ');
			} else {
				t.fail('targets does not have a peer');
			}

			targets = client.getTargetPeers(['peer1'], client);
			if (Array.isArray(targets)) {
				t.pass('targets is an array');
			} else {
				t.fail('targets is not an array');
			}
			if (targets[0] instanceof Peer) {
				t.pass('targets has a peer ');
			} else {
				t.fail('targets does not have a peer');
			}

			targets = client.getTargetPeers(peer1, client);
			if (Array.isArray(targets)) {
				t.pass('targets is an array');
			} else {
				t.fail('targets is not an array');
			}
			if (targets[0] instanceof Peer) {
				t.pass('targets has a peer ');
			} else {
				t.fail('targets does not have a peer');
			}

			targets = client.getTargetPeers([peer1], client);
			if (Array.isArray(targets)) {
				t.pass('targets is an array');
			} else {
				t.fail('targets is not an array');
			}
			if (targets[0] instanceof Peer) {
				t.pass('targets has a peer ');
			} else {
				t.fail('targets does not have a peer');
			}

		},
		'Should be able to get targets for peer'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			const targets = client.getTargetPeers(null, client);
			t.equals(null, targets, 'targets should be null when request targets is null');
		},
		'Should return null targets when checking a null request target'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetPeers('somepeer', client);
		},
		/not found/,
		'Should not be able to get targets when targets is not a peer object'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			const targets = client.getTargetPeers([], client);
			t.equals(null, targets, 'targets should be null when list is empty');
		},
		'Should get a null when the target list is empty'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			let network_config_impl = new NetworkConfig(network_config, client);
			let client_config = network_config_impl.getClientConfig();
			if (typeof client_config.credentialStore === 'undefined') {
				t.pass('client config should be empty');
			} else {
				t.fail('client config is not correct');
			}
			network_config.client = {};
			network_config.client.credentialStore = {path: '/tmp/something', cryptoStore: {path: 'relative/something'}};
			network_config_impl = new NetworkConfig(network_config, client);
			client_config = network_config_impl.getClientConfig();
			t.equals(client_config.credentialStore.path, '/tmp/something', 'client config store path should be something');
			if (client_config.credentialStore.cryptoStore.path.indexOf('relative/something') > 1) {
				t.pass('client config cryptoStore store path should be something relative');
			} else {
				t.fail('client config cryptoStore store path should be something relative');
			}
			network_config.client.credentialStore = {dbsetting: '/tmp/something', cryptoStore: {dbsetting: 'relative/something'}};
			network_config_impl = new NetworkConfig(network_config, client);
			client_config = network_config_impl.getClientConfig();
			t.equals(client_config.credentialStore.dbsetting, '/tmp/something', 'client config store path should be something');
			t.equals(client_config.credentialStore.cryptoStore.dbsetting, 'relative/something', 'client config cryptoStore store path should be something');

		},
		'Should not get an error when working with credentialStore settings'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);
			const organizations = client._network_config.getOrganizations();
			if (Array.isArray(organizations)) {
				t.pass('organizations is an array');
			} else {
				t.fail('organizations is not an array');
			}
			if (organizations[0] instanceof Organization) {
				t.pass('organizations has a organization ');
			} else {
				t.fail('organizations does not have a organization');
			}

			let organization = client._network_config.getOrganization(organizations[0].getName());
			let ca = organization.getCertificateAuthorities()[0];
			t.equals('ca1', ca.getName(), 'check the ca name');

			organization = client._network_config.getOrganization(organizations[1].getName());
			ca = organization.getCertificateAuthorities()[0];
			t.equals('ca2', ca.getName(), 'check the ca name');

			organization = client._network_config.getOrganizationByMspId(organizations[0].getMspid());
			ca = organization.getCertificateAuthorities()[0];
			t.equals('ca1', ca.getName(), 'check the ca name');
		},
		'Should be able to get organizations'
	);

	network_config.channels = {
		'mychannel': {
			peers: {
				peer1: {endorsingPeer: false, chaincodeQuery: false, ledgerQuery: false},
				peer2: {endorsingPeer: false, chaincodeQuery: false, ledgerQuery: false},
				peer3: {ledgerQuery: true},
				peer4: {ledgerQuery: false}
			},
			orderers: ['orderer0']
		}
	};

	t.doesNotThrow(
		() => {
			let client = Client.loadFromConfig(network_config);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			let channel = client.getChannel('mychannel');

			checkTarget(channel._getTargetForQuery(), '7053', 'finding a default ledger query', t);
			checkTarget(channel._getTargets(null, 'ledgerQuery'), '7053', 'finding a default ledger query', t);
			checkTarget(channel._getTargetForQuery('peer1'), '7051', 'finding a string target for ledger query', t);
			checkTarget(channel._getTargets('peer1'), '7051', 'finding a string target', t);
			checkTarget(channel._getTargetForQuery(peer1), '9999', 'should get back the same target if a good peer', t);
			checkTarget(channel._getTargets(peer1), '9999', 'should get back the same target if a good peer', t);
			client = new Client();
			channel = client.newChannel('mychannel');
			channel.addPeer(peer1);
			checkTarget(channel._getTargetForQuery(), '9999', 'finding a default ledger query without networkconfig', t);
			checkTarget(channel._getTargets(undefined, 'ANY'), '9999', 'finding a default targets without networkconfig', t);
		},
		'Should be able to run channel target methods'
	);


	t.throws(
		() => {
			const client = Client.loadFromConfig(network_config);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			const channel = client.getChannel('mychannel');
			channel._getTargetForQuery(['peer1']);
		},
		/array/,
		'Should get an error back when passing an array'
	);

	t.throws(
		() => {
			const client = Client.loadFromConfig(network_config);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			const channel = client.getChannel('mychannel');
			channel._getTargets('bad');
		},
		/not assigned/,
		'Should get an error back when passing a bad name'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetOrderer('someorderer');
		},
		/not found/,
		'Should get an error when the request orderer name is not found'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({}, client);
			client.getTargetOrderer({});
		},
		/"orderer" request parameter is not valid. Must be an orderer name or "Orderer" object./,
		'Should get an error when the request orderer is not a valid object'
	);

	t.throws(
		() => {
			const client = new Client();
			client._network_config = new NetworkConfig({channels: {somechannel: {}}}, client);
			client.getTargetOrderer(null, null, 'somechannel');
		},
		/"orderer" request parameter is missing and there are no orderers defined on this channel in the common connection profile/,
		'Should get an error when the request orderer is not defined and the channel does not have any orderers'
	);

	t.doesNotThrow(
		() => {
			const client = new Client();
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client._network_config = new NetworkConfig(network_config, client);

			let orderer = client.getTargetOrderer('orderer0');
			if (orderer instanceof Orderer) {
				t.pass('orderer has a orderer ');
			} else {
				t.fail('orderer does not have a orderer');
			}

			const orderer1 = new Orderer('grpcs://localhost:9999', {pem: '-----BEGIN CERTIFICATE-----MIIB8TCC5l-----END CERTIFICATE-----'});

			orderer = client.getTargetOrderer(orderer1);
			if (orderer instanceof Orderer) {
				t.pass('orderer has a orderer ');
			} else {
				t.fail('orderer does not have a orderer');
			}

			orderer = client.getTargetOrderer(null, null, 'mychannel');
			if (orderer instanceof Orderer) {
				t.pass('orderer has a orderer ');
			} else {
				t.fail('orderer does not have a orderer');
			}

			orderer = client.getTargetOrderer(null, [orderer1]);
			if (orderer instanceof Orderer) {
				t.pass('orderer has a orderer ');
			} else {
				t.fail('orderer does not have a orderer');
			}
		},
		'Should be able to get orderer'
	);

	t.doesNotThrow(
		() => {
			const client = Client.loadFromConfig(network_config);
			client.setCryptoSuite(Client.newCryptoSuite());
			client.setUserContext(new User('testUser'), true);
			client.getChannel('mychannel');
			client.loadFromConfig({
				version: '1.0.0',
				channels: {
					'otherchannel': {
						orderers: ['orderer0']
					}
				}
			});
			client.getChannel('otherchannel');
		},
		'Should be able to load additional configurations'
	);

	t.doesNotThrow(
		() => {
			const organization = new Organization('name', 'mspid');
			t.equals('name', organization.getName(), 'check name');
			t.equals('mspid', organization.getMspid(), 'check mspid');
			organization.addPeer('peer');
			t.equals('peer', organization.getPeers()[0], 'check getPeers');
			organization.addCertificateAuthority('ca');
			t.equals('ca', organization.getCertificateAuthorities()[0], 'check getPeers');
			t.comment(organization.toString());
		},
		'Should be able to run all methods of Organization'
	);

	t.doesNotThrow(
		() => {
			const certificateAuthority = new CertificateAuthority('name', 'caname', 'url', 'connection', 'tlscert', 'registrar');
			t.equals('name', certificateAuthority.getName(), 'check name');
			t.equals('caname', certificateAuthority.getCaName(), 'check caname');
			t.equals('url', certificateAuthority.getUrl(), 'check url');
			t.equals('connection', certificateAuthority.getConnectionOptions(), 'check connection options');
			t.equals('tlscert', certificateAuthority.getTlsCACerts(), 'check tlscert');
			t.equals('registrar', certificateAuthority.getRegistrar(), 'check registrar');
			t.comment(certificateAuthority.toString());
		},
		'Should be able to run all methods of CertificateAuthority'
	);

	const clientpr1 = new Client();
	const pr1 = clientpr1.initCredentialStores().then(() => {
		t.fail('pr1 Should not have been able to resolve the promise');
	}).catch((err) => {
		if (err.message.indexOf('No common connection profile settings found') >= 0) {
			t.pass('pr1 Successfully caught error');
		} else {
			t.fail('pr1 Failed to catch error. Error: ' + err.stack ? err.stack : err);
		}
	});
	Promise.all([pr1])
		.then(
			() => {
				t.end();
			}
		).catch(
			(err) => {
				t.fail('Channel query calls, Promise.all: ');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		);

	t.throws(
		() => {
			const client = new Client();
			client._setAdminFromConfig();
		},
		/No common connection profile has been loaded/,
		'Should get an error No common connection profile has been loaded'
	);

	t.throws(
		() => {
			const client = new Client();
			client.setAdminSigningIdentity();
		},
		/Invalid parameter. Must have a valid private key./,
		'Should get an error Invalid parameter. Must have a valid private key.'
	);

	t.throws(
		() => {
			const client = new Client();
			client.setAdminSigningIdentity('privateKey');
		},
		/Invalid parameter. Must have a valid certificate./,
		'Should get an error Invalid parameter. Must have a valid certificate.'
	);

	t.throws(
		() => {
			const client = new Client();
			client.setAdminSigningIdentity('privateKey', 'cert');
		},
		/Invalid parameter. Must have a valid mspid./,
		'Should get an error Invalid parameter. Must have a valid mspid.'
	);

	t.throws(
		() => {
			const client = new Client();
			client._getSigningIdentity();
		},
		/No identity has been assigned to this client/,
		'Should get an error No identity has been assigned to this client'
	);

	try {
		const client = Client.loadFromConfig('test/fixtures/profiles/network.yaml');
		t.pass('Successfully loaded a common connection profile');
		t.pass('Should be able to try to load an admin from the config');

		client.loadFromConfig('test/fixtures/profiles/org1.yaml');
		t.pass('Should be able to load an additional config ...this one has the client section');
		t.pass('Should be able to try to load an admin from the config');
		// check to see if we were able to load a setting from the yaml into
		// the loaded profile
		t.equal(client._connection_options.fakeSetting, 99, 'check loading connection options');
	} catch (err) {
		t.fail('Fail - caught an error while trying to load a config and run the set admin');
	}

	const clientp1 = Client.loadFromConfig('test/fixtures/profiles/network.yaml');
	t.pass('Successfully loaded a common connection profile');
	clientp1.loadFromConfig('test/fixtures/profiles/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');

	const p1 = clientp1.initCredentialStores().then(() => {
		t.pass('Should be able to load the stores from the config');
		clientp1._setAdminFromConfig();
		t.pass('Should be able to load an admin from the config');
		clientp1._getSigningIdentity(true);
		t.pass('Should be able to get the loaded admin identity');
	}).catch((err) => {
		t.fail(util.format('Should not get an error when doing get signer: %O', err));
	});

	const clientp2 = Client.loadFromConfig('test/fixtures/profiles/network.yaml');
	t.pass('Successfully loaded a common connection profile');
	clientp2.loadFromConfig('test/fixtures/profiles/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');
	const p2 = clientp2.initCredentialStores().then(() => {
		t.pass('Should be able to load the stores from the config');
		clientp2._network_config._network_config.client = {};
		return clientp2._setUserFromConfig();
	}).then(() => {
		t.fail('Should not be able to load an user based on the config');
	}).catch((err) => {
		if (err.message.includes('Missing parameter. Must have a username.')) {
			t.pass('Successfully caught Missing parameter. Must have a username.');
		} else {
			t.fail('Failed to catch Missing parameter. Must have a username.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	const clientp3 = Client.loadFromConfig('test/fixtures/profiles/network.yaml');
	t.pass('Successfully loaded a common connection profile');
	clientp3.loadFromConfig('test/fixtures/profiles/org1.yaml');
	t.pass('Should be able to load an additional config ...this one has the client section');
	const p3 = clientp3.initCredentialStores().then(() => {
		t.pass('Should be able to load the stores from the config');
		clientp4._network_config._network_config.client = {};
		return clientp3._setUserFromConfig({username: 'username'});
	}).then(() => {
		t.fail('Should not be able to load an user based on the config');
	}).catch((err) => {
		if (err.message.indexOf('Missing parameter. Must have a password.') >= 0) {
			t.pass('Successfully caught Missing parameter. Must have a password.');
		} else {
			t.fail('Failed to catch Missing parameter. Must have a password.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	const clientp4 = Client.loadFromConfig('test/fixtures/profiles/network.yaml');
	t.pass('Successfully loaded a common connection profile');
	const p4 = clientp4._setUserFromConfig({username: 'username', password: 'password'}).then(() => {
		t.fail('Should not be able to load an user based on the config');
	}).catch((err) => {
		if (err.message.includes('Client requires a common connection profile loaded, stores attached, and crypto suite.')) {
			t.pass('Successfully caught Client requires a common connection profile loaded, stores attached, and crypto suite.');
		} else {
			t.fail('Failed to catch Client requires a common connection profile loaded, stores attached, and crypto suite.');
			logger.error(err.stack ? err.stack : err);
		}
	});

	Promise.all([p1, p2, p3, p4])
		.then(
			() => {
				t.end();
			}
		).catch(
			(err) => {
				t.fail('Client network config calls failed during the Promise.all');
				logger.error(err.stack ? err.stack : err);
				t.end();
			}
		);

	t.end();
});

test('\n\n ** channel testing **\n\n', (t) => {
	const client = new Client();
	client.setCryptoSuite(Client.newCryptoSuite());
	client.setUserContext(new User('testUser'), true);
	client.loadFromConfig('test/fixtures/profiles/network.yaml');

	const channel = client.getChannel('mychannel');
	let channelEventHubs = channel.getChannelEventHubsForOrg('bad');
	t.equals(channelEventHubs.length, 0, 'Checking that we got the correct number of peers in the list');
	channelEventHubs = channel.getChannelEventHubsForOrg('Org2MSP');
	t.equals(channelEventHubs[0].getName(), 'peer0.org2.example.com', 'Checking that we got the correct peer in the list');
	client.loadFromConfig('test/fixtures/profiles/org1.yaml');
	channelEventHubs = channel.getChannelEventHubsForOrg();
	t.equals(channelEventHubs[0].getName(), 'peer0.org1.example.com', 'Checking that we got the correct peer in the list');

	t.end();
});

function checkTarget(target, check, msg, t) {
	if (Array.isArray(target)) {
		target = target[0];
	}
	if (target.toString().indexOf(check) > -1) {
		t.pass('Successfully got the correct target result for ' + msg);
	} else {
		t.equals(check, target.toString(), 'Failed to get correct target result for ' + msg);
	}
}
