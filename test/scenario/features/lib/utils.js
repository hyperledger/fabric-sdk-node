/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Client = require('fabric-client');
const User = Client.User;
const FabricCAServices = require('fabric-ca-client');

const childProcess = require('child_process');
const stripAnsi = require('strip-ansi');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// High level constants for timeouts
const TIMEOUTS = {
	LONG_STEP : 240 * 1000,
	MED_STEP : 120 * 1000,
	SHORT_STEP: 60 * 1000,
	LONG_INC : 30 * 1000,
	MED_INC : 10 * 1000,
	SHORT_INC: 5 * 1000
};

// all temporary files and directories are created under here
const tempdir = path.join(os.tmpdir(), 'hfc');

// directory for file based KeyValueStore
module.exports.KVS = path.join(tempdir, 'hfc-test-kvs');
function storePathForOrg(org) {
	return module.exports.KVS + '_' + org;
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a shell command
 * @param {Boolean} pass - Boolean pass/fail case expected, undefined if unchecked case
 * @param {DataTable} cmd -  CLI command with parameters to be run
 * @return {Promise} - Promise that will be resolved or rejected with an error
 */
function runShellCommand(pass, cmd) {
	if (typeof cmd !== 'string') {
		return Promise.reject('Command passed to function was not a string');
	} else {
		const command = cmd.replace(/\s*[\n\r]+\s*/g, ' ');
		let stdout = '';
		let stderr = '';
		const env = Object.create(process.env);

		return new Promise((resolve, reject) => {

			const options = {
				env : env,
				maxBuffer: 100000000
			};
			const childCliProcess = childProcess.exec(command, options);

			childCliProcess.stdout.setEncoding('utf8');
			childCliProcess.stderr.setEncoding('utf8');

			childCliProcess.stdout.on('data', (data) => {
				data = stripAnsi(data);
				logMsg('STDOUT: ', data);
				stdout += data;
			});

			childCliProcess.stderr.on('data', (data) => {
				data = stripAnsi(data);
				logMsg('STDERR: ', data);
				stderr += data;
			});

			childCliProcess.on('error', (error) => {
				this.lastResp = {error : error, stdout : stdout, stderr : stderr};
				if (pass) {
					reject(this.lastResp);
				}
			});

			childCliProcess.on('close', (code) => {
				if (pass === undefined) {
					// don't care case
					this.lastResp = {code : code, stdout : stdout, stderr : stderr};
					resolve(this.lastResp);
				} else if (code && code !== 0 && pass) {
					// non zero return code, should pass
					this.lastResp = {code : code, stdout : stdout, stderr : stderr};
					reject(this.lastResp);
				} else if (code && code === 0 && !pass) {
					// zero return code, should fail
					this.lastResp = {code : code, stdout : stdout, stderr : stderr};
					reject(this.lastResp);
				} else {
					this.lastResp = {code : code, stdout : stdout, stderr : stderr};
					resolve(this.lastResp);
				}
			});
		});
	}
}

/**
 * Retrieve an enrolled user, or enroll the user if necessary.
 * @param {string} username The name of the user.
 * @param {string} password The enrollment secret necessary to enroll the user.
 * @param {Client} client The Fabric client object.
 * @param {string} userOrg The name of the user's organization.
 * @param {CommonConnectionProfile} ccp the common connection profile
 * @return {Promise<User>} The retrieved and enrolled user object.
 */
async function getMember(username, password, client, userOrg, ccp) {

	const org = ccp.getOrganization(userOrg);
	if (!org) {
		throw new Error('Could not find ' + userOrg + ' in configuration');
	}

	const caUrl = org.ca.url;

	const user = await client.getUserContext(username, true);

	try {
		if (user && user.isEnrolled()) {
			return user;
		}

		const member = new User(username);
		let cryptoSuite = client.getCryptoSuite();
		if (!cryptoSuite) {
			cryptoSuite = Client.newCryptoSuite();
			if (userOrg) {
				cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: module.exports.storePathForOrg(org.name)}));
				client.setCryptoSuite(cryptoSuite);
			}
		}
		member.setCryptoSuite(cryptoSuite);

		// need to enroll it with CA server
		const tlsOptions = {
			trustedRoots: [],
			verify: false
		};
		const cop = new FabricCAServices(caUrl, tlsOptions, org.ca.name, cryptoSuite);

		const enrollment = await cop.enroll({enrollmentID: username, enrollmentSecret: password});

		await member.setEnrollment(enrollment.key, enrollment.certificate, org.mspid);

		let skipPersistence = false;
		if (!client.getStateStore()) {
			skipPersistence = true;
		}
		await client.setUserContext(member, skipPersistence);
		return member;
	} catch (err) {
		logError('Failed to enroll and persist user. Error: ' + (err.stack ? err.stack : err));
		return Promise.reject(err);
	}
}

