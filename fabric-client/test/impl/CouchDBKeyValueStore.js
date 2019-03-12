/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const CouchDBKeyValueStoreRW = rewire('../../lib/impl/CouchDBKeyValueStore');
const CouchDBKeyValueStore = require('../../lib/impl/CouchDBKeyValueStore');
const CouchdbMock = require('mock-couch');

const chai = require('chai');
const should = chai.should();
const sinon = require('sinon');

describe('CouchDBKeyValueStore', () => {

	let couchDB;
	const listenPort = 5489;
	const badPort = 9999;
	const baseURL = 'http://localhost:';

	beforeEach(() => {
		couchDB = CouchdbMock.createServer();
		couchDB.listen(listenPort);
	});

	afterEach(() => {
		couchDB.close();
	});

	describe('#constructor', () => {

		it('should throw if instantiated without options', () => {
			(() => {
				new CouchDBKeyValueStore();
			}).should.throw(/Must provide the CouchDB database url to store membership data/);
		});

		it('should throw if instantiated with incorrect options', () => {
			(() => {
				new CouchDBKeyValueStore({droids: 'not the ones looked for'});
			}).should.throw(/Must provide the CouchDB database url to store membership data/);
		});

		it('should set a default member_db name if not passed', () => {
			const myStore = new CouchDBKeyValueStore({url: 'anything'});
			myStore._name.should.equal('member_db');
		});

		it('should set the member_db name if not passed', () => {
			const myStore = new CouchDBKeyValueStore({url: 'anything', name: 'pingu'});
			myStore._name.should.equal('pingu');
		});
	});

	describe('#init', () => {

		let revert;
		const errorStub = sinon.stub();
		const debugStub = sinon.stub();
		const fakeLogger = {
			debug: debugStub,
			error: errorStub
		};

		beforeEach(() => {
			errorStub.resetHistory();
			debugStub.resetHistory();

			revert = CouchDBKeyValueStoreRW.__set__('logger', fakeLogger);
		});

		afterEach(() => {
			revert();
		});

		it('should throw if unable to connect to URL', async () => {
			const store = new CouchDBKeyValueStoreRW({url: baseURL + badPort});
			await store.initialize().should.be.rejectedWith(/Error initializing database to store membership data: member_db Error: connect ECONNREFUSED 127.0.0.1:9999/);
		});

		it('should connect to and create a store if one does not exist', async () => {
			const store = new CouchDBKeyValueStoreRW({url: baseURL + listenPort});
			await store.initialize();

			sinon.assert.calledWith(debugStub, 'Created %s database', 'member_db');
		});

		it('should connect to a store if one does exist', async () => {
			const store = new CouchDBKeyValueStoreRW({url: baseURL + listenPort});
			await store.initialize();

			debugStub.resetHistory();

			await store.initialize();
			sinon.assert.calledWith(debugStub, '%s already exists', 'member_db');
		});

	});


	describe('#getValue', () => {

		const myFakeError = function(a, b) {
			throw new Error('Forced Test Error');
		};

		const myFakeReturn = function(a, b) {
			b(null, {member: 'Fake Test Value'});
		};

		it('should return an error', async() => {
			const store = new CouchDBKeyValueStore({url: baseURL + listenPort});
			await store.initialize();

			const fakeGet = {
				get: sinon.stub().callsFake(myFakeError)
			};
			store._database = fakeGet;

			await store.getValue('bert').should.be.rejectedWith(/Forced Test Error/);
		});

		it('should return null if item not found', async () => {
			const store = new CouchDBKeyValueStore({url: baseURL + listenPort});
			await store.initialize();
			const val = await store.getValue('bert');
			should.not.exist(val);
		});

		it('should return the item value if item found', async () => {
			const store = new CouchDBKeyValueStore({url: baseURL + listenPort});
			await store.initialize();

			const fakeGet = {
				get: sinon.stub().callsFake(myFakeReturn)
			};
			store._database = fakeGet;

			const value = await store.getValue('test');
			value.should.equal('Fake Test Value');
		});
	});

	describe('#setValue', () => {

		const myGetError = function(a, b) {
			const error = new Error('Forced Error');
			error.error = 'not_found';
			b(error, null);
		};
		const myGet = function(a, b) {
			b(null, {_rev: 101});
		};

		const myInsert = function(a, b) {
			b(null, 'Success');
		};

		it('should create a value if it does not exist already', async () => {
			const store = new CouchDBKeyValueStore({url: baseURL + listenPort});
			await store.initialize();

			const insertStub = sinon.stub().callsFake(myInsert);
			const fakeDB = {
				get: sinon.stub().callsFake(myGet),
				insert: insertStub
			};
			store._database = fakeDB;

			await store.setValue('myKey', 'myValue');

			// insert should have been called once with known value
			sinon.assert.calledOnce(insertStub);
			sinon.assert.calledWith(insertStub, {_id: 'myKey', _rev: 101, member: 'myValue'});

		});

		it('should update the revision number if it already exists', async () => {
			const store = new CouchDBKeyValueStore({url: baseURL + listenPort});
			await store.initialize();

			const insertStub = sinon.stub().callsFake(myInsert);
			const fakeDB = {
				get: sinon.stub().callsFake(myGetError),
				insert: insertStub
			};
			store._database = fakeDB;

			await store.setValue('myKey', 'myValue');

			// insert should ah e been called once with known value
			sinon.assert.calledOnce(insertStub);
			sinon.assert.calledWith(insertStub, {_id: 'myKey', member: 'myValue'});
		});
	});
});
