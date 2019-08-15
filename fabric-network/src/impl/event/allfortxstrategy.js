/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const AbstractEventStrategy = require('fabric-network/lib/impl/event/abstracteventstrategy');

const logger = require('fabric-network/lib/logger').getLogger('AllForTxStrategy');

/**
 * Event handling strategy that:
 * - Waits for all reponses from event hubs.
 * - Fails if all responses are errors.
 * - Succeeds if any reponses are successful.
 *
 * Instances of the strategy are stateful and must only be used for a single transaction.
 * @private
 * @class
 */
class AllForTxStrategy extends AbstractEventStrategy {
	/**
	 * @inheritdoc
	 */
	checkCompletion(counts, successFn, failFn) {
		logger.debug('checkCompletion:', counts);
		const isAllResponsesReceived = (counts.success + counts.fail === counts.expected);
		if (isAllResponsesReceived) {
			if (counts.success > 0) {
				successFn();
			} else {
				failFn(new Error('No successful events received'));
			}
		}
	}
}

module.exports = AllForTxStrategy;
