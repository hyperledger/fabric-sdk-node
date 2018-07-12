/**
 * Copyright 2018 Hitachi America Ltd.  All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const IdentityService = require('fabric-ca-client/lib/IdentityService.js');
const FabricCAServices = require('fabric-ca-client/lib/FabricCAClientImpl');
const FabricCAClient = FabricCAServices.FabricCAClient;
const User = require('../../fabric-ca-client/lib/User');

test('IdentityService: Test create() function', (t) => {
	const client = new FabricCAClient({ protocol: 'http', hostname: '127.0.0.1', port: 7054 });
	const identity = new IdentityService(client);

	t.throws(() => {
		identity.create();
	},
	/Missing required argument "req"/,
	'Must fail if missing request argument');

	t.throws(() => {
		identity.create({ enrollmentID: null });
	},
	/Missing required parameters. "req.enrollmentID", "req.affiliation" are all required./,
	'Must fail if missing req.enrollmentID and req.affiliation argument');

	t.throws(() => {
		identity.create({ enrollmentID: 'dummy', affiliation: 'dummy' });
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(() => {
		identity.create({ enrollmentID: 'dummy', affiliation: 'dummy' }, {});
	},
	/Argument "registrar" must be an instance of the class "User"/,
	'Must fail if registrar argument is not a User object');

	t.throws(() => {
		const registrar = new User('bob');
		identity.create({ enrollmentID: 'dummy', affiliation: 'dummy' }, registrar);
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('IdentityService: Test getOne() function', (t) => {
	const client = new FabricCAClient({ protocol: 'http', hostname: '127.0.0.1', port: 7054 });
	const identity = new IdentityService(client);

	t.throws(() => {
		identity.getOne();
	},
	/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/,
	'Must fail if missing or invalid enrollmentID argument');

	t.throws(() => {
		identity.getOne('enrollmentID');
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(() => {
		identity.getOne('enrollmentID', {});
	},
	/Argument "registrar" must be an instance of the class "User"/,
	'Must fail if registrar argument is not a User object');

	t.throws(() => {
		const registrar = new User('bob');
		identity.getOne('enrollmentID', registrar);
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('IdentityService: Test getAll() function', (t) => {
	const client = new FabricCAClient({ protocol: 'http', hostname: '127.0.0.1', port: 7054 });
	const identity = new IdentityService(client);

	t.throws(() => {
		identity.getAll();
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(() => {
		identity.getAll({});
	},
	/Argument "registrar" must be an instance of the class "User"/,
	'Must fail if registrar argument is not a User object');

	t.throws(() => {
		const registrar = new User('bob');
		identity.getAll(registrar);
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('IdentityService: Test delete() function', (t) => {
	const client = new FabricCAClient({ protocol: 'http', hostname: '127.0.0.1', port: 7054 });
	const identity = new IdentityService(client);

	t.throws(() => {
		identity.delete();
	},
	/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/,
	'Must fail if missing or invalid enrollmentID argument');

	t.throws(() => {
		identity.delete('enrollmentID');
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(() => {
		identity.delete('enrollmentID', {});
	},
	/Argument "registrar" must be an instance of the class "User"/,
	'Must fail if registrar argument is not a User object');

	t.throws(() => {
		const registrar = new User('bob');
		identity.delete('enrollmentID', registrar);
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

test('IdentityService: Test update() function', (t) => {
	const client = new FabricCAClient({ protocol: 'http', hostname: '127.0.0.1', port: 7054 });
	const identity = new IdentityService(client);

	t.throws(() => {
		identity.update();
	},
	/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/,
	'Must fail if missing or invalid enrollmentID argument');

	t.throws(() => {
		identity.update('enrollmentID', {});
	},
	/Missing required argument "registrar"/,
	'Must fail if missing registrar argument');

	t.throws(() => {
		identity.update('enrollmentID', {}, {});
	},
	/Argument "registrar" must be an instance of the class "User"/,
	'Must fail if registrar argument is not a User object');

	t.throws(() => {
		const registrar = new User('bob');
		identity.update('enrollmentID', {}, registrar);
	},
	/Can not get signingIdentity from registrar/,
	'Must fail if missing signingIdentity');

	t.end();
});

