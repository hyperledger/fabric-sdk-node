/**
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';

if (global && global.hfc) global.hfc.config = undefined;
require('nconf').reset();
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('fabric-ca-services');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);


var hfc = require('fabric-client');

var X509 = require('x509');

var util = require('util');
var fs = require('fs-extra');
var path = require('path');
var testUtil = require('../unit/util.js');
var LocalMSP = require('fabric-client/lib/msp/msp.js');
var idModule = require('fabric-client/lib/msp/identity.js');
var SigningIdentity = idModule.SigningIdentity;
var Signer = idModule.Signer;
var User = require('fabric-client/lib/User.js');

var keyValStorePath = testUtil.KVS;

var FabricCAServices = require('fabric-ca-client/lib/FabricCAClientImpl');
var FabricCAClient = FabricCAServices.FabricCAClient;

var enrollmentID = 'testUser';
var enrollmentSecret;
var csr = fs.readFileSync(path.resolve(__dirname, '../fixtures/fabricca/enroll-csr.pem'));

hfc.addConfigFile(path.join(__dirname, 'e2e', 'config.json'));
var ORGS = hfc.getConfigSetting('test-network');
var userOrg = 'org1';

var	tlsOptions = {
	trustedRoots: [],
	verify: false
};
var fabricCAEndpoint = ORGS[userOrg].ca.url;

/**
 * FabricCAServices class tests
 */

//run the enroll test

test('\n\n ** FabricCAServices: Test enroll() With Dynamic CSR **\n\n', function (t) {

	utils.getConfigSetting('crypto-keysize', '256');//force for gulp test
	utils.setConfigSetting('crypto-hash-algo', 'SHA2');//force for gulp test

	var caService = new FabricCAServices(fabricCAEndpoint, tlsOptions, ORGS[userOrg].ca.name);

	var req = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw'
	};

	var eResult, client, member, webAdmin;
	return caService.enroll(req)
		.then((enrollment) => {
			t.pass('Successfully enrolled \'' + req.enrollmentID + '\'.');
			eResult = enrollment;

			//check that we got back the expected certificate
			var subject;
			try {
				subject = X509.getSubject(FabricCAServices.normalizeX509(enrollment.certificate));
			} catch(err) {
				t.fail(util.format('Failed to parse enrollment cert\n%s\n. Error: %s', enrollment.certificate, err));
			}

			t.comment(util.format('Parsed subject: %j', subject));
			t.equal(subject.commonName, req.enrollmentID, 'Subject should be /CN=' + req.enrollmentID);

			return caService.cryptoPrimitives.importKey(enrollment.certificate);
		},(err) => {
			t.fail('Failed to enroll the admin. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);

			t.end();
		}).then((pubKey) => {
			t.pass('Successfully imported public key from the resulting enrollment certificate');

			var msp = new LocalMSP({
				id: ORGS[userOrg].mspid,
				cryptoSuite: caService.cryptoPrimitives
			});

			var signingIdentity = new SigningIdentity(eResult.certificate, pubKey, msp.getId(), msp.cryptoSuite,
				new Signer(msp.cryptoSuite, eResult.key));
			t.comment('Registering '+enrollmentID);
			return caService._fabricCAClient.register(enrollmentID, null, 'client', userOrg, 1, [], signingIdentity);
		},(err) => {
			t.fail('Failed to import the public key from the enrollment certificate. ' + err.stack ? err.stack : err);
			t.end();
		}).then((secret) => {
			console.log('secret: ' + JSON.stringify(secret));
			t.comment(secret);
			enrollmentSecret = secret; // to be used in the next test case

			t.pass('testUser \'' + enrollmentID + '\'');

			return hfc.newDefaultKeyValueStore({
				path: testUtil.KVS
			});
		},(err) => {
			t.fail(util.format('Failed to register "%s". %s', enrollmentID, err.stack ? err.stack : err));
			t.end();
		}).then((store) => {
			t.comment('Successfully constructed a state store');

			client = new hfc();
			client.setStateStore(store);
			member = new User('adminX');
			return member.setEnrollment(eResult.key, eResult.certificate, 'Org1MSP');
		}).then(() => {
			t.comment('Successfully constructed a user object based on the enrollment');
			return caService.register({enrollmentID: 'testUserX', affiliation: 'bank_X'}, member);
		},(err) => {
			t.fail('Failed to configure the user with proper enrollment materials.');
			t.end();
		}).then((secret) => {
			t.fail('Should not have been able to register user of a affiliation "bank_X" because "admin" does not belong to that affiliation');
			t.end();
		},(err) => {
			t.pass('Successfully rejected registration request "testUserX" in affiliation "bank_X"');

			return caService.register({enrollmentID: 'testUserX', affiliation: userOrg}, member);
		}).then((secret) => {
			t.pass('Successfully registered "testUserX" in affiliation "'+userOrg+'" with enrollment secret returned: ' + secret);

			return caService.revoke({enrollmentID: 'testUserX'}, member);
		},(err) => {
			t.fail('Failed to register "testUserX". '  + err.stack ? err.stack : err);
			t.end();
		}).then((response) => {
			t.equal(response.success, true, 'Successfully revoked "testUserX"');

			return caService.register({enrollmentID: 'testUserY', enrollmentSecret: 'testUserYSecret', affiliation: 'org2.department1'}, member);
		},(err) => {
			t.fail('Failed to revoke "testUserX". ' + err.stack ? err.stack : err);
			t.end();
		}).then((secret) => {
			t.equal(secret, 'testUserYSecret', 'Successfully registered another user "testUserY" with preset enrollment secret');

			return caService.enroll({enrollmentID: 'testUserY', enrollmentSecret: secret});
		}).then((enrollment) => {
			t.comment('Successfully enrolled "testUserY"');

			var cert;
			try {
				cert = X509.parseCert(FabricCAServices.normalizeX509(enrollment.certificate));
			} catch(err) {
				t.fail(util.format('Failed to parse enrollment cert\n%s\n. Error: %s', enrollment.certificate, err));
			}

			if (!cert.extensions || !cert.extensions.authorityKeyIdentifier) {
				t.fail(util.format('Parsed certificate does not contain Authority Key Identifier needed for revoke(): %j', cert));
			}

			// convert the raw AKI string in the form of 'keyid:HX:HX....' (HX represents a hex-encoded byte) to a hex string
			var akiString = cert.extensions.authorityKeyIdentifier;
			var arr = akiString.split(':');
			if (arr[0] !== 'keyid') {
				t.fail(util.format('Found an Autheority Key Identifier we do not understand: first segment is not "keyid": %s', akiString));
			}

			arr.shift(); // remove the 'keyid'
			var aki = arr.join('');
			var serial = cert.serial;

			t.comment(util.format('Ready to revoke certificate serial # "%s" with aki "%s"', serial, aki));

			return caService.revoke({serial: serial, aki: aki}, member);
			//return;
		}).then((response) => {
			t.equal(response.success, true, 'Successfully revoked "testUserY" using serial number and AKI');

			// register a new user 'webAdmin' that can register other users of the role 'client'
			return caService.register({enrollmentID: 'webAdmin', affiliation: 'org1.department2', attrs: [{name: 'hf.Registrar.Roles', value: 'client'}]}, member);
		}).then((secret) => {
			t.pass('Successfully registered "webAdmin" who can register other users of the "client" role');

			return caService.enroll({enrollmentID: 'webAdmin', enrollmentSecret: secret});
		},(err) => {
			t.fail('Failed to register "webAdmin". ' + err.stack ? err.stack : err);
			t.end();
		}).then((enrollment) => {
			t.pass('Successfully enrolled "webAdmin"');

			webAdmin = new User('webAdmin');
			return webAdmin.setEnrollment(enrollment.key, enrollment.certificate, 'Org1MSP');
		}).then(() => {
			t.pass('Successfully constructed User object for "webAdmin"');

			return caService.register({enrollmentID: 'auditor', role: 'auditor'}, webAdmin);
		}).then(() => {
			t.fail('Should not have been able to use "webAdmin" to register a user of the "auditor" role');
			t.end();
		},(err) => {
			t.pass('Successfully rejected attempt to register a user of invalid role. ' + err);

			return caService.register({enrollmentID: 'auditor', role: 'client', affiliation: 'org2.department1'}, webAdmin);
		}).then(() => {
			t.pass('Successfully registered "auditor" of role "client" from "webAdmin"');

			return caService.reenroll(webAdmin);
		}).then((res) => {
			t.pass('Successfully re-enrolled "webAdmin" user');

			t.equal(typeof res.key !== 'undefined' && res.key !== null, true, 'Checking re-enroll response has the private key');
			t.equal(typeof res.certificate !== 'undefined' && res.certificate !== null, true, 'Checking re-enroll response has the certificate');

			t.end();
		}).catch((err) => {
			t.fail('Failed at ' + err.stack ? err.stack : err);
			t.end();
		});
});

