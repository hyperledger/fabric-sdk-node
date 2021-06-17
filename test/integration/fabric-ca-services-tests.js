/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';

// ///////////////////////////////////////////////////////////////
// ---------------------- IMPORTANT ----------------------------
// this test is meant to test the fabric-ca-client
// package ALONE! do not require anything from the fabric-client
// package.
// ///////////////////////////////////////////////////////////////

const {Utils: utils, Signer, SigningIdentity, User} = require('fabric-common');
const logger = utils.getLogger('integration.client');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const X509 = require('@ampretia/x509');

const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const http = require('http');

const testUtil = require('./util.js');


const FabricCAServices = require('fabric-ca-client/lib/FabricCAServices');
const FabricCAClient = require('fabric-ca-client/lib/FabricCAClient');

const enrollmentID = 'testUser';
let enrollmentSecret;
const csr = fs.readFileSync(path.resolve(__dirname, '../fixtures/fabricca/enroll-csr.pem'));

const userOrg = 'org1';
let ORGS, fabricCAEndpoint;

const tlsOptions = {
	trustedRoots: [],
	verify: false
};

/**
 * FabricCAServices class tests
 */

// run the enroll test

test('\n\n ** FabricCAServices: Test enroll() With Dynamic CSR **\n\n', (t) => {
	testUtil.resetDefaults();
	const caService = getFabricCAService(userOrg);

	const req = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw'
	};

	let eResult, member, webAdmin, signingIdentity;
	return caService.enroll(req)
		.then((enrollment) => {
			t.pass('Successfully enrolled \'' + req.enrollmentID + '\'.');
			eResult = enrollment;

			// check that we got back the expected certificate
			let subject;
			try {
				subject = X509.getSubject(FabricCAServices.normalizeX509(enrollment.certificate));
			} catch (err) {
				t.fail(util.format('Failed to parse enrollment cert\n%s\n. Error: %s', enrollment.certificate, err));
			}

			t.equal(subject.commonName, req.enrollmentID, 'Subject should be /CN=' + req.enrollmentID);

			return caService.getCryptoSuite().importKey(enrollment.certificate);
		}, (err) => {
			t.fail('Failed to enroll the admin. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);

			t.end();
		}).then((pubKey) => {
			t.pass('Successfully imported public key from the resulting enrollment certificate');

			const cryptoSuite = caService.getCryptoSuite();
			const id = ORGS[userOrg].mspid;

			signingIdentity = new SigningIdentity(eResult.certificate, pubKey, id, cryptoSuite, new Signer(cryptoSuite, eResult.key));
			return timeOutTest(signingIdentity, t);
		}, (err) => {
			t.fail('Failed to import the public key from the enrollment certificate. ' + err.stack ? err.stack : err);
			t.end();
		}).then(() => {
			return caService._fabricCAClient.register(enrollmentID, null, 'client', userOrg, 1, [], signingIdentity);
		}).then((secret) => {
			t.comment('secret: ' + JSON.stringify(secret));
			enrollmentSecret = secret; // to be used in the next test case

			t.pass('testUser \'' + enrollmentID + '\'');

			member = new User('adminX');
			return member.setEnrollment(eResult.key, eResult.certificate, 'Org1MSP');
		}, (err) => {
			t.fail(util.format('Failed to register "%s". %s', enrollmentID, err.stack ? err.stack : err));
			t.end();
		}).then(() => {

			// default keyValueStore is changed to inMemory
			return FabricCAServices.newDefaultKeyValueStore();
		}, () => {
			t.fail('Failed to configure the user with proper enrollment materials.');
			t.end();
		}).then((store) => {
			return store.setValue(member.getName(), member.toString());
		}, () => {
			t.fail('Failed to obtain a state store from the fabric-ca-client');
			t.end();
		}).then(() => {
			t.pass('Successfully saved user to state store');

			return caService.register({enrollmentID: 'testUserX', affiliation: 'bank_X'}, member);
		}).then(() => {
			t.fail('Should not have been able to register user of a affiliation "bank_X" because "admin" does not belong to that affiliation');
			t.end();
		}, () => {
			t.pass('Successfully rejected registration request "testUserX" in affiliation "bank_X"');

			return caService.register({enrollmentID: 'testUserX', affiliation: userOrg}, member);
		}).then((secret) => {
			t.pass('Successfully registered "testUserX" in affiliation "' + userOrg + '" with enrollment secret returned: ' + secret);

			return caService.revoke({enrollmentID: 'testUserX'}, member);
		}, (err) => {
			t.fail('Failed to register "testUserX". ' + err.stack ? err.stack : err);
			t.end();
		}).then((response) => {
			t.equal(response.success, true, 'Successfully revoked "testUserX"');

			return caService.register({
				enrollmentID: 'testUserY',
				enrollmentSecret: 'testUserYSecret',
				affiliation: 'org2.department1'
			}, member);
		}, (err) => {
			t.fail('Failed to revoke "testUserX". ' + err.stack ? err.stack : err);
			t.end();
		}).then((secret) => {
			t.equal(secret, 'testUserYSecret', 'Successfully registered another user "testUserY" with preset enrollment secret');

			return caService.enroll({enrollmentID: 'testUserY', enrollmentSecret: secret});
		}).then((enrollment) => {

			let cert;
			try {
				cert = X509.parseCert(FabricCAServices.normalizeX509(enrollment.certificate));
			} catch (err) {
				t.fail(util.format('Failed to parse enrollment cert\n%s\n. Error: %s', enrollment.certificate, err));
			}

			if (!cert.extensions || !cert.extensions.authorityKeyIdentifier) {
				t.fail(util.format('Parsed certificate does not contain Authority Key Identifier needed for revoke(): %j', cert));
			}

			// convert the raw AKI string in the form of 'keyid:HX:HX....' (HX represents a hex-encoded byte) to a hex string
			const akiString = cert.extensions.authorityKeyIdentifier;
			const arr = akiString.split(':');
			if (arr[0] !== 'keyid') {
				t.fail(util.format('Found an Autheority Key Identifier we do not understand: first segment is not "keyid": %s', akiString));
			}

			arr.shift(); // remove the 'keyid'
			const aki = arr.join('');
			const serial = cert.serial;

			t.comment(util.format('Ready to revoke certificate serial # "%s" with aki "%s"', serial, aki));

			return caService.revoke({serial: serial, aki: aki}, member);
			// return;
		}).then((response) => {
			t.equal(response.success, true, 'Successfully revoked "testUserY" using serial number and AKI');

			// generate CRL
			return caService.generateCRL({}, member);
		}).then((CRL) => {
			if (CRL) {
				t.pass('Successfully generated CRL');
			} else {
				t.fail('Unable to generate CRL');
			}

			// register a new user 'test1'
			return caService.register({
				enrollmentID: 'test1',
				affiliation: 'org1.department2',
				attrs: [
					{name: 'hf.Registrar.Roles', value: 'client'},
					{name: 'ecert', value: 'default', ecert: true},
					{name: 'test1attr', value: 'test1attr'}
				]
			}, member);
		}).then((secret) => {
			t.pass('Successfully registered "test1" ');

			return caService.enroll({enrollmentID: 'test1', enrollmentSecret: secret, attr_reqs: []});
		}).then((enrollment) => {
			t.pass('Successfully enrolled "test1"');

			checkoutCertForAttributes(t, enrollment.certificate, false, 'test1attr');
			checkoutCertForAttributes(t, enrollment.certificate, false, 'ecert');

			// register a new user 'test2'
			return caService.register({
				enrollmentID: 'test2',
				affiliation: 'org1.department2',
				attrs: [
					{name: 'hf.Registrar.Roles', value: 'client'},
					{name: 'ecert', value: 'default', ecert: true},
					{name: 'test2attr', value: 'test2attr'}
				]
			}, member);
		}).then((secret) => {
			t.pass('Successfully registered "test2" ');

			return caService.enroll({enrollmentID: 'test2', enrollmentSecret: secret});
		}).then((enrollment) => {
			t.pass('Successfully enrolled "test2"');

			checkoutCertForAttributes(t, enrollment.certificate, false, 'test2attr');
			checkoutCertForAttributes(t, enrollment.certificate, true, 'ecert');

			// register a new user 'test3'
			return caService.register({
				enrollmentID: 'test3',
				affiliation: 'org1.department2',
				attrs: [
					{name: 'hf.Registrar.Roles', value: 'client'},
					{name: 'ecert', value: 'default', ecert: true},
					{name: 'test3attr', value: 'test3attr'}
				]
			}, member);
		}).then((secret) => {
			t.pass('Successfully registered "test3" ');

			return caService.enroll({
				enrollmentID: 'test3',
				enrollmentSecret: secret,
				attr_reqs: [{name: 'test3attr'}, {name: 'ecert'}]
			});
		}).then((enrollment) => {
			t.pass('Successfully enrolled "test3"');

			checkoutCertForAttributes(t, enrollment.certificate, true, 'test3attr');
			checkoutCertForAttributes(t, enrollment.certificate, true, 'ecert');

			// register a new user 'webAdmin' that can register other users of the role 'client'
			return caService.register({
				enrollmentID: 'webAdmin',
				affiliation: 'org1.department2',
				attrs: [
					{name: 'hf.Registrar.Roles', value: 'client'},
					{name: 'hf.Registrar.Attributes', value: '*'},
					{name: 'dfattrib', value: 'default', ecert: true},
					{name: 'myattrib', value: 'somevalue and lots of other information'}
				]
			}, member);
		}).then((secret) => {
			t.pass('Successfully registered "webAdmin" who can register other users with no role');

			return caService.enroll({
				enrollmentID: 'webAdmin',
				enrollmentSecret: secret,
				attr_reqs: [{name: 'myattrib', optional: false}]
			});
		}, (err) => {
			t.fail('Failed to register "webAdmin". ' + err.stack ? err.stack : err);
			t.end();
		}).then((enrollment) => {
			t.pass('Successfully enrolled "webAdmin"');

			checkoutCertForAttributes(t, enrollment.certificate, true, 'myattrib');
			checkoutCertForAttributes(t, enrollment.certificate, false, 'dfattrib');

			webAdmin = new User('webAdmin');
			return webAdmin.setEnrollment(enrollment.key, enrollment.certificate, 'Org1MSP');
		}).then(() => {
			t.pass('Successfully constructed User object for "webAdmin"');

			return caService.register({enrollmentID: 'auditor', role: 'auditor'}, webAdmin);
		}).then(() => {
			t.fail('Should not have been able to use "webAdmin" to register a user of the "auditor" role');
			t.end();
		}, (err) => {
			t.pass('Successfully rejected attempt to register a user of invalid role. ' + err);

			return caService.register({
				enrollmentID: 'auditor',
				role: 'client',
				affiliation: 'org2.department1'
			}, webAdmin);
		}).then(() => {
			t.fail('Failed to capture the error when registering "auditor" of role "client" from "webAdmin" but using invalid affiliation');
		}, (err) => {
			if (err.toString().indexOf('Registration of \'auditor\' failed in affiliation validation')) {
				t.pass('Successfully captured the error when registering "auditor" of role "client" from "webAdmin" but using invalid affiliation');
			}

			return caService.register({
				enrollmentID: 'auditor',
				role: 'client',
				affiliation: 'org1.department2'
			}, webAdmin);
		}).then(() => {
			t.pass('Successfully registered "auditor" of role "client" from "webAdmin"');

			return caService.reenroll(webAdmin);
		}).then((res) => {
			t.pass('Successfully re-enrolled "webAdmin" user');
			checkoutCertForAttributes(t, res.certificate, false, 'myattrib');
			checkoutCertForAttributes(t, res.certificate, true, 'dfattrib');

			t.equal(typeof res.key !== 'undefined' && res.key !== null, true, 'Checking re-enroll response has the private key');
			t.equal(typeof res.certificate !== 'undefined' && res.certificate !== null, true, 'Checking re-enroll response has the certificate');

			return caService.reenroll(webAdmin, [{name: 'myattrib', require: true}]);
		}).then((res) => {
			t.pass('Successfully re-enrolled "webAdmin" user with the request for attributes');
			checkoutCertForAttributes(t, res.certificate, true, 'myattrib');
			checkoutCertForAttributes(t, res.certificate, false, 'dfattrib');

			return caService.reenroll(webAdmin, [{name: 'myattrib', require: true}, {name: 'dfattrib'}]);
		}).then((res) => {
			t.pass('Successfully re-enrolled "webAdmin" user with the request for attributes');
			checkoutCertForAttributes(t, res.certificate, true, 'myattrib');
			checkoutCertForAttributes(t, res.certificate, true, 'dfattrib');

			return caService.reenroll(webAdmin, []);
		}).then((res) => {
			t.pass('Successfully re-enrolled "webAdmin" user with the request for attributes');
			checkoutCertForAttributes(t, res.certificate, false, 'myattrib');
			checkoutCertForAttributes(t, res.certificate, false, 'dfattrib');
			t.end();
		}).catch((err) => {
			t.fail('Failed at ' + err.stack ? err.stack : err);
			t.end();
		});
});

