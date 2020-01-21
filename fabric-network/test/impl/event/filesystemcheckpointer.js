/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint require-atomic-updates: off */

'use strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const FileSystemCheckpointer = require('fabric-network/lib/impl/event/filesystemcheckpointer');


const rewire = require('rewire');
const FileSystemCheckpointerRewire = rewire('fabric-network/lib/impl/event/filesystemcheckpointer');


describe('FileSystemCheckpointerRewire', () => {
	const revert = [];
	let sandbox;
	let checkpointer;
	let writeStream;
	let checkpointPath;

	const filecontents = '0, 1000\n1, 1001\n2, 1002';

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		sandbox.stub(os, 'homedir').returns('home');
		sandbox.spy(path, 'join');
		sandbox.stub(fs, 'writeFileSync');
		sandbox.stub(fs, 'appendFileSync');
		writeStream = sinon.stub();
		writeStream.write = sinon.stub();
		writeStream.on = sinon.stub();
		writeStream.end = sinon.stub();
		writeStream.destroy = sinon.stub();
		sandbox.stub(fs, 'createWriteStream').returns(writeStream);
		revert.push(FileSystemCheckpointerRewire.__set__('fs', fs));
		checkpointPath = path.join(os.homedir(), '/checkpoint.txt');

		checkpointer = new FileSystemCheckpointerRewire({checkpointPath});
		checkpointer._writeFile = sinon.stub().resolves(true);
	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
	});

	describe('#constructor', () => {
		it('should use provided path', () => {
			sandbox.stub(fs, 'readFileSync').returns(filecontents);
			const check = new FileSystemCheckpointerRewire({checkpointPath: 'somepath'});
			expect(check.checkpointPath).to.equal('somepath');
		});
		it('should use provided path with empty', () => {
			const check = new FileSystemCheckpointerRewire({checkpointPath: 'somepath'});
			expect(check.checkpointPath).to.equal('somepath');
		});
		it('should use provided maxLength', () => {
			const check = new FileSystemCheckpointerRewire({checkpointPath: 'somepath', maxLength: 10});
			expect(check.checkpointPath).to.equal('somepath');
			expect(check.maxLength).to.equal(10);
		});
		it('should throw if missing checkpointPath', () => {
			try {
				new FileSystemCheckpointer();
				expect(1, 'should have thrown an error').to.not.be.ok;
			} catch (error) {
				expect(error.message).to.contain('Missing checkpointPath parameter');
			}
		});
	});

	describe('#initialize', () => {
		it('should initialize the checkpoint with no file', async () => {
			sandbox.stub(fs, 'existsSync').returns(false);
			sandbox.stub(fs, 'readFileSync');

			const check = new FileSystemCheckpointerRewire({checkpointPath: 'somepath'});
			await check.initialize();
			sinon.assert.notCalled(fs.readFileSync);
		});
		it('should initialize the checkpoint with file contents', async () => {
			sandbox.stub(fs, 'readFileSync').returns(filecontents);
			sandbox.stub(fs, 'existsSync').returns(true);

			const check = new FileSystemCheckpointerRewire({checkpointPath: 'somepath'});
			await check.initialize();
			sinon.assert.calledWith(fs.readFileSync, 'somepath');
		});
		it('should initialize the checkpoint with empty file', async () => {
			sandbox.stub(fs, 'readFileSync').returns(null);
			sandbox.stub(fs, 'existsSync').returns(true);

			const check = new FileSystemCheckpointerRewire({checkpointPath: 'somepath'});
			await check.initialize();
			sinon.assert.calledWith(fs.readFileSync, 'somepath');
		});
	});

	describe('#save', () => {
		it('should add a blockNumber and transactionId', async () => {
			await checkpointer.initialize();
			await checkpointer.save('1', '1001');
			expect(checkpointer.checkpoints.get('1').transactionIds[0]).to.equal('1001');
		});
		it('should add same blockNumber and transactionId', async () => {
			await checkpointer.initialize();
			await checkpointer.save('1', '1001');
			await checkpointer.save('1', '1002');
			const checkpoint = checkpointer.checkpoints.get('1');
			expect(checkpoint.transactionIds[0]).to.equal('1001');
			expect(checkpoint.transactionIds[1]).to.equal('1002');
		});
		it('should add a blockNumber', async () => {
			await checkpointer.initialize();
			await checkpointer.save('2');
			expect(checkpointer.checkpoints.get('2').blockNumber).to.equal('2');
		});
		it('should add again blockNumber and transactionId', async () => {
			await checkpointer.initialize();
			await checkpointer.save('1', '1001');
			await checkpointer.save('1', '1001');
			expect(checkpointer.checkpoints.get('1').transactionIds[0]).to.equal('1001');
		});
		it('should add a blockNumber', async () => {
			await checkpointer.initialize();
			await checkpointer.save('2');
			await checkpointer.save('2');
			expect(checkpointer.checkpoints.get('2').blockNumber).to.equal('2');
		});
	});

	describe('#check', () => {
		it('should return false', async () => {
			await checkpointer.initialize();
			expect(await checkpointer.check('1')).to.be.false;
		});
		it('should check same blockNumber and transactionId', async () => {
			await checkpointer.initialize();
			await checkpointer.save('1', '1001');
			await checkpointer.save('1', '1002');
			expect(await checkpointer.check('1', '1001')).to.be.true;
			expect(await checkpointer.check('1', '1002')).to.be.true;
			expect(await checkpointer.check('1', '1003')).to.be.false;

		});
		it('should check a blockNumber', async () => {
			await checkpointer.initialize();
			await checkpointer.save('2');
			expect(await checkpointer.check('1')).to.be.false;
			expect(await checkpointer.check('2')).to.be.true;
		});
	});

	describe('#getStartBlock', () => {
		it('should return the blockNumber 2', async () => {
			checkpointer.checkpoints.set('1', {blockNumber: '1', transactionIds: []});
			checkpointer.checkpoints.set('2', {blockNumber: '2', transactionIds: []});
			checkpointer.checkpoints.set('4', {blockNumber: '3', transactionIds: []});
			checkpointer.checkpoints.set('5', {blockNumber: '5', transactionIds: []});
			const startBlock = await checkpointer.getStartBlock();
			expect(startBlock).to.equal('2');
		});
		it('should return the blockNumber 5', async () => {
			checkpointer.checkpoints.set('1', {blockNumber: '1', transactionIds: []});
			checkpointer.checkpoints.set('2', {blockNumber: '2', transactionIds: []});
			checkpointer.checkpoints.set('3', {blockNumber: '3', transactionIds: []});
			checkpointer.checkpoints.set('4', {blockNumber: '4', transactionIds: []});
			checkpointer.checkpoints.set('5', {blockNumber: '4', transactionIds: []});
			const startBlock = await checkpointer.getStartBlock();
			expect(startBlock).to.equal('5');
		});
		it('should return the blockNumber 0', async () => {
			const startBlock = await checkpointer.getStartBlock();
			expect(startBlock).to.equal('0');
		});
	});
});