test('\n\n ** FabricCAClient: Test enroll With Static CSR **\n\n', function (t) {
	var endpoint = FabricCAServices._parseURL(fabricCAEndpoint);
	var client = new FabricCAClient({
		protocol: endpoint.protocol,
		hostname: endpoint.hostname,
		port: endpoint.port,
		tlsOptions: tlsOptions,
		caname: ORGS[userOrg].ca.name
	});

	t.comment(util.format('Sending enroll request for user %s with enrollment secret %s', enrollmentID, enrollmentSecret));
	return client.enroll(enrollmentID, enrollmentSecret, csr.toString())
		.then(function (enrollResponse) {
			t.comment(enrollResponse.enrollmentCert);
			t.pass('Successfully invoked enroll API with enrollmentID \'' + enrollmentID + '\'');
			//check that we got back the expected certificate
			var subject;
			try {
				subject = X509.getSubject(FabricCAServices.normalizeX509(enrollResponse.enrollmentCert));
			} catch(err) {
				t.fail(util.format('Failed to parse enrollment cert\n%s\n. Error: %s', enrollResponse.enrollmentCert, err));
			}
			t.comment(subject);
			t.equal(subject.commonName, enrollmentID, 'Subject should be /CN=' + enrollmentID);
			t.end();
		})
		.catch(function (err) {
			t.fail('Failed to enroll \'' + enrollmentID + '\'.  ' + err);
			t.end();
		});
});