function checkoutCertForAttributes(t, pem, should_find, attr_name) {
	const cert = X509.parseCert(pem);
	let found = false;
	if (cert && cert.extensions && cert.extensions['1.2.3.4.5.6.7.8.1']) {
		const attr_string = cert.extensions['1.2.3.4.5.6.7.8.1'];
		const attr_object = JSON.parse(attr_string);
		const attrs = attr_object.attrs;
		if (attrs && attrs[attr_name]) {
			logger.debug(' Found attribute %s with value of %s', attr_name, attrs[attr_name]);
			found = true;
		}
	}

	if (should_find) {
		if (found) {
			t.pass('Successfully received the enrolled certificate with the added attribute ::' + attr_name);
		} else {
			t.fail('Failed to receive the enrolled certificate with the added attribute ::' + attr_name);
		}
	} else {
		if (found) {
			t.fail('Failed with the enrolled certificate that has the added attribute ::' + attr_name);
		} else {
			t.pass('Successfully enrolled with certificate without the added attribute ::' + attr_name);
		}
	}
}

test('\n\n ** FabricCAClient: Test enroll With Static CSR **\n\n', (t) => {
	const endpoint = FabricCAServices._parseURL(fabricCAEndpoint);
	const client = new FabricCAClient({
		protocol: endpoint.protocol,
		hostname: endpoint.hostname,
		port: endpoint.port,
		tlsOptions: tlsOptions,
		caname: ORGS[userOrg].ca.name
	});

	return client.enroll(enrollmentID, enrollmentSecret, csr.toString())
		.then((enrollResponse) => {
			t.pass('Successfully invoked enroll API with enrollmentID \'' + enrollmentID + '\'');
			// check that we got back the expected certificate
			let subject;
			try {
				subject = X509.getSubject(FabricCAServices.normalizeX509(enrollResponse.enrollmentCert));
			} catch (err) {
				t.fail(util.format('Failed to parse enrollment cert\n%s\n. Error: %s', enrollResponse.enrollmentCert, err));
			}
			t.equal(subject.commonName, enrollmentID, 'Subject should be /CN=' + enrollmentID);
			t.end();
		})
		.catch((err) => {
			t.fail('Failed to enroll \'' + enrollmentID + '\'.  ' + err);
			t.end();
		});
});

