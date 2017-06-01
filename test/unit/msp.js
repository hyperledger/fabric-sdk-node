/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);
var rewire = require('rewire');

var path = require('path');
var grpc = require('grpc');
var utils = rewire('fabric-client/lib/utils.js');
var testutil = require('./util.js');
var MSP = require('fabric-client/lib/msp/msp.js');
var MSPM = require('fabric-client/lib/msp/msp-manager.js');
var idModule = require('fabric-client/lib/msp/identity.js');
var Identity = idModule.Identity;

var mspProto = grpc.load(path.join(__dirname, '../../fabric-client/lib/protos/msp/msp_config.proto')).msp;

const FABRIC = 0;
const TEST_CERT_PEM = '-----BEGIN CERTIFICATE-----' +
'MIIDVDCCAvqgAwIBAgIBATAKBggqhkjOPQQDAjBOMRMwEQYDVQQKDArOoyBBY21l' +
'IENvMRkwFwYDVQQDExB0ZXN0LmV4YW1wbGUuY29tMQ8wDQYDVQQqEwZHb3BoZXIx' +
'CzAJBgNVBAYTAk5MMB4XDTE2MTIxNjIzMTAxM1oXDTE2MTIxNzAxMTAxM1owTjET' +
'MBEGA1UECgwKzqMgQWNtZSBDbzEZMBcGA1UEAxMQdGVzdC5leGFtcGxlLmNvbTEP' +
'MA0GA1UEKhMGR29waGVyMQswCQYDVQQGEwJOTDBZMBMGByqGSM49AgEGCCqGSM49' +
'AwEHA0IABFKnXh7hBdp6s9OJ/aadigT1z2WzBbSc7Hzb3rkaWFz4e+9alqqWg9lr' +
'ur/mDYzG9dudC8jFjVa7KIh+2BxgBayjggHHMIIBwzAOBgNVHQ8BAf8EBAMCAgQw' +
'JgYDVR0lBB8wHQYIKwYBBQUHAwIGCCsGAQUFBwMBBgIqAwYDgQsBMA8GA1UdEwEB' +
'/wQFMAMBAf8wDQYDVR0OBAYEBAECAwQwDwYDVR0jBAgwBoAEAQIDBDBiBggrBgEF' +
'BQcBAQRWMFQwJgYIKwYBBQUHMAGGGmh0dHA6Ly9vY0JDQ1NQLmV4YW1wbGUuY29t' +
'MCoGCCsGAQUFBzAChh5odHRwOi8vY3J0LmV4YW1wbGUuY29tL2NhMS5jcnQwRgYD' +
'VR0RBD8wPYIQdGVzdC5leGFtcGxlLmNvbYERZ29waGVyQGdvbGFuZy5vcmeHBH8A' +
'AAGHECABSGAAACABAAAAAAAAAGgwDwYDVR0gBAgwBjAEBgIqAzAqBgNVHR4EIzAh' +
'oB8wDoIMLmV4YW1wbGUuY29tMA2CC2V4YW1wbGUuY29tMFcGA1UdHwRQME4wJaAj' +
'oCGGH2h0dHA6Ly9jcmwxLmV4YW1wbGUuY29tL2NhMS5jcmwwJaAjoCGGH2h0dHA6' +
'Ly9jcmwyLmV4YW1wbGUuY29tL2NhMS5jcmwwFgYDKgMEBA9leHRyYSBleHRlbnNp' +
'b24wCgYIKoZIzj0EAwIDSAAwRQIgcguBb6FUxO+X8DbY17gpqSGuNC4NT4BddPg1' +
'UWUxIC0CIQDNyHQAwzhw+512meXRwG92GfpzSBssDKLdwlrqiHOu5A==' +
'-----END CERTIFICATE-----';

