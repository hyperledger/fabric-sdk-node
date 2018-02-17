/**
 * Copyright 2018 Hitachi America Ltd.  All Rights Reserved.
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

var IdentityService = require('fabric-ca-client/lib/IdentityService.js');
var FabricCAServices = require('fabric-ca-client/lib/FabricCAClientImpl');
var FabricCAClient = FabricCAServices.FabricCAClient;

test('IdentityService: Test create() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let identity = new IdentityService(client);

	t.throws(()=> {
		identity.create();
	},
	/Missing required argument "req"/,
	'Must fail if missing request argument');

	t.throws(()=> {
		identity.create({enrollmentID: null});
	},
	/Missing required parameters.  "req.enrollmentID", "req.affiliation" are all required./,
	'Must fail if missing req.enrollmentID and req.affiliation argument');

	t.throws(()=> {
		identity.create({enrollmentID: 'dummy', affiliation: 'dummy'});
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, {});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, {getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('IdentityService: Test getOne() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let identity = new IdentityService(client);

	t.throws(()=> {
		identity.getOne();
	},
	/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/,
	'Must fail if missing or invalid enrollmentID argument');

	t.throws(()=> {
		identity.getOne('enrollmentID');
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		identity.getOne('enrollmentID', {});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		identity.getOne('enrollmentID', {getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('IdentityService: Test getAll() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let identity = new IdentityService(client);

	t.throws(()=> {
		identity.getAll();
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		identity.getAll({});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		identity.getAll({getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('IdentityService: Test delete() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let identity = new IdentityService(client);

	t.throws(()=> {
		identity.delete();
	},
	/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/,
	'Must fail if missing or invalid enrollmentID argument');

	t.throws(()=> {
		identity.delete('enrollmentID');
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		identity.delete('enrollmentID', {});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		identity.delete('enrollmentID', {getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('IdentityService: Test update() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let identity = new IdentityService(client);

	t.throws(()=> {
		identity.update();
	},
	/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/,
	'Must fail if missing or invalid enrollmentID argument');

	t.throws(()=> {
		identity.update('enrollmentID', {});
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		identity.update('enrollmentID', {}, {});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		identity.update('enrollmentID', {}, {getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

