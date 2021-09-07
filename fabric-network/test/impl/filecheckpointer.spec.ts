/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Checkpointer} from '../../src/checkpointer';
import {DefaultCheckpointers} from '../../src/defaultcheckpointers';
import * as testUtils from '../testutils';
import * as Long from 'long';
import * as path  from 'path';
import * as fs from 'fs';
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;



describe('FileCheckpointer', () => {
	let dir: string;
	let file: string;
	let checkpointer: Checkpointer;

	beforeEach(async () => {
		dir = await testUtils.createTempDir();
		file = path.join(dir, 'checkpoint.json');
		checkpointer = await DefaultCheckpointers.file(file);
	});

	afterEach(async () => {
		await testUtils.rmdir(dir);
	});

	it('new checkpointer has undefined block number', async () => {
		const actual = await checkpointer.getBlockNumber();

		expect(actual).to.be.undefined;
	});

	it('new checkpointer has empty transaction IDs', async () => {
		const actual = await checkpointer.getTransactionIds();

		expect(actual).to.be.empty;
	});

	it('can get added transaction IDs', async () => {
		await checkpointer.addTransactionId('txId');
		const actual = await checkpointer.getTransactionIds();

		expect(actual).to.have.lengthOf(1).and.include('txId');
	});

	it('duplicate transaction IDs are ignored', async () => {
		await checkpointer.addTransactionId('txId');
		await checkpointer.addTransactionId('txId');
		const actual = await checkpointer.getTransactionIds();

		expect(actual).to.have.lengthOf(1).and.include('txId');
	});

	it('can get updated block number', async () => {
		await checkpointer.setBlockNumber(Long.ONE);
		const actual = await checkpointer.getBlockNumber();

		expect(actual?.toNumber()).to.equal(1);
	});

	it('setting block number clears transaction IDs', async () => {
		await checkpointer.addTransactionId('txId');

		await checkpointer.setBlockNumber(Long.ONE);
		const actual = await checkpointer.getTransactionIds();

		expect(actual).to.be.empty;
	});

	it('initial state retained on reopen of checkpointer', async () => {
		checkpointer = await DefaultCheckpointers.file(file);
		const blockNumber = await checkpointer.getBlockNumber();
		const transactionIds = await checkpointer.getTransactionIds();

		expect(blockNumber).to.be.undefined;
		expect(transactionIds).to.be.empty;
	});

	it('state is persisted when block number updated', async () => {
		await checkpointer.setBlockNumber(Long.ONE);

		checkpointer = await DefaultCheckpointers.file(file);
		const blockNumber = await checkpointer.getBlockNumber();
		const transactionIds = await checkpointer.getTransactionIds();

		expect(blockNumber?.toNumber()).to.equal(1);
		expect(transactionIds).to.be.empty;
	});

	it('state is persisted when transaction IDs added', async () => {
		await checkpointer.addTransactionId('txId');

		checkpointer = await DefaultCheckpointers.file(file);
		const blockNumber = await checkpointer.getBlockNumber();
		const transactionIds = await checkpointer.getTransactionIds();

		expect(blockNumber).to.be.undefined;
		expect(transactionIds).to.have.lengthOf(1).and.include('txId');
	});

	it('persistent state is consistent on multiple updates', async () => {
		await checkpointer.setBlockNumber(Long.ZERO);
		await checkpointer.addTransactionId('tx0');
		await checkpointer.setBlockNumber(Long.ONE);
		await checkpointer.addTransactionId('tx1');

		checkpointer = await DefaultCheckpointers.file(file);
		const blockNumber = await checkpointer.getBlockNumber();
		const transactionIds = await checkpointer.getTransactionIds();

		expect(blockNumber?.toNumber()).to.equal(1);
		expect(transactionIds).to.have.lengthOf(1).and.include('tx1');
	});

	it('create fails for bad persistent data', async () => {
		await fs.promises.writeFile(file, Buffer.from('bad to the bone'));

		const promise = DefaultCheckpointers.file(file);

		await expect(promise).to.be.rejected;
	});

	it('create fails for non-writable path', async () => {
		const promise = DefaultCheckpointers.file(path.join(dir, 'MISSING_DIR', 'MISSING_FILE'));

		await expect(promise).to.be.rejected;
	});
});