test('\n\n** MSP Tests **\n\n', (t) => {
	testutil.resetDefaults();

	// construct MSP config objects for org0 and org1
	var configs = [];
	var mspm = new MSPM();

	t.throws(
		() => {
			mspm.loadMSPs({});
		},
		/"mspConfigs" argument must be an array/,
		'Check MSPManager.loadMSPs() arguments: must be an array'
	);

	t.throws(
		() => {
			mspm.loadMSPs([{
				getType: function() { return 'bad value'; }
			}]);
		},
		/MSP Configuration object type not supported/,
		'Check MSPManager.loadMSPs() arguments: each config must have getType() returning a number representing types'
	);

	t.throws(
		() => {
			mspm.loadMSPs([{
				getType: function() { return 0; }
			}]);
		},
		/MSP Configuration object missing the payload in the "Config" property/,
		'Check MSPManager.loadMSPs() arguments: each config must have getConfig() returning a valid FabricMSPConfig'
	);

	t.throws(
		() => {
			mspm.loadMSPs([{
				getType: function() { return 0; },
				getConfig: function() { return null; }
			}]);
		},
		/MSP Configuration object missing the payload in the "Config" property/,
		'Check MSPManager.loadMSPs() arguments: each config must have getConfig() returning a valid FabricMSPConfig'
	);

	loadMSPConfig('peerOrg0', 'org0')
	.then((config) => {
		t.pass('Successfully loaded msp config for org0');

		configs.push(config);

		return loadMSPConfig('peerOrg1', 'org1');
	}).then((config) => {
		t.pass('Successfully loaded msp config for org1');

		configs.push(config);

		mspm.loadMSPs(configs);

		var msps = mspm.getMSPs();
		for (var mspid in msps) {
			if (msps.hasOwnProperty(mspid)) {
				let msp = msps[mspid];
				t.equal(msp.getId(), mspid, 'Check loaded MSP instance for id');
				t.notEqual(msp._rootCerts, null, 'Check loaded MSP instance of non-null root certs');
				t.notEqual(msp._admins, null, 'Check loaded MSP instance of non-null admin certs');
				t.notEqual(msp._cryptoSuite, null, 'Check loaded MSP instance of non-null crypto suite');
				t.equal(msp.getOrganizationUnits().length,0,'Check loaded MSP instance for orgs');
				t.notEqual(msp._intermediateCerts,null,'Check loaded MSP instance for intermediateCerts');
			}
		}

		utils.addMSPManager('channel1', mspm);
		// use the special getter provided by rewire to get access to the module-scoped variable
		var mspManagers = utils.__get__('mspManagers');
		t.equal(mspManagers['channel1'] instanceof MSPM, true, 'Checking if an instance of MSP exists under key "channel1"');

		t.equal(utils.getMSPManager('channel1'), mspm, 'Testing utils.getMSPManager()');

		utils.removeMSPManager('channel1');
		t.equal(typeof mspManagers['channel1'], 'undefined', 'Testing utils.removeMSPManager()');

		// test deserialization using the msp manager
		var cryptoUtils = utils.newCryptoSuite();
		cryptoUtils.setCryptoKeyStore(utils.newCryptoKeyStore());
		var mspImpl = new MSP({
			rootCerts: [],
			admins: [],
			id: 'peerOrg0',
			cryptoSuite: cryptoUtils
		});

		var pubKey = cryptoUtils.importKey(TEST_CERT_PEM);
		var identity = new Identity(TEST_CERT_PEM, pubKey, mspImpl.getId(), cryptoUtils);

		var serializedID = identity.serialize();
		return mspm.deserializeIdentity(serializedID);
	}).then((identity) => {
		t.equal(identity.getMSPId(), 'peerOrg0', 'Deserialized identity using MSP manager');

		t.equal(mspm.getMSP('peerOrg0').getId(), 'peerOrg0', 'Checking MSPManager getMSP() method' );
		t.end();
	}).catch((err) => {
		t.fail(err.stack ? err.stack : err);
		t.end();
	});
});

function loadMSPConfig(name, org) {
	var mspConfig, fConfig;

	return new Promise((resolve, reject) => {
		mspConfig = new mspProto.MSPConfig();
		mspConfig.setType(FABRIC); // type: FABRIC

		fConfig = new mspProto.FabricMSPConfig();
		fConfig.setName(name);

		return testutil.readFile(path.join(__dirname, '../fixtures/msp', org, 'cacerts/org_ca.pem'))
		.then((data) => {
			fConfig.setRootCerts([data]);
			return testutil.readFile(path.join(__dirname, '../fixtures/msp', org, 'admincerts/admin.pem'));
		}).then((data) => {
			fConfig.setAdmins([data]);

			mspConfig.setConfig(fConfig.toBuffer());
			return resolve(mspConfig);
		});
	});
}