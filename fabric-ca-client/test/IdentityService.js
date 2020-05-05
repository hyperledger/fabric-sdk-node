/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const rewire = require('rewire');
const IdentityService = require('../lib/IdentityService');
const IdentityServiceRewire = rewire('../lib/IdentityService');

const FabricCAClient = require('../lib/FabricCAClient');
const {User} = require('fabric-common');

require('chai').should();
const sinon = require('sinon');

describe('IdentityService', () => {
	describe('#constructor', () => {

		it('should set the client as passed in the argument', () => {
			const client = {name: 'bob'};
			const service = new IdentityService(client);
			service.client.should.deep.equal(client);
		});
	});

	describe('#create', () => {

		let identity;
		let checkRegistrarStub;
		const success = {result: {secret: 'mySecret'}};

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityService(mockClient);

			checkRegistrarStub = sinon.stub();
			IdentityServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should throw if called with missing request', () => {
			(() => {
				identity.create();
			}).should.throw(/Missing required argument "req"/);
		});

		it('should throw if if missing req.enrollmentID within request argument', () => {
			(() => {
				identity.create({enrollmentID: 'dummy'});
			}).should.throw(/Missing required parameters. "req.enrollmentID", "req.affiliation" are all required/);
		});

		it('should throw if if missing req.affiliation within request argument', () => {
			(() => {
				identity.create({affiliation: 'dummy'});
			}).should.throw(/Missing required parameters. "req.enrollmentID", "req.affiliation" are all required/);
		});

		it('should throw if missing required argument "registrar"', () => {
			(() => {
				identity.create({enrollmentID: 'dummy', affiliation: 'dummy'});
			}).should.throw(/Missing required argument "registrar"/);
		});

		it('should throw if required argument "registrar" is an empty object', () => {
			(() => {
				identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, {});
			}).should.throw(/Argument "registrar" must be an instance of the class "User"/);
		});

		it('should throw if required argument "registrar" is null', () => {
			(() => {
				identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, null);
			}).should.throw(/Missing required argument "registrar"/);
		});

		it('should throw if required argument "registrar" is undefined', () => {
			(() => {
				identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, undefined);
			}).should.throw(/Missing required argument "registrar"/);
		});

		it('should throw if unable to get signingIdentity from registrar', () => {
			(() => {
				const registrar = new User('bob');
				identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, registrar);
			}).should.throw(/Can not get signingIdentity from registrar/);
		});

		it('should call `checkRegistrar` with the passed registrar', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			clientStub.post.resolves(success);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client POST method with the correct path and signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			clientStub.post.resolves(success);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, registrar);

			// should call post
			sinon.assert.calledOnce(clientStub.post);

			// should call with known
			const callArgs = clientStub.post.getCall(0).args;
			callArgs[0].should.equal('identities');
			callArgs[2].should.deep.equal('myID');
		});

		it('should set max enrollments to 1 by default', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			clientStub.post.resolves(success);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, registrar);

			// should call post
			sinon.assert.calledOnce(clientStub.post);

			// should call with known
			const callArgs = clientStub.post.getCall(0).args;
			callArgs[1].max_enrollments.should.equal(1);
		});

		it('should enable override of max enrollments', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			clientStub.post.resolves(success);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.create({enrollmentID: 'dummy', affiliation: 'dummy', maxEnrollments: 23}, registrar);

			// should call post
			sinon.assert.calledOnce(clientStub.post);

			// should call with known
			const callArgs = clientStub.post.getCall(0).args;
			callArgs[1].max_enrollments.should.equal(23);
		});

		it('should return a promise containing the response secret on success', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			clientStub.post.resolves(success);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			const result = await identity.create({enrollmentID: 'dummy', affiliation: 'dummy'}, registrar);
			result.should.equal('mySecret');
		});

		it('should reject a promise containing an error message on failure', async () => {

			const clientStub = sinon.createStubInstance(FabricCAClient);
			clientStub.post.rejects(new Error('forced error'));
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';
			await identity.create({
				enrollmentID: 'dummy',
				affiliation: 'dummy'
			}, registrar).should.be.rejectedWith('forced error');
		});
	});

	describe('#getOne', () => {

		let identity;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityService(mockClient);

			checkRegistrarStub = sinon.stub();
			IdentityServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should throw if missing required argument "enrollmentID"', () => {
			(() => {
				identity.getOne();
			}).should.throw(/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/);
		});

		it('should throw if required argument "enrollmentID" is not a valid string', () => {
			(() => {
				identity.getOne(1);
			}).should.throw(/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/);
		});

		it('should call `checkRegistrar` with the passed registrar', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.getOne('bob', registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client GET method with the extracted url and signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			clientStub._caName = 'passed_ca_name';
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.getOne('bob', registrar);

			// should call GET
			sinon.assert.calledOnce(clientStub.get);

			// should call with known
			const callArgs = clientStub.get.getCall(0).args;
			callArgs[0].should.equal('identities/bob?ca=passed_ca_name');
			callArgs[1].should.deep.equal('myID');
		});
	});

	describe('#getAll', () => {
		let identity;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityService(mockClient);

			checkRegistrarStub = sinon.stub();
			IdentityServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should call `checkRegistrar` with the passed registrar', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.getAll(registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client GET method with the extracted url and signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			clientStub._caName = 'passed_ca_name';
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.getAll(registrar);

			// should call GET
			sinon.assert.calledOnce(clientStub.get);

			// should call with known
			const callArgs = clientStub.get.getCall(0).args;
			callArgs[0].should.equal('identities?ca=passed_ca_name');
			callArgs[1].should.deep.equal('myID');
		});
	});

	describe('#delete', () => {

		let identity;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityService(mockClient);

			checkRegistrarStub = sinon.stub();
			IdentityServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should throw if missing required argument "enrollmentID"', () => {
			(() => {
				identity.delete();
			}).should.throw(/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/);
		});

		it('should throw if required argument "enrollmentID" is not a valid string', () => {
			(() => {
				identity.delete(1);
			}).should.throw(/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/);
		});

		it('should call `checkRegistrar` with the passed registrar', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.delete('bob', registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client DELETE method with an extracted "url" and the signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.delete('bob', registrar);

			// should call DELETE
			sinon.assert.calledOnce(clientStub.delete);

			// should call with known
			const callArgs = clientStub.delete.getCall(0).args;
			callArgs[0].should.equal('identities/bob');
			callArgs[1].should.deep.equal('myID');
		});

		it('should call the client DELETE method with a "force" option if specified', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await identity.delete('bob', registrar, true);

			// should call DELETE
			sinon.assert.calledOnce(clientStub.delete);

			// should call with known
			const callArgs = clientStub.delete.getCall(0).args;
			callArgs[0].should.equal('identities/bob?force=true');
			callArgs[1].should.deep.equal('myID');
		});
	});

	describe('#update', () => {

		let identity;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityService(mockClient);

			checkRegistrarStub = sinon.stub();
			IdentityServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should throw if missing required argument "enrollmentID"', () => {
			(() => {
				identity.update();
			}).should.throw(/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/);
		});

		it('should throw if required argument "enrollmentID" is not a valid string', () => {
			(() => {
				identity.update(1);
			}).should.throw(/Missing required argument "enrollmentID", or argument "enrollmentID" is not a valid string/);
		});

		it('should call `checkRegistrar` with the passed registrar', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			const req = {};

			await identity.update('bob', req, registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client PUT method with an extracted "url", request, and the signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			const req = {};

			await identity.update('bob', req, registrar);

			// should call PUT
			sinon.assert.calledOnce(clientStub.put);

			// should call with known
			const callArgs = clientStub.put.getCall(0).args;
			callArgs[0].should.equal('identities/bob');
			callArgs[1].should.deep.equal({});
			callArgs[2].should.deep.equal('myID');
		});

		it('should call the client PUT method with with extracted request options', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			identity = new IdentityServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			const req = {
				type: 'testType',
				affiliation: 'testAffiliation',
				maxEnrollments: 42,
				attrs: 'testAtts',
				enrollmentSecret: 'shhh!',
				caname: 'caName'
			};

			await identity.update('bob', req, registrar);

			// should call PUT
			sinon.assert.calledOnce(clientStub.put);

			// should call with known
			const callArgs = clientStub.put.getCall(0).args;
			callArgs[1].should.deep.equal({
				type: 'testType',
				affiliation: 'testAffiliation',
				max_enrollments: 42,
				attrs: 'testAtts',
				secret: 'shhh!',
				caname: 'caName'
			});
		});
	});
});
