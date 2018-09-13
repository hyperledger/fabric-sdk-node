/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const AbstractEventStrategy = require('fabric-network/lib/impl/event/abstracteventstrategy');

const logger = require('../../logger').getLogger('AnyForTxStrategy');

/**
 * Event handling strategy that:
 * - Waits for first successful reponse from an event hub.
 * - Fails if all responses are errors.
 * - Succeeds if any reponses are successful.
 *
 * Instances of the strategy are stateful and must only be used for a single transaction.
 * @private
 * @class
 */
class AnyForTxStrategy extends AbstractEventStrategy {
	/**
	 * @inheritdoc
	 */
	constructor(eventHubFactory, peers) {
		super(eventHubFactory, peers);
	}

	/**
	 * @inheritdoc
	 */
	checkCompletion(counts, successFn, failFn) {
		const isAllResponsesReceived = (counts.success + counts.fail === counts.expected);
		if (counts.success > 0) {
			successFn();
		} else if (isAllResponsesReceived) {
			failFn(new Error('No successful events received'));
		}
	}
}

module.exports = AnyForTxStrategy;