test('\n\n ** FabricCAClient: Test enroll With a CSR **\n\n', async (t) => {
	try {
		testUtil.resetDefaults();
		const caService = getFabricCAService();
		const admin = await enrollAdminTest(caService, t);

		const newUser = {
			enrollmentID: 'aTestUser',
			maxEnrollments: -1,
			enrollmentSecret: 'userpw'
		};
		await caService.register(newUser, admin);

		const myCsr = fs.readFileSync(path.resolve(__dirname, '../fixtures/fabricca/test.csr'), 'utf8');

		const req = {
			enrollmentID: newUser.enrollmentID,
			enrollmentSecret: newUser.enrollmentSecret,
			csr: myCsr
		};

		const enrollment = await caService.enroll(req);
		t.pass('Successfully get enrollment by csr');

		// check that we got back the expected certificate
		let subject;
		try {
			subject = X509.getSubject(FabricCAServices.normalizeX509(enrollment.certificate));
		} catch (err) {
			t.fail(util.format('Failed to parse enrollment cert\n%s\n. Error: %s', enrollment.certificate, err));
		}

		t.equal(subject.commonName, req.enrollmentID, 'Subject should be /CN=' + req.enrollmentID);
		t.pass('Successfully tested enroll with csr');
	} catch (error) {
		t.fail(error.message);
		t.end();
	}
});

