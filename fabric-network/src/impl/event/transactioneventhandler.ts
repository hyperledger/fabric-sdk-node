/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimeoutError } from '../../errors/timeouterror';
import { TransactionEventStrategy } from './transactioneventstrategy';
// @ts-ignore: no implicit any
import Network = require('../../network');
import { Endorser } from 'fabric-common';
import { CommitError, CommitEvent, CommitListener } from './commitlistener';

// @ts-ignore no implicit any
import Logger = require('../../logger');
const logger = Logger.getLogger('TransactionEventHandler');

export interface TxEventHandler {
	startListening(): Promise<void>;
	waitForEvents(): Promise<void>;
	cancelListening(): void;
}

export type TxEventHandlerFactory = (transactionId: string, network: Network) => TxEventHandler;

/**
 * Handles events for a given transaction. Used to wait for a submitted transaction to be successfully commited to
 * the ledger.
 * Delegates to an event strategy to decide whether events or errors received should be interpreted as success or
 * failure of a transaction.
 * @private
 */
export class TransactionEventHandler implements TxEventHandler {
	/**
	 * @typedef {Object} TransactionOptions
	 * @property {Number} [commitTimeout = 0] Number of seconds to wait for transaction completion. A value of zero
	 * indicates that the handler should wait indefinitely.
	 */

	private readonly transactionId: string;
	private readonly network: Network;
	private readonly strategy: TransactionEventStrategy;
	private readonly options: any;
	private readonly peers: Endorser[];
	private readonly notificationPromise: Promise<void>;
	private readonly respondedPeers = new Set<Endorser>();
	private resolveNotificationPromise!: () => void;
	private rejectNotificationPromise!: (reason: Error) => void;
	private timeoutHandler?: NodeJS.Timeout;
	private listener: CommitListener;

	/**
	 * Constructor.
	 * @private
	 * @param {Transaction} transaction - Transaction object.
	 * @param {Object} strategy - Event strategy implementation.
	 * @param {TransactionOptions} [options] Additional options.
	 */
	constructor(transactionId: string, network: Network, strategy: TransactionEventStrategy) {
		const method = 'constructor';

		this.transactionId = transactionId;
		this.network = network;
		this.strategy = strategy;

		const defaultOptions: any = {
			commitTimeout: 30
		};
		this.options = Object.assign(defaultOptions, network.gateway.getOptions().transaction);

		logger.debug('%s: transactionId = %s, options = %j', method, this.transactionId, this.options);

		this.peers = strategy.getPeers();

		this.notificationPromise = new Promise((resolve, reject) => {
			this.resolveNotificationPromise = resolve;
			this.rejectNotificationPromise = reject;
		});

		this.listener = (error, event) => {
			if (error) {
				this.onError(error);
			} else {
				this.onEvent(event!);
			}
		};
	}

	/**
	 * Called to initiate listening for transaction events.
	 */
	async startListening() {
		const method = 'startListening';

		if (this.peers && this.peers.length > 0) {
			logger.debug('%s - have eventService list - start monitoring', method);
			this.setListenTimeout();
			await this.network.addCommitListener(this.listener, this.peers, this.transactionId);
		} else {
			logger.error('%s - No event services', method);
			// shutdown the monitoring
			this.resolveNotificationPromise();
		}
	}

	/**
	 * Wait until enough events have been received from the event services to satisfy the event handling strategy.
	 * @throws {Error} if the transaction commit is not successful within the timeout period.
	 */
	async waitForEvents() {
		logger.debug('waitForEvents start');
		await this.notificationPromise;
		logger.debug('waitForEvents end');
	}

	/**
	 * Cancel listening for events.
	 */
	cancelListening() {
		logger.debug('cancelListening called');

		if (this.timeoutHandler) {
			clearTimeout(this.timeoutHandler);
		}
		this.network.removeCommitListener(this.listener);
	}

	private setListenTimeout() {
		const method = 'setListenTimeout';

		if (typeof this.options.commitTimeout !== 'number' || this.options.commitTimeout <= 0) {
			logger.debug('%s - no commit timeout', method);
			return;
		}

		logger.debug('%s setTimeout(%s) in seconds for transaction %s', method, this.options.commitTimeout, this.transactionId);
		this.timeoutHandler = setTimeout(
			() => {
				this.timeoutFail();
				logger.error('%s - event handler timed out', method);
			},
			this.options.commitTimeout * 1000
		);
		logger.debug('%s - end', method);
	}

	private timeoutFail() {
		const unrespondedEventServices = this.peers
			.filter((peer) => !this.respondedPeers.has(peer))
			.map((peer) => peer.name)
			.join(', ');
		const errorInfo = {
			message: 'Event strategy not satisfied within the timeout period. No response received from peers: ' + unrespondedEventServices,
			transactionId: this.transactionId
		};
		const error = new TimeoutError(errorInfo);
		this.strategyFail(error);
	}

	private onEvent(event: CommitEvent) {
		logger.debug(`onEvent: received event for ${event.transactionId} from peer ${event.peer.name} with status ${event.status}`);

		this.receivedEventServiceResponse(event.peer);
		if (event.status !== 'VALID') {
			const message = `Commit of transaction ${this.transactionId} failed on peer ${event.peer.name} with status ${event.status}`;
			this.strategyFail(new Error(message));
		} else {
			this.strategy.eventReceived(this.strategySuccess.bind(this), this.strategyFail.bind(this));
		}
	}

	private onError(error: CommitError) {
		logger.debug('onError: received error from peer %s: %s', error.peer.name, error);

		this.receivedEventServiceResponse(error.peer);
		this.strategy.errorReceived(this.strategySuccess.bind(this), this.strategyFail.bind(this));
	}

	private receivedEventServiceResponse(peer: Endorser) {
		this.respondedPeers.add(peer);
	}

	/**
	 * Callback for the strategy to indicate successful commit of the transaction.
	 * @private
	 */
	private strategySuccess() {
		logger.debug('strategySuccess: commit success for transaction %j', this.transactionId);

		this.cancelListening();
		this.resolveNotificationPromise();
	}

	/**
	 * Callback for the strategy to indicate failure of the transaction commit.
	 * @private
	 * @param {Error} error Reason for failure.
	 */
	private strategyFail(error: Error) {
		logger.warn('strategyFail: commit failure for transaction %j: %s', this.transactionId, error);

		this.cancelListening();
		this.rejectNotificationPromise(error);
	}
}
