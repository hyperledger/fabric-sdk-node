/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const rewire = require('rewire');
const AffiliationService = require('../lib/AffiliationService');
const AffiliationServiceRewire = rewire('../lib/AffiliationService');
const FabricCAClient = require('../lib/FabricCAClient');
const {User} = require('fabric-common');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const sinon = require('sinon');

describe('AffiliationService', () => {

	describe('#constructor', () => {

		it('should set the client as passed in the argument', () => {
			const client = {name: 'bob'};
			const service = new AffiliationService(client);
			service.client.should.deep.equal(client);
		});
	});

	describe('#create', () => {
		let affiliation;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationService(mockClient);

			checkRegistrarStub = sinon.stub();
			AffiliationServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should throw if called with a null argument "req"', () => {
			(() => {
				affiliation.create(null, {});
			}).should.throw(/Missing required argument "req"/);
		});

		it('should throw if called with an undefined argument "req"', () => {
			(() => {
				affiliation.create(undefined, {});
			}).should.throw(/Missing required argument "req"/);
		});

		it('should throw if called without the parameter "req.name"', () => {
			(() => {
				affiliation.create({dummy: 'object'}, {});
			}).should.throw(/Missing required parameters. "req.name" is required./);
		});

		it('should throw if registrar is null', () => {
			(() => {
				affiliation.create({name: 'example'});
			}).should.throw(/Missing required argument "registrar"/);
		});

		it('should throw if registrar is undefined', () => {
			(() => {
				affiliation.create({name: 'example'}, undefined);
			}).should.throw(/Missing required argument "registrar"/);
		});

		it('should call "checkRegistrar"', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.create({name: 'example'}, registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client POST method with the extracted url, request and signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.create({name: 'example'}, registrar);

			// should call post
			sinon.assert.calledOnce(clientStub.post);

			// should call with known
			const callArgs = clientStub.post.getCall(0).args;
			callArgs[0].should.equal('affiliations');
			callArgs[1].should.deep.equal({name: 'example', caname: undefined});
			callArgs[2].should.equal('myID');
		});

		it('should call the client POST method with a "force" option if specified', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.create({name: 'example', force: true}, registrar);

			// should call post
			sinon.assert.calledOnce(clientStub.post);

			// should call with known
			const callArgs = clientStub.post.getCall(0).args;
			callArgs[0].should.equal('affiliations?force=true');
			callArgs[1].should.deep.equal({name: 'example', caname: undefined});
			callArgs[2].should.equal('myID');
		});
	});

	describe('#getOne', () => {

		let affiliation;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationService(mockClient);

			checkRegistrarStub = sinon.stub();
			AffiliationServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should throw if missing required argument "affiliation"', () => {
			(() => {
				affiliation.getOne();
			}).should.throw(/Missing required argument "affiliation", or argument "affiliation" is not a valid string/);
		});

		it('should throw if argument "affiliation" is not a valid string', () => {
			(() => {
				affiliation.getOne(12);
			}).should.throw(/Missing required argument "affiliation", or argument "affiliation" is not a valid string/);
		});

		it('should call "checkRegistrar"', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.getOne('theAffiliation', registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client get method with the extracted url and signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.getOne('theAffiliation', registrar);

			// should call GET
			sinon.assert.calledOnce(clientStub.get);

			// should call with known
			const callArgs = clientStub.get.getCall(0).args;
			callArgs[0].should.equal('affiliations/theAffiliation');
			callArgs[1].should.deep.equal('myID');
		});
	});

	describe('#getAll', () => {

		let affiliation;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationService(mockClient);

			checkRegistrarStub = sinon.stub();
			AffiliationServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should call "checkRegistrar"', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.getAll(registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client get method with "affiliations" and the signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.getAll(registrar);

			// should call GET
			sinon.assert.calledOnce(clientStub.get);

			// should call with known
			const callArgs = clientStub.get.getCall(0).args;
			callArgs[0].should.equal('affiliations');
			callArgs[1].should.deep.equal('myID');
		});
	});

	describe('#delete', () => {

		let affiliation;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationService(mockClient);

			checkRegistrarStub = sinon.stub();
			AffiliationServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should throw if missing required argument "req"', () => {
			(() => {
				affiliation.delete();
			}).should.throw(/Missing required argument "req"/);
		});

		it('should throw if called without the parameter "req.name"', () => {
			(() => {
				affiliation.delete({invalid: 'fields'});
			}).should.throw(/Missing required argument "req.name", or argument "req.name" is not a valid string/);
		});

		it('should throw if parameter "req.name" is not a valid string', () => {
			(() => {
				affiliation.delete({name: true});
			}).should.throw(/Missing required argument "req.name", or argument "req.name" is not a valid string/);
		});

		it('should throw if missing required argument "registrar"', () => {
			(() => {
				affiliation.delete({name: 'bob'});
			}).should.throw(/Missing required argument "registrar"/);
		});

		it('should call "checkRegistrar"', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.delete({name: 'bob'}, registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client DELETE method with an extracted "url" and the signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.delete({name: 'bob'}, registrar);

			// should call delete
			sinon.assert.calledOnce(clientStub.delete);

			// should call with known
			const callArgs = clientStub.delete.getCall(0).args;
			callArgs[0].should.equal('affiliations/bob');
			callArgs[1].should.deep.equal('myID');
		});

		it('should call the client DELETE method with a "force" option if specified', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.delete({name: 'bob', force: true}, registrar);

			// should call DELETE
			sinon.assert.calledOnce(clientStub.delete);

			// should call with known
			const callArgs = clientStub.delete.getCall(0).args;
			callArgs[0].should.equal('affiliations/bob?force=true');
			callArgs[1].should.equal('myID');
		});

	});

	describe('#update', () => {

		let affiliation;
		let checkRegistrarStub;

		beforeEach(() => {
			const mockClient = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationService(mockClient);

			checkRegistrarStub = sinon.stub();
			AffiliationServiceRewire.__set__('checkRegistrar', checkRegistrarStub);
		});

		it('should throw if missing required argument "affiliation"', () => {
			(() => {
				affiliation.update();
			}).should.throw(/Missing required argument "affiliation", or argument "affiliation" is not a valid string/);
		});

		it('should throw if required argument "affiliation" is not a valid string', () => {
			(() => {
				affiliation.update(2);
			}).should.throw(/Missing required argument "affiliation", or argument "affiliation" is not a valid string/);
		});

		it('should throw if missing required argument "req"', () => {
			(() => {
				affiliation.update('affiliate');
			}).should.throw(/Missing required argument "req"/);
		});

		it('should throw if missing required parameter "req.name"', () => {
			(() => {
				affiliation.update('affiliate', {invalid: true});
			}).should.throw(/Missing required argument "req.name", or argument "req.name" is not a valid string/);
		});

		it('should throw if required parameter "req.name" is not a valid string', () => {
			(() => {
				affiliation.update('affiliate', 3);
			}).should.throw(/Missing required argument "req.name", or argument "req.name" is not a valid string/);
		});

		it('should call "checkRegistrar"', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.update('affiliate', {name: 'bob'}, registrar);
			sinon.assert.calledOnce(checkRegistrarStub);
		});

		it('should call the client PUT method with an extracted "url", request and the signing identity', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.update('affiliation', {name: 'bob'}, registrar);

			// should call PUT
			sinon.assert.calledOnce(clientStub.put);

			// should call with known
			const callArgs = clientStub.put.getCall(0).args;
			callArgs[0].should.equal('affiliations/affiliation');
			callArgs[1].should.deep.equal({name: 'bob'});
			callArgs[2].should.equal('myID');

		});

		it('should call the client PUT method with a "force" option if specified', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.update('affiliation', {name: 'bob', force: true}, registrar);

			// should call PUT
			sinon.assert.calledOnce(clientStub.put);

			// should call with known
			const callArgs = clientStub.put.getCall(0).args;
			callArgs[0].should.equal('affiliations/affiliation?force=true');
			callArgs[1].should.deep.equal({name: 'bob'});
			callArgs[2].should.equal('myID');
		});

		it('should pass the caname to the request if supplied', async () => {
			const clientStub = sinon.createStubInstance(FabricCAClient);
			affiliation = new AffiliationServiceRewire(clientStub);

			const registrar = new User('bob');
			registrar._signingIdentity = 'myID';

			await affiliation.update('affiliation', {name: 'bob', caname: 'my-ca'}, registrar);

			// should call PUT
			sinon.assert.calledOnce(clientStub.put);

			// should call with known
			const callArgs = clientStub.put.getCall(0).args;
			callArgs[0].should.equal('affiliations/affiliation');
			callArgs[1].should.deep.equal({name: 'bob', caname: 'my-ca'});
			callArgs[2].should.equal('myID');
		});
	});
});
