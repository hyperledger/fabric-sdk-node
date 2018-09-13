/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const testutil = require('./util.js');

const Remote = require('fabric-client/lib/Remote.js');
const Peer = require('fabric-client/lib/Peer.js');
const Orderer = require('fabric-client/lib/Orderer.js');
const utils = require('fabric-client/lib/utils.js');

const aPem = '-----BEGIN CERTIFICATE-----' +
	'MIIBwTCCAUegAwIBAgIBATAKBggqhkjOPQQDAzApMQswCQYDVQQGEwJVUzEMMAoG' +
	'A1UEChMDSUJNMQwwCgYDVQQDEwNPQkMwHhcNMTYwMTIxMjI0OTUxWhcNMTYwNDIw' +
	'MjI0OTUxWjApMQswCQYDVQQGEwJVUzEMMAoGA1UEChMDSUJNMQwwCgYDVQQDEwNP' +
	'QkMwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAR6YAoPOwMzIVi+P83V79I6BeIyJeaM' +
	'meqWbmwQsTRlKD6g0L0YvczQO2vp+DbxRN11okGq3O/ctcPzvPXvm7Mcbb3whgXW' +
	'RjbsX6wn25tF2/hU6fQsyQLPiJuNj/yxknSjQzBBMA4GA1UdDwEB/wQEAwIChDAP' +
	'BgNVHRMBAf8EBTADAQH/MA0GA1UdDgQGBAQBAgMEMA8GA1UdIwQIMAaABAECAwQw' +
	'CgYIKoZIzj0EAwMDaAAwZQIxAITGmq+x5N7Q1jrLt3QFRtTKsuNIosnlV4LR54l3' +
	'yyDo17Ts0YLyC0pZQFd+GURSOQIwP/XAwoMcbJJtOVeW/UL2EOqmKA2ygmWX5kte' +
	'9Lngf550S6gPEWuDQOcY95B+x3eH' +
	'-----END CERTIFICATE-----';
const defaultCiphers = 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256' +
	':ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-GCM-SHA384' +
	':ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-SHA256' +
	':ECDHE-ECDSA-AES256-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384';

const aHost = 'atesthostname:9999';
const url = 'grpcs://' + aHost;
const aHostnameOverride = 'atesthostnameoverride';

