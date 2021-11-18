/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {EndorsementResponse} from 'fabric-common';
import {protos} from 'fabric-protos';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';

import _rimraf = require('rimraf');
const rimraf = util.promisify(_rimraf);

/**
 * Returns a new async function that taken one argument of the generic type. The returned function also has a
 * 'completePromise' property of type Promise<T[]>, which resolves when the expected number of calls have been made
 * to the listener function, and returns an array of the arguments passed to the listener function.
 * @param expectedCallCount Number of calls after which to resolve the completePromise.
 * @param maxSleep Maximum number of milliseconds to randomly sleep when invoked.
 */
export function newAsyncListener<T>(expectedCallCount = 1, maxSleep = 0):  {
	(event: T): Promise<void>;
	completePromise: Promise<T[]>;} {
	let resolve: (value: T[] | PromiseLike<T[]>) => void;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const completePromise = new Promise<T[]>((_resolve, _) => resolve = _resolve);

	const events: T[] = [];
	const listener = async (event: T) => {
		if (maxSleep > 0) {
			// Some random delay to simulate async work in the listener and catch timing bugs
			await sleep(getRandomInt(maxSleep));
		}
		events.push(event);
		expectedCallCount--;
		if (expectedCallCount === 0) {
			resolve(events);
		}
	};
	listener.completePromise = completePromise;

	return listener;
}

export function sleep(ms: number):Promise<unknown> {
	if (ms > 0) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		return new Promise((resolve, _) => setTimeout(resolve, ms));
	} else {
		return Promise.resolve();
	}
}

export function getRandomInt(max: number) :number {
	return Math.floor(Math.random() * Math.floor(max));
}

export async function createTempDir(): Promise<string> {
	const prefix = `${os.tmpdir()}${path.sep}`;
	return await fs.promises.mkdtemp(prefix);
}

export async function rmdir(directory: string): Promise<void> {
	await rimraf(directory);
}

export type Mutable<T> = { -readonly [P in keyof T]: T[P]; }

export function newEndorsementResponse(response: protos.IResponse, properties: Partial<EndorsementResponse> = {}): EndorsementResponse {
	const payload = protos.ProposalResponsePayload.encode({
		extension: protos.ChaincodeAction.encode({
			response,
		}).finish(),
	}).finish();

	const template: EndorsementResponse = {
		connection: {
			name: 'name',
			options: {},
			type: 'peer',
			url: 'grpc://example.org:1337',
		},
		endorsement: {
			endorser: Buffer.alloc(0),
			signature: Buffer.alloc(0),
		},
		payload: Buffer.from(payload),
		response: {
			message: response.message,
			payload: Buffer.alloc(0),
			status: response.status ?? 200,
		},
	};

	return Object.assign(template, properties);
}
