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

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);


var hfc = require('fabric-client');

var X509 = require('jsrsasign').X509;

var util = require('util');
var fs = require('fs');
var path = require('path');
var testUtil = require('../unit/util.js');
var utils = require('fabric-client/lib/utils.js');
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
var csr = fs.readFileSync(path.resolve(__dirname, '../fixtures/fabriccop/enroll-csr.pem'));

var tlsOptions;
var fabricCAProtocol = 'http';
var fabricCAHost = 'localhost';
var fabricCAPort = 7054;

// set environment variable FABRIC_CA_TLS=true to run tests with TLS enabled
if (process.env.FABRIC_CA_TLS=='true'){
	fabricCAProtocol = 'https';
	tlsOptions = {
		trustedRoots: [],
		verify: false
	};
}
var fabricCAEndpoint = fabricCAProtocol + '://' + fabricCAHost + ':' + fabricCAPort;


/**
 * FabricCAServices class tests
 */

//run the enroll test

test('FabricCAServices: Test enroll() With Dynamic CSR', function (t) {

	var cop = new FabricCAServices(fabricCAEndpoint,tlsOptions, {keysize: 256, hash: 'SHA2'});

	var req = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw'
	};

	var eResult, client, member, webAdmin;
	return cop.enroll(req)
		.then((enrollment) => {
			t.pass('Successfully enrolled \'' + req.enrollmentID + '\'.');
			eResult = enrollment;

			//check that we got back the expected certificate
			var cert = new X509();
			cert.readCertPEM(enrollment.certificate);
			t.comment(cert.getSubjectString());
			t.equal(cert.getSubjectString(), '/CN=' + req.enrollmentID, 'Subject should be /CN=' + req.enrollmentID);

			return cop.cryptoPrimitives.importKey(enrollment.certificate);
		},(err) => {
			t.fail('Failed to enroll the admin. Can not progress any further. Exiting. ' + err.stack ? err.stack : err);

			t.end();
		}).then((pubKey) => {
			t.pass('Successfully imported public key from the resulting enrollment certificate');

			var msp = new LocalMSP({
				id: 'DEFAULT',
				cryptoSuite: cop.cryptoPrimitives
			});

			var signingIdentity = new SigningIdentity('testSigningIdentity', eResult.certificate, pubKey, msp, new Signer(msp.cryptoSuite, eResult.key));

			return cop._fabricCAClient.register(enrollmentID, 'client', 'org1', 1, [], signingIdentity);
		},(err) => {
			t.fail('Failed to import the public key from the enrollment certificate. ' + err.stack ? err.stack : err);
			t.end();
		}).then((secret) => {
			console.log('secret: ' + JSON.stringify(secret));
			t.comment(secret);
			enrollmentSecret = secret; // to be used in the next test case

			t.pass('Successfully invoked register API with enrollmentID \'' + enrollmentID + '\'');

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
			member = new User('adminX', client);
			return member.setEnrollment(eResult.key, eResult.certificate, 'Org1MSP');
		}).then(() => {
			t.comment('Successfully constructed a user object based on the enrollment');
			return cop.register({enrollmentID: 'testUserX', affiliation: 'bank_X'}, member);
		},(err) => {
			t.fail('Failed to configuration the user with proper enrollment materials.');
			t.end();
		}).then((secret) => {
			t.fail('Should not have been able to register user of a affiliation "bank_X" because "admin" does not belong to that affiliation');
			t.end();
		},(err) => {
			t.pass('Successfully rejected registration request "testUserX" in affiliation "bank_X"');

			return cop.register({enrollmentID: 'testUserX', affiliation: 'org1'}, member);
		}).then((secret) => {
			t.pass('Successfully registered "testUserX" in affiliation "org1" with enrollment secret returned: ' + secret);

			return cop.revoke({enrollmentID: 'testUserX'}, member);
		},(err) => {
			t.fail('Failed to register "testUserX". '  + err.stack ? err.stack : err);
			t.end();
		}).then((response) => {
			t.equal(response.success, true, 'Successfully revoked "testUserX"');

			return cop.register({enrollmentID: 'testUserY', affiliation: 'org2.department1'}, member);
		},(err) => {
			t.fail('Failed to revoke "testUserX". ' + err.stack ? err.stack : err);
			t.end();
		}).then((secret) => {
			t.comment('Successfully registered another user "testUserY"');

			return cop.enroll({enrollmentID: 'testUserY', enrollmentSecret: secret});
		}).then((enrollment) => {
			t.comment('Successfully enrolled "testUserY"');

			var cert = new X509();
			cert.readCertPEM(enrollment.certificate);
			var aki = X509.getExtAuthorityKeyIdentifier(cert.hex).kid;
			var serial = cert.getSerialNumberHex();

			t.comment(util.format('Ready to revoke certificate serial # "%s" with aki "%s"', serial, aki));

			return cop.revoke({serial: serial, aki: aki}, member);
			//return;
		}).then((response) => {
			t.equal(response.success, true, 'Successfully revoked "testUserY" using serial number and AKI');

			// register a new user 'webAdmin' that can register other users of the role 'client'
			return cop.register({enrollmentID: 'webAdmin', affiliation: 'org1.department2', attrs: [{name: 'hf.Registrar.Roles', value: 'client'}]}, member);
		}).then((secret) => {
			t.pass('Successfully registered "webAdmin" who can register other users of the "client" role');

			return cop.enroll({enrollmentID: 'webAdmin', enrollmentSecret: secret});
		},(err) => {
			t.fail('Failed to register "webAdmin". ' + err.stack ? err.stack : err);
			t.end();
		}).then((enrollment) => {
			t.pass('Successfully enrolled "webAdmin"');

			webAdmin = new User('webAdmin', client);
			return webAdmin.setEnrollment(enrollment.key, enrollment.certificate, 'Org1MSP');
		}).then(() => {
			t.pass('Successfully constructed User object for "webAdmin"');

			return cop.register({enrollmentID: 'auditor', role: 'auditor'}, webAdmin);
		}).then(() => {
			t.fail('Should not have been able to use "webAdmin" to register a user of the "auditor" role');
			t.end();
		},(err) => {
			t.pass('Successfully rejected attempt to register a user of invalid role. ' + err);

			return cop.register({enrollmentID: 'auditor', role: 'client', affiliation: 'org2.department1'}, webAdmin);
		}).then(() => {
			t.pass('Successfully registered "auditor" of role "client" from "webAdmin"');
			t.end();
		}).catch((err) => {
			t.fail('Failed at ' + err.stack ? err.stack : err);
			t.end();
		});
});

test('FabricCAClient: Test enroll With Static CSR', function (t) {

	var client = new FabricCAClient({
		protocol: fabricCAProtocol,
		hostname: fabricCAHost,
		port: fabricCAPort,
		tlsOptions: tlsOptions
	});

	t.comment(util.format('Sending enroll request for user %s with enrollment secret %s', enrollmentID, enrollmentSecret));
	return client.enroll(enrollmentID, enrollmentSecret, csr.toString())
		.then(function (enrollResponse) {
			t.comment(enrollResponse.enrollmentCert);
			t.pass('Successfully invoked enroll API with enrollmentID \'' + enrollmentID + '\'');
			//check that we got back the expected certificate
			var cert = new X509();
			cert.readCertPEM(enrollResponse.enrollmentCert);
			t.comment(cert.getSubjectString());
			t.equal(cert.getSubjectString(), '/CN=' + enrollmentID, 'Subject should be /CN=' + enrollmentID);
			t.end();
		})
		.catch(function (err) {
			t.fail('Failed to enroll \'' + enrollmentID + '\'.  ' + err);
			t.end();
		});
});