describe('FileSystemCheckpointer', () => {
	let checkpointer;
	let checkpointPath;

	beforeEach(() => {
		checkpointPath = path.join(os.homedir(), '/checkpoint.txt');
		checkpointer = new FileSystemCheckpointer({checkpointPath});
	});

	describe('#initialize/save', () => {
		it('should initialize the checkpoint file and save to it', async () => {
			await checkpointer.initialize();
			await checkpointer.save('1');
			await checkpointer.initialize();
			await checkpointer.save('2');
			await checkpointer.save('3');
			expect(checkpointer.checkpoints.get('1').blockNumber).to.equal('1');
			expect(checkpointer.checkpoints.get('2').blockNumber).to.equal('2');
			expect(checkpointer.checkpoints.get('3').blockNumber).to.equal('3');
		});
		it('should initialize with existing', async () => {
			await checkpointer.initialize();
			expect(checkpointer.checkpoints.get('1').blockNumber).to.equal('1');
			expect(checkpointer.checkpoints.get('2').blockNumber).to.equal('2');
			expect(checkpointer.checkpoints.get('3').blockNumber).to.equal('3');
			await checkpointer.save('4', '1000');
			await checkpointer.save('4', '1001');
			await checkpointer.save('4', '1001');
			await checkpointer.initialize();
			const test = checkpointer.checkpoints.get('4');
			expect(test.transactionIds[0]).to.equal('1000');
			expect(test.transactionIds[1]).to.equal('1001');
		});
	});
	describe('#prune', () => {
		it('should prune a checkpoint to 3 blocks', async () => {
			await checkpointer.initialize();
			expect(checkpointer.checkpoints.size).to.greaterThan(3);
			checkpointer.maxLength = 3;
			await checkpointer.save('9');
			await checkpointer.save('10');
			await checkpointer.save('11', '1000');
			await checkpointer.save('11', '1001');
			await checkpointer.save('11', '1002');
			expect(checkpointer.checkpoints.size).to.equal(3);
			await checkpointer.prune();
			await checkpointer.initialize();
			expect(checkpointer.checkpoints.size).to.equal(3);
		});
	});
});
