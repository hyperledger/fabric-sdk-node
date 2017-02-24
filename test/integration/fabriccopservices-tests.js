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

/**
 * FabricCAServices class tests
 */

//run the enroll test

test('FabricCAServices: Test enroll() With Dynamic CSR', function (t) {

	// need to override the default key size 384 to match the member service backend
	// otherwise the client will not be able to decrypt the enrollment challenge
	utils.setConfigSetting('crypto-keysize', 256);

	var cop = new FabricCAServices('http://localhost:7054');

	var req = {
		enrollmentID: 'admin',
		enrollmentSecret: 'adminpw'
	};

	var eResult, client, member;
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
		}).then((pubKey) => {
			t.pass('Successfully imported public key from the resulting enrollment certificate');

			var msp = new LocalMSP({
				id: 'DEFAULT',
				cryptoSuite: cop.cryptoPrimitives
			});

			var signingIdentity = new SigningIdentity('testSigningIdentity', eResult.certificate, pubKey, msp, new Signer(msp.cryptoSuite, eResult.key));

			return cop._fabricCAClient.register(enrollmentID, 'client', 'bank_a', [], signingIdentity);
		}).then((secret) => {
			t.comment(secret);
			enrollmentSecret = secret; // to be used in the next test case

			t.pass('Successfully invoked register API with enrollmentID \'' + enrollmentID + '\'');

			return hfc.newDefaultKeyValueStore({
				path: testUtil.KVS
			});
		}).then((store) => {
			t.comment('Successfully constructed a state store');

			client = new hfc();
			client.setStateStore(store);
			member = new User('adminX', client);
			return member.setEnrollment(eResult.key, eResult.certificate);
		}).then(() => {
			t.comment('Successfully constructed a user object based on the enrollment');

			return cop.register({enrollmentID: 'testUserX', group: 'bank_a'}, member);
		}).then((secret) => {
			t.pass('Successfully enrolled "testUserX" in group "bank_a" with enrollment secret returned: ' + secret);

			return cop.revoke({enrollmentID: 'testUserX'}, member);
		}).then((response) => {
			t.equal(response.success, true, 'Successfully revoked "testUserX"');

			return cop.register({enrollmentID: 'testUserY', group: 'bank_a'}, member);
		}).then((secret) => {
			t.comment('Successfully registered another user "testUserY"');

			return cop.enroll({enrollmentID: 'testUserY', enrollmentSecret: secret}, member);
		}).then((enrollment) => {
			t.comment('Successfully enrolled "testUserY"');

			var cert = new X509();
			cert.readCertPEM(enrollment.certificate);
			var aki = X509.getExtAuthorityKeyIdentifier(cert.hex).kid;
			var serial = cert.getSerialNumberHex();

			t.comment(util.format('Ready to revoke certificate serial # "%s" with aki "%s"', serial, aki));

			return cop.revoke({serial: serial, aki: aki}, member);
		}).then((response) => {
			t.equal(response.success, true, 'Successfully revoked "testUserY" using serial number and AKI');

			t.end();
		}).catch((err) => {
			t.fail('Failed at ' + err.stack ? err.stack : err);
			t.end();
		});
});

test('FabricCAClient: Test enroll With Static CSR', function (t) {

	var client = new FabricCAClient({
		protocol: 'http',
		hostname: '127.0.0.1',
		port: 7054
	});

	t.comment(util.format('Sending enroll request for user %s with enrollment secret %s', enrollmentID, enrollmentSecret));
	return client.enroll(enrollmentID, enrollmentSecret, csr.toString())
		.then(function (pem) {
			t.comment(pem);
			t.pass('Successfully invoked enroll API with enrollmentID \'' + enrollmentID + '\'');
			//check that we got back the expected certificate
			var cert = new X509();
			cert.readCertPEM(pem);
			t.comment(cert.getSubjectString());
			t.equal(cert.getSubjectString(), '/CN=' + enrollmentID, 'Subject should be /CN=' + enrollmentID);
			t.end();
		})
		.catch(function (err) {
			t.fail('Failed to enroll \'' + enrollmentID + '\'.  ' + err);
			t.end();
		});
});