/**
 * Retrieve the admin identity for the given organization.
 * @param {Client} client The Fabric client object.
 * @param {string} userOrg The name of the user's organization.
 * @param {CommonConnectionProfile} ccp the common connection profile
 * @return {User} The admin user identity.
 */
function getOrgAdmin(client, userOrg, ccp) {
	try {

		const org = ccp.getOrganization(userOrg);
		if (!org) {
			throw new Error('Could not find ' + userOrg + ' in configuration');
		}

		const keyPEM = fs.readFileSync(org.adminPrivateKeyPEM.path);
		const certPEM = fs.readFileSync(org.signedCertPEM.path);

		const cryptoSuite = Client.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: module.exports.storePathForOrg(userOrg)}));
		client.setCryptoSuite(cryptoSuite);

		return Promise.resolve(client.createUser({
			username: 'peer' + userOrg + 'Admin',
			mspid: org.mspid,
			cryptoContent: {
				privateKeyPEM: keyPEM.toString(),
				signedCertPEM: certPEM.toString()
			}
		}));
	} catch (err) {
		return Promise.reject(err);
	}
}

/**
 * Retrieve the admin identity of the orderer service organization.
 * @param {Client} client The Fabric client object.
 * @param {CommonConnectionProfile} ccp the common connection profile
 * @return {User} The retrieved orderer admin identity.
 */
function getOrdererAdmin(client, ordererName, ccp) {
	try {
		const orderer = ccp.getOrderer(ordererName);
		const keyPEM = fs.readFileSync(orderer.adminPrivateKeyPEM.path);
		const certPEM = fs.readFileSync(orderer.signedCertPEM.path);

		return Promise.resolve(client.createUser({
			username: 'ordererAdmin',
			mspid: orderer.mspid,
			cryptoContent: {
				privateKeyPEM: keyPEM.toString(),
				signedCertPEM: certPEM.toString()
			}
		}));
	} catch (err) {
		return Promise.reject(err);
	}
}

function getSubmitter(client, peerAdmin, org, ccp) {
	if (peerAdmin) {
		return getOrgAdmin(client, org, ccp);
	} else {
		return getMember('admin', 'adminpw', client, org, ccp);
	}
}

/**
 * Enrol and get the cert
 * @param {*} fabricCAEndpoint url of org endpoint
 * @param {*} caName name of caName
 * @return {Object} something useful in a promise
 */
async function tlsEnroll(fabricCAEndpoint, caName) {
	const tlsOptions = {
		trustedRoots: [],
		verify: false
	};
	const caService = new FabricCAServices(fabricCAEndpoint, tlsOptions, caName);
	const req = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw',
		profile: 'tls'
	};

	const enrollment = await caService.enroll(req);
	enrollment.key = enrollment.key.toBytes();
	return enrollment;
}


function logMsg(msg, obj) {
	if (obj) {
		// eslint-disable-next-line no-console
		console.log(msg, obj);
	} else {
		// eslint-disable-next-line no-console
		console.log(msg);
	}
}

function logError(msg, obj) {
	if (obj) {
		// eslint-disable-next-line no-console
		console.error(msg, obj);
	} else {
		// eslint-disable-next-line no-console
		console.error(msg);
	}
}

module.exports.TIMEOUTS = TIMEOUTS;
module.exports.storePathForOrg = storePathForOrg;
module.exports.sleep = sleep;
module.exports.runShellCommand = runShellCommand;
module.exports.getOrdererAdmin = getOrdererAdmin;
module.exports.getSubmitter = getSubmitter;
module.exports.tlsEnroll = tlsEnroll;
module.exports.logMsg = logMsg;
module.exports.logError = logError;
