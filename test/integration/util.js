/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path');
const fs = require('fs-extra');
const util = require('util');

const copService = require('fabric-ca-client/lib/FabricCAServices.js');
const {Utils: utils, User} = require('fabric-common');
const logger = utils.getLogger('TestUtil');

module.exports.CHAINCODE_PATH = 'github.com/example_cc';

module.exports.END2END = {
	channel: 'mychannel',
	chaincodeId: 'end2endnodesdk',
	chaincodeIdPrivateData: 'end2endnodesdk_privatedata',
	chaincodeVersion: 'v0'
};

module.exports.NODE_CHAINCODE_PATH = path.resolve(__dirname, '../fixtures/chaincode/node_cc/example_cc');
module.exports.METADATA_PATH = path.resolve(__dirname, '../fixtures/chaincode/metadata');
module.exports.COLLECTIONS_CONFIG_PATH = path.resolve(__dirname, '../fixtures/chaincode/goLang/src/github.com/example_cc_private/collections_config.json');

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
const tempdir = path.join(__dirname, '../temp');

logger.info(util.format(
	'\n\n*******************************************************************************' +
	'\n*******************************************************************************' +
	'\n*                                          ' +
	'\n* Using temp dir: %s' +
	'\n*                                          ' +
	'\n*******************************************************************************' +
	'\n*******************************************************************************\n', tempdir));

// directory for file based KeyValueStore
module.exports.KVS = path.join(tempdir, 'hfc-test-kvs');
module.exports.storePathForOrg = function (org) {
	return module.exports.KVS + '_' + org;
};

// temporarily set $GOPATH to the test fixture folder
module.exports.setupChaincodeDeploy = function () {
	process.env.GOPATH = path.join(__dirname, '../fixtures/chaincode/goLang');
};

// specifically set the values to defaults because they may have been overridden when
// running in the overall test bucket ('npm test')
module.exports.resetDefaults = function () {
	global.hfc.config = undefined;
	require('nconf').reset();
};

utils.addConfigFile(path.join(__dirname, './e2e/config.json'));
const ORGS = utils.getConfigSetting('test-network');

const tlsOptions = {
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
					cryptoSuite = utils.newCryptoSuite();
					if (userOrg) {
						cryptoSuite.setCryptoKeyStore(utils.newCryptoKeyStore({path: module.exports.storePathForOrg(ORGS[userOrg].name)}));
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
					t.fail('Failed to enroll and persist user. Enjoy the Error: ' + err.stack ? err.stack : err);
					t.end();
				});
			});
		});
}

module.exports.setAdmin = function (client, userOrg) {
	return getAdmin(client, null, userOrg);
};

function getAdmin(client, t, userOrg) {
	const keyPath = path.join(__dirname, util.format('../fixtures/crypto-material/crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/keystore', userOrg, userOrg));
	const keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	const certPath = path.join(__dirname, util.format('../fixtures/crypto-material/crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/signcerts', userOrg, userOrg));
	const certPEM = readAllFiles(certPath)[0];

	const cryptoSuite = utils.newCryptoSuite();
	if (userOrg) {
		cryptoSuite.setCryptoKeyStore(utils.newCryptoKeyStore({path: module.exports.storePathForOrg(ORGS[userOrg].name)}));
		client.setCryptoSuite(cryptoSuite);
	}

	return Promise.resolve(client.createUser({
		username: 'peer' + userOrg + 'Admin',
		mspid: ORGS[userOrg].mspid,
		cryptoContent: {
			privateKeyPEM: keyPEM.toString(),
			signedCertPEM: certPEM.toString()
		}
	}));
}

function getOrdererAdmin(client, t) {
	const keyPath = path.join(__dirname, '../fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/msp/keystore');
	const keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	const certPath = path.join(__dirname, '../fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/msp/signcerts');
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

function readFile(filePath) {
	return new Promise((resolve, reject) => {
		fs.readFile(filePath, (err, data) => {
			if (err) {
				reject(new Error('Failed to read file ' + filePath + ' due to error: ' + err));
			} else {
				resolve(data);
			}
		});
	});
}

module.exports.readFile = readFile;

function readAllFiles(dir) {
	const files = fs.readdirSync(dir);
	const certs = [];
	files.forEach((file_name) => {
		const file_path = path.join(dir, file_name);
		logger.debug(' looking at file ::' + file_path);
		const data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}

module.exports.getOrderAdminSubmitter = function (client, test) {
	return getOrdererAdmin(client, test);
};

module.exports.getSubmitter = function (client, test, peerOrgAdmin, org) {
	if (arguments.length < 2) {
		throw new Error('"client" and "test" are both required parameters');
	}

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

module.exports.sleep = function (ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
};
