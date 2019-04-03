/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');

const rewire = require('rewire');
const FileSystemCheckpointer = rewire('fabric-network/lib/impl/event/filesystemcheckpointer');


describe('FileSystemCheckpointer', () => {
	const revert = [];
	let sandbox;
	let checkpointer;
	let channelName;
	let listenerName;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		sandbox.stub(os, 'homedir').returns('home');
		sandbox.spy(path, 'join');
		sandbox.stub(fs, 'ensureDir');
		sandbox.stub(fs, 'createFile');
		sandbox.stub(fs, 'exists');
		sandbox.stub(fs, 'writeFile');
		sandbox.stub(fs, 'readFile');
		sandbox.stub(path, 'resolve').callsFake(a => a);
		revert.push(FileSystemCheckpointer.__set__('path', path));
		revert.push(FileSystemCheckpointer.__set__('os', os));
		revert.push(FileSystemCheckpointer.__set__('fs', fs));

		channelName = 'mychannel';
		listenerName = 'mylistener';
		checkpointer = new FileSystemCheckpointer(channelName, listenerName);
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should set basePath without options', () => {
			const check = new FileSystemCheckpointer(channelName, listenerName);
			sinon.assert.called(os.homedir);
			expect(check._basePath).to.equal('home/.hlf-checkpoint');
			expect(check._channelName).to.equal(channelName);
			expect(check._listenerName).to.equal(listenerName);
		});

		it('should set basePath with options', () => {
			const check = new FileSystemCheckpointer(channelName, listenerName, {basePath: 'base-path'});
			sinon.assert.called(os.homedir);
			expect(check._basePath).to.equal('base-path');
		});
	});

	describe('#_initialize', () => {
		it('should initialize the checkpoint file', async () => {
			await checkpointer._initialize();
			sinon.assert.calledWith(fs.ensureDir, `home/.hlf-checkpoint/${channelName}`);
			sinon.assert.calledWith(fs.createFile, checkpointer._getCheckpointFileName());
		});
	});

	describe('#save', () => {

		it('should initialize the checkpointer file doesnt exist', async () => {
			fs.readFile.resolves(new Buffer(''));
			fs.exists.resolves(false);
			sinon.spy(checkpointer, '_initialize');
			sinon.spy(checkpointer, 'load');
			await checkpointer.save('transaction1', 0);
			sinon.assert.calledWith(fs.exists, checkpointer._getCheckpointFileName());
			sinon.assert.called(checkpointer._initialize);
		});

		it('should update an existing checkpoint', async () => {
			fs.exists.resolves(true);
			fs.readFile.resolves(JSON.stringify({blockNumber: 0, transactionIds: ['transactionId']}));
			await checkpointer.save('transactionId1', 0);
			sinon.assert.calledWith(fs.writeFile, checkpointer._getCheckpointFileName(), JSON.stringify({'blockNumber':0, 'transactionIds':['transactionId', 'transactionId1']}));
		});

		it('should not update an existing checkpoint', async () => {
			fs.exists.resolves(true);
			fs.readFile.resolves(JSON.stringify({blockNumber: 0, transactionIds: ['transactionId']}));
			await checkpointer.save(null, 0);
			sinon.assert.calledWith(fs.writeFile, checkpointer._getCheckpointFileName(), JSON.stringify({'blockNumber':0, 'transactionIds':['transactionId']}));
		});

		it('should update an existing checkpoint when blockNumber changes', async () => {
			fs.exists.resolves(true);
			fs.readFile.resolves(JSON.stringify({blockNumber: 0, transactionIds: ['transactionId']}));
			await checkpointer.save('transactionId', 1);
			sinon.assert.calledWith(fs.writeFile, checkpointer._getCheckpointFileName(), JSON.stringify({'blockNumber':1, 'transactionIds':['transactionId']}));
		});

		it('should not add a list of transactions to a checkpoint', async () => {
			fs.exists.resolves(true);
			fs.readFile.resolves(JSON.stringify({blockNumber: 0, transactionIds: ['transactionId']}));
			await checkpointer.save(null, 1);
			sinon.assert.calledWith(fs.writeFile, checkpointer._getCheckpointFileName(), JSON.stringify({'blockNumber':1, 'transactionIds':[]}));
		});
	});

	describe('#load', () => {
		it('should initialize the checkpointer if memory map doesnt exist', async () => {
			fs.exists.resolves(false);
			fs.readFile.resolves('{}');
			const checkpoint = await checkpointer.load();
			expect(checkpoint).to.deep.equal({});
		});

		it('should return the checkpoint', async () => {
			fs.exists.resolves(true);
			const checkpoint = {blockNumber: 0, transactionIds: []};
			fs.readFile.resolves(JSON.stringify(checkpoint));
			const loadedCheckpoint = await checkpointer.load();
			expect(loadedCheckpoint).to.deep.equal(checkpoint);
		});

		it('should return an empty object if the checkpoint is empty', async () => {
			fs.exists.resolves(false);
			const checkpoint = '';
			fs.readFile.resolves(checkpoint);
			const loadedCheckpoint = await checkpointer.load();
			expect(loadedCheckpoint).to.deep.equal({});
		});
	});

	describe('#_getCheckpointFileName', () => {
		it('should return a file path including the chaincode ID', () => {
			const chaincodeId = 'CHAINCODE_ID';
			checkpointer.setChaincodeId(chaincodeId);
			expect(checkpointer._getCheckpointFileName()).to.equal(`home/.hlf-checkpoint/${channelName}/${chaincodeId}/${listenerName}`);
		});
	});
});
