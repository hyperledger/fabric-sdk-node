/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	CommitEvent,
	CommitError,
	CommitListener,
	Network,
	TxEventHandler,
	TxEventHandlerFactory
} from 'fabric-network';
import {Endorser} from 'fabric-common';
import {EventEmitter} from 'events';

const eventName = 'event';

// --- Plug-in event handler sample where the user takes full responsibility for event handling

/**
 * Handler that listens for commit events for a specific transaction from a set of peers. A new instance of this class
 * is created to handle each transaction as it maintains state related to events for a given transaction.
 *
 * This implementation will unblock once all the peers have either supplied a vaid transaction commit event or
 * disconnected. It will report an error if any of the peers supply an invalid commit event.
 */
class SampleTransactionEventHandler implements TxEventHandler {
	private readonly network: Network;
	private readonly transactionId: string;
	private readonly asyncBarrier: AsyncBarrier;
	private timeoutHandler?: NodeJS.Timeout;
	private readonly listener: CommitListener = this.eventCallback.bind(this);
	private readonly peers: Endorser[];
	private readonly unrespondedPeers: Set<Endorser>;

	/**
	 * Constructor.
	 * @param {string} transactionId The ID of the transactions being submitted
	 * @param {Network} network The network where the transaction is being submitted.
	 */
	constructor(transactionId: string, network: Network, peers: Endorser[]) {
		if (peers.length === 0) {
			throw new Error(`No peers supplied to handle events for transaction ID ${transactionId}`);
		}
		this.network = network;
		this.transactionId = transactionId;
		this.peers = peers;
		this.unrespondedPeers = new Set(peers);

		this.asyncBarrier = new AsyncBarrier();
	}

	/**
	 * Called to initiate listening for transaction events.
	 */
	async startListening() {
		this.setListenTimeout();
		await this.network.addCommitListener(this.listener, this.peers, this.transactionId);
	}

	/**
	 * Wait until enough events have been received from peers to satisfy the event handling strategy.
	 * @throws {Error} if the transaction commit fails or is not successful within the timeout period.
	 */
	async waitForEvents() {
		await this.asyncBarrier.wait();
	}

	/**
	 * Cancel listening for events.
	 */
	cancelListening() {
		if (this.timeoutHandler) {
			clearTimeout(this.timeoutHandler);
		}
		this.network.removeCommitListener(this.listener);
	}

	private eventCallback(error?: CommitError, event?: CommitEvent) {
		if (event && !event.isValid) {
			return this.fail(new Error(event.status));
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const peer = error?.peer || event!.peer;
		this.unrespondedPeers.delete(peer);

		if (this.unrespondedPeers.size === 0) {
			return this.success();
		}
	}

	private setListenTimeout() {
		this.timeoutHandler = setTimeout(
			() => this.fail(new Error(`Timeout waiting for commit events for transaction ID ${this.transactionId}`)),
			30 * 1000
		);
	}

	private fail(error: Error) {
		this.cancelListening();
		this.asyncBarrier.error(error);
	}

	private success() {
		this.cancelListening();
		this.asyncBarrier.signal();
	}
}

/**
 * Factory function called for each submitted transaction, which supplies a commit handler instance for that
 * transaction. This implementation returns a commit handler that listens to all peers in the user's organization.
 * @param {string} transactionId The ID of the transactions being submitted
 * @param {Network} network The network where the transaction is being submitted.
 */
export const createTransactionEventHandler: TxEventHandlerFactory = (transactionId, network) => {
	const mspId = network.getGateway().getIdentity().mspId;
	const peers = network.getChannel().getEndorsers(mspId);
	return new SampleTransactionEventHandler(transactionId, network, peers);
};

export class AsyncBarrier {
	readonly #emitter = new EventEmitter();
	#result: Error | null | undefined; // undefined before completion, then null for success and Error for failure

	async wait(): Promise<void> {
		if (this.#result === null) {
			return;
		}
		if (this.#result !== undefined) {
			throw this.#result;
		}

		await new Promise<void>((resolve, reject) => this.#emitter.on(eventName, () => {
			if (this.#result instanceof Error) {
				reject(this.#result);
			} else {
				resolve();
			}
		}));
	}

	signal(): void {
		if (this.#result !== undefined) {
			return;
		}
		this.#emitter.emit(eventName);
	}

	error(error: Error): void {
		if (this.#result !== undefined) {
			return;
		}
		this.#result = error;
		this.#emitter.emit(eventName);
	}

}
