/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {AsyncNotifier} from '../../../src/impl/event/asyncnotifier';

import * as testUtils from '../../testutils';

import sinon = require('sinon');
import chai = require('chai');
const expect = chai.expect;

describe('AsyncNotifier', () => {
	function newSupplier(events: number[]) {
		let callCount = 0;
		return () => {
			const event = events[callCount];
			if (event) {
				callCount++;
				return event;
			} else {
				return undefined;
			}
		};
	}

	afterEach(() => {
		sinon.restore();
	});

	it('does not call listener if no events', () => {
		const supplier = newSupplier([]);
		const listener = sinon.fake();
		const notifier = new AsyncNotifier(supplier, listener);

		notifier.notify();

		sinon.assert.notCalled(listener);
	});

	it('passes event to listener', async () => {
		const expected = [1];
		const supplier = newSupplier(expected);
		const listener = testUtils.newAsyncListener<number>();
		const notifier = new AsyncNotifier<number>(supplier, listener);

		notifier.notify();
		const actual = await listener.completePromise;

		expect(actual).to.deep.equal(expected);
	});

	it('passes events to listener in order', async () => {
		const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const supplier = newSupplier(expected);
		const listener = testUtils.newAsyncListener<number>(expected.length, 10);
		const notifier = new AsyncNotifier<number>(supplier, listener);

		notifier.notify();
		const actual = await listener.completePromise;

		expect(actual).to.deep.equal(expected);
	});

	it('unnecessary notifies have no effect', async () => {
		const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const supplier = newSupplier(expected);
		const listener = testUtils.newAsyncListener<number>(expected.length);
		const notifier = new AsyncNotifier<number>(supplier, listener);

		notifier.notify();
		notifier.notify();
		const actual = await listener.completePromise;

		expect(actual).to.deep.equal(expected);

	});

	it('interleaved send and receive delivers all events in order', async () => {
		const numEvents = 10;
		const maxSleep = 10;
		const events: number[] = [];
		const supplier = newSupplier(events);
		const listener = testUtils.newAsyncListener<number>(numEvents, maxSleep);
		const notifier = new AsyncNotifier<number>(supplier, listener);

		async function run() {
			for (let i = 0; i < numEvents;) {
				events.push(++i);
				notifier.notify();
				const random = testUtils.getRandomInt(maxSleep);
				await testUtils.sleep(random);
			}
		}
		await run();
		const actual = await listener.completePromise;

		expect(actual).to.deep.equal(events);
	});
});