function getFabricCAService() {
	FabricCAServices.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
	ORGS = FabricCAServices.getConfigSetting('test-network');
	fabricCAEndpoint = ORGS[userOrg].ca.url;

	FabricCAServices.getConfigSetting('crypto-keysize', '256');// force for npm test
	FabricCAServices.setConfigSetting('crypto-hash-algo', 'SHA2');// force for npm test

	return new FabricCAServices(fabricCAEndpoint, tlsOptions, ORGS[userOrg].ca.name);
}

async function enrollAdminTest(caService, t) {
	try {
		const req = {
			enrollmentID: 'admin',
			enrollmentSecret: 'adminpw'
		};
		const enrollment = await caService.enroll(req);
		const admin = new User('admin1');
		await admin.setEnrollment(enrollment.key, enrollment.certificate, 'Org1MSP');
		t.pass('Successfully enrolled admin');
		return admin;
	} catch (error) {
		t.fail(error.message);
		t.end();
	}
}

async function timeOutTest(signingIdentity, t) {
	const CONNECTION_TIMEOUT = FabricCAServices.getConfigSetting('connection-timeout');
	t.equal(CONNECTION_TIMEOUT, 3000, 'connection-timeout should have default value 3000');
	const SO_TIMEOUT = FabricCAServices.getConfigSetting('socket-operation-timeout');
	t.equal(SO_TIMEOUT, undefined, 'socket-operation-timeout should have default value undefined');

	let start, end;
	// test CONNECTION_TIMEOUT
	// Connect to a non-routable IP address should throw error connection_timeout
	try {
		const caClient = new FabricCAServices('http://10.255.255.1:3000')._fabricCAClient;
		start = Date.now();
		await caClient.request('GET', '/aMethod', signingIdentity);
		t.fail('Should throw error by CONNECTION_TIMEOUT');
	} catch (e) {
		end = Date.now();
		logger.debug('Conection failed with error ' + e.toString());
		if (e.message === 'Calling /aMethod endpoint failed, CONNECTION Timeout') {
			// for connection timeout, verify the timeout value
			t.equal(Math.floor((end - start) / 1000), 3, 'should have duration roughly equals 3000');
		} else if (e.message.includes('Error: connect ENETUNREACH')) {
			// Verification build sometimes failed with ENETUNREACH. It seems to relate to gateway on the build machine.
			// Do not fail in this case.
			t.pass('Calling non-routable endpoint failed with ENETUNREACH error');
		} else if (e.message.includes('Error: connect EHOSTUNREACH')) {
			t.pass('Calling non-routable endpoint failed with EHOSTUNREACH error');
		} else {
			t.fail('Calling non-routable endpoint failed with unexpected error: ' + e.toString());
		}
	}

	// create a mock server, the mock server wait for 10 seconds until send response
	const mockServer = http.createServer((req, res) => {
		setTimeout(() => {
			res.writeHead(200, {'Content-Type': 'text/plain'});
			res.write('Response');
			res.end();
		}, 10000);
	});
	mockServer.listen(3000);

	// set SO_TIMEOUT to 5000
	FabricCAServices.setConfigSetting('socket-operation-timeout', 5000);

	// test SO_TIMEOUT
	try {
		const caClient = new FabricCAServices('http://localhost:3000')._fabricCAClient;
		start = Date.now();
		await caClient.request('GET', '/aMethod', signingIdentity);
		t.fail('Should throw error by SO_TIMEOUT');
	} catch (e) {
		end = Date.now();
		t.equal(Math.floor((end - start) / 1000), 5, 'should have duration roughly equals 5000');
		if (e.message.includes('endpoint failed')) {
			t.pass('Successfully throw error after SO_TIMEOUT');
		} else {
			t.fail('did not throw error after SO_TIMEOUT');
		}
		mockServer.close();
	}
}
