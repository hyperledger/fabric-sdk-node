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

var AffiliationService = require('fabric-ca-client/lib/AffiliationService.js');
var FabricCAServices = require('fabric-ca-client/lib/FabricCAClientImpl');
var FabricCAClient = FabricCAServices.FabricCAClient;

test('AffiliationService: Test create() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let affiliation = new AffiliationService(client);

	t.throws(()=> {
		affiliation.create();
	},
	/Missing required argument "req"/,
	'Must fail if missing request argument');

	t.throws(()=> {
		affiliation.create({name: null});
	},
	/Missing required parameters.  "req.name" is required./,
	'Must fail if missing req.name argument');

	t.throws(()=> {
		affiliation.create({name: 'name'});
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		affiliation.create({name: 'name'}, {});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		affiliation.create({name: 'name'}, {getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('AffiliationService: Test getOne() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let affiliation = new AffiliationService(client);

	t.throws(()=> {
		affiliation.getOne();
	},
	/Missing required argument "affiliation", or argument "affiliation" is not a valid string/,
	'Must fail if missing affiliation argument');

	t.throws(()=> {
		affiliation.getOne('affiliation');
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		affiliation.getOne('affiliation', {});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		affiliation.getOne('affiliation', {getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('AffiliationService: Test getAll() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let affiliation = new AffiliationService(client);

	t.throws(()=> {
		affiliation.getAll();
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		affiliation.getAll({});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		affiliation.getAll({getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('AffiliationService: Test delete() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let affiliation = new AffiliationService(client);

	t.throws(()=> {
		affiliation.delete();
	},
	/Missing required argument "req"/,
	'Must fail if missing request argument');

	t.throws(()=> {
		affiliation.delete({name: null});
	},
	/Missing required argument "req.name", or argument "req.name" is not a valid string/,
	'Must fail if missing or invalid req.name argument');

	t.throws(()=> {
		affiliation.delete({name: 'name'});
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		affiliation.delete({name: 'name'}, {});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		affiliation.delete({name: 'name'}, {getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('AffiliationService: Test update() function', function (t) {
	let client = new FabricCAClient({protocol: 'http', hostname: '127.0.0.1', port: 7054});
	let affiliation = new AffiliationService(client);

	t.throws(()=> {
		affiliation.update();
	},
	/Missing required argument "affiliation", or argument "affiliation" is not a valid string/,
	'Must fail if missing affiliation argument');

	t.throws(()=> {
		affiliation.update('affiliation');
	},
	/Missing required argument "req"/,
	'Must fail if missing request argument');

	t.throws(()=> {
		affiliation.update('affiliation', {name: null});
	},
	/Missing required argument "req.name", or argument "req.name" is not a valid string/,
	'Must fail if missing or invalid req.name argument');

	t.throws(()=> {
		affiliation.update('affiliation', {name: 'name'});
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(()=> {
		affiliation.update('affiliation', {name: 'name'}, {});
	},
	/Argument "registrar" must be an instance of the class "User", but is found to be missing a method "getSigningIdentity/,
	'Must fail if registrar argument is not a User object');

	t.throws(()=> {
		affiliation.update('affiliation', {name: 'name'}, {getSigningIdentity: function() {return;}});
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