test('\n\n ** Remote node tests **\n\n', async (t) => {
	testutil.resetDefaults();

	t.comment('\n * REMOTE *');
	//Peer: secure grpcs, requires opts.pem
	let opts = { pem: aPem };
	let remote = null;
	t.throws(
		() => {
			remote = new Remote(url);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Remote should throw PEM encoded certificate is required.'
	);

	t.doesNotThrow(
		() => {
			remote = new Remote(url, {pem: aPem});
		},
		'Check not passing any GRPC options.'
	);

	t.throws(
		() => {
			remote = new Remote(url, {pem: aPem, clientKey: aPem});
		},
		/^Error: clientKey and clientCert are both required./,
		'GRPCS Options tests: new Remote should throw clientKey and clientCert are both required.'
	);

	t.throws(
		() => {
			remote = new Remote(url, {pem: aPem, clientCert: aPem});
		},
		/^Error: clientKey and clientCert are both required./,
		'GRPCS Options tests: new Remote should throw clientKey and clientCert are both required.'
	);

	t.doesNotThrow(
		() => {
			remote = new Remote(url, {pem: aPem, clientKey: aPem, clientCert: aPem});
		},
		'Pass valid client certificate options.'
	);

	t.throws(
		() => {
			remote = new Remote(url, {pem: aPem, anyStringKey: Buffer.alloc(1)});
		},
		/invalid grpc option value/,
		'GRPC Options tests: invalid grpc option value.'
	);

	t.doesNotThrow(
		() => {
			remote = new Remote(url, {pem: aPem, [Symbol(1)]: ''});
		},
		'GRPC Options tests: non-string option key is allowed but ignored'
	);

	opts = {pem: aPem, 'grpc-wait-for-ready-timeout': '1000'};
	t.throws(
		() => {
			remote = new Remote(url, opts);
		},
		/^Error: Expect an integer value of grpc-wait-for-ready-timeout, found string/,
		'Should throw error if timeout is not an integer'
	);

	opts = { pem: aPem, 'ssl-target-name-override': aHostnameOverride };
	remote = new Remote(url, opts);
	t.equal(remote._endpoint.addr, aHost, 'GRPC Options tests: new Remote grpcs with opts created');
	t.equal(remote.getName(), aHost, 'checking the name assignment');
	t.equal(remote.toString(), ' Remote : {url:grpcs://atesthostname:9999}', 'Checking that peer.toString() reports correctly');
	t.equal(remote._grpc_wait_for_ready_timeout, 3000, 'Remote should have grpc waitForReady timeout default to 3000');
	t.ok(remote._endpoint.creds, 'GRPC Options tests: new Remote grpc with opts = null _endpoint.creds created');

	const dummy_name = 'areallygreatname';
	opts = {
		pem: aPem,
		'grpc.dummy_property': 'some_value',
		'ssl-target-name-override': aHostnameOverride,
		'grpc-wait-for-ready-timeout': 500,
		'name': dummy_name
	};
	remote = new Remote(url, opts);
	t.equal(remote.getName(), dummy_name, 'Check passing in the name option');
	t.equal(aHostnameOverride, remote._options['grpc.ssl_target_name_override'], 'GRPC Options tests: new Remote grpc with opts ssl-target-name-override created');
	t.ok(remote._endpoint.creds, 'GRPC Options tests: new Remote grpc with opts _endpoint.creds created');
	t.equal('some_value', remote._options['grpc.dummy_property'], 'GRPC options tests: pass-through option properties');
	t.equal(remote.getUrl(), url, 'checking that getURL works');
	t.equal(remote._grpc_wait_for_ready_timeout, 500, 'Remote should have grpc waitForReady timeout equals 500');

	t.comment('\n * PEER *');
	//Peer: secure grpcs, requires opts.pem
	opts = { pem: aPem };
	let peer = null;
	t.doesNotThrow(
		() => {
			peer = new Peer(url, opts);
		},
		'Check not passing any GRPC options.'
	);

	peer = new Peer(url, {pem: aPem, clientKey: aPem, clientCert: aPem});
	try {
		await peer.sendProposal({}, 100);
	} catch(error) {
		if(error.toString().includes(peer.getUrl())) {
			t.pass('Successfully got the waitForReady URL address error');
		} else {
			t.fail('Failed to get the waitForReady URL address error');
		}
	}

	opts = { pem: aPem, 'ssl-target-name-override': aHostnameOverride };
	peer = new Peer(url, opts);
	t.equal(aHost, peer._endpoint.addr, 'GRPC Options tests: new Peer grpcs with opts created');
	t.equal(peer.toString(), 'Peer:{url:grpcs://atesthostname:9999}', 'Checking that peer.toString() reports correctly');
	t.equal(peer._grpc_wait_for_ready_timeout, 3000, 'Peer should have _grpc_wait_for_ready_timeout equals 3000');
	t.ok(peer._endpoint.creds, 'GRPC Options tests: new Peer grpc with opts = null _endpoint.creds created');

	opts = { pem: aPem, 'ssl-target-name-override': aHostnameOverride };
	peer = new Peer(url, opts);
	t.equal(aHost, peer._endpoint.addr, 'GRPC Options tests: new Peer grpc with opts _endpoint.addr created');
	t.ok(peer._endpoint.creds, 'GRPC Options tests: new Peer grpc with opts _endpoint.creds created');
	t.equal(peer.getUrl(), url, 'checking that getURL works');

	t.throws(
		() => {
			peer = new Peer('http://somehost:8888', opts);
		},
		/^InvalidProtocol: Invalid protocol: http./,
		'GRPC Options tests: new Peer http should throw ' +
		'InvalidProtocol: Invalid protocol: http. URLs must begin with grpc:// or grpcs://.'
	);

	opts = {};
	t.throws(
		() => {
			peer = new Peer(url, opts);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw ' +
		'PEM encoded certificate is required.'
	);

	t.throws(
		() => {
			peer = new Peer(url);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Peer http should throw ' +
		'PEM encoded certificate is required.'
	);

	opts = {pem: aPem, clientKey: aPem, clientCert: aPem};
	t.doesNotThrow(
		() => {
			peer = new Peer(url, opts);
		},
		'Pass valid client certificate options.'
	);

	opts = {pem: aPem, clientKey: aPem};
	t.throws(
		() => {
			peer = new Peer(url, opts);
		},
		/^Error: clientKey and clientCert are both required./,
		'GRPCS Options tests: new Peer should throw ' +
		'clientKey and clientCert are both required.'
	);

	opts = {pem: aPem, clientCert: aPem};
	t.throws(
		() => {
			peer = new Peer(url, opts);
		},
		/^Error: clientKey and clientCert are both required./,
		'GRPCS Options tests: new Peer should throw ' +
		'clientKey and clientCert are both required.'
	);

	t.comment('\n * ORDERER *');
	//Peer: secure grpcs, requires opts.pem
	opts = { pem: aPem };
	let orderer = null;
	t.doesNotThrow(
		() => {
			orderer = new Orderer(url, opts);
		},
		'Check not passing any GRPC options.'
	);

	opts = { pem: aPem, 'ssl-target-name-override': aHostnameOverride };
	orderer = new Orderer(url, opts);
	t.equal(aHost, orderer._endpoint.addr, 'GRPC Options tests: new Orderer grpcs with opts created');
	t.equal(orderer.toString(), 'Orderer:{url:grpcs://atesthostname:9999}', 'Checking that orderer.toString() reports correctly');
	t.equal(orderer._grpc_wait_for_ready_timeout, 3000, 'orderer should have _grpc_wait_for_ready_timeout equals 3000');
	t.ok(orderer._endpoint.creds, 'GRPC Options tests: new Orderer grpc with opts = null _endpoint.creds created');

	opts = { pem: aPem, 'ssl-target-name-override': aHostnameOverride };
	orderer = new Orderer(url, opts);
	t.equal(aHost, orderer._endpoint.addr, 'GRPC Options tests: new Orederer grpc with opts _endpoint.addr created');
	t.ok(orderer._endpoint.creds, 'GRPC Options tests: new Orderer grpc with opts _endpoint.creds created');

	opts = { pem: aPem, 'request-timeout': 2000 };
	orderer = new Orderer(url, opts);
	t.equals(orderer._request_timeout, 2000, 'checking that the request timeout was set using the passed in value');

	t.throws(
		() => {
			orderer = new Orderer('http://somehost:8888', opts);
		},
		/^InvalidProtocol: Invalid protocol: http./,
		'GRPC Options tests: new Orderer should throw ' +
		'InvalidProtocol: Invalid protocol: http. URLs must begin with grpc:// or grpcs://.'
	);

	opts = {};
	t.throws(
		() => {
			orderer = new Orderer(url, opts);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Orderer should throw ' +
		'PEM encoded certificate is required.'
	);

	t.throws(
		() => {
			orderer = new Orderer(url);
		},
		/^Error: PEM encoded certificate is required./,
		'GRPCS Options tests: new Orderer should throw ' +
		'PEM encoded certificate is required.'
	);

	opts = {pem: aPem, clientKey: aPem, clientCert: aPem};
	t.doesNotThrow(
		() => {
			orderer = new Orderer(url, opts);
		},
		'Pass valid client certificate options.'
	);

	opts = {pem: aPem, clientKey: aPem};
	t.throws(
		() => {
			orderer = new Orderer(url, opts);
		},
		/^Error: clientKey and clientCert are both required./,
		'GRPCS Options tests: new Orderer should throw ' +
		'clientKey and clientCert are both required.'
	);

	opts = {pem: aPem, clientCert: aPem};
	t.throws(
		() => {
			orderer = new Orderer(url, opts);
		},
		/^Error: clientKey and clientCert are both required./,
		'GRPCS Options tests: new Orderer should throw ' +
		'clientKey and clientCert are both required.'
	);

	require('fabric-client/lib/Client.js');
	t.equal(process.env.GRPC_SSL_CIPHER_SUITES, defaultCiphers, 'Test default ssl cipher suites are properly set');

	utils.setConfigSetting('grpc-ssl-cipher-suites', 'HIGH+ECDSA');
	delete require.cache[require.resolve('fabric-client/lib/Client.js')];
	require('fabric-client/lib/Client.js');
	t.equal(process.env.GRPC_SSL_CIPHER_SUITES, 'HIGH+ECDSA', 'Test overriden cipher suites');

	t.end();
});
