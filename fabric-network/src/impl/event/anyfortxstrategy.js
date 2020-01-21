/**
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const BaseEventStrategy = require('fabric-network/lib/impl/event/baseeventstrategy');

const logger = require('fabric-network/lib/logger').getLogger('AnyForTxStrategy');

/**
 * Event handling strategy that:
 * - Waits for first successful reponse from an event service.
 * - Fails if all responses are errors.
 * - Succeeds if any reponses are successful.
 *
 * Instances of the strategy are stateful and must only be used for a single transaction.
 * @private
 * @class
 */
class AnyForTxStrategy extends BaseEventStrategy {
	/**
	 * @inheritdoc
	 */
	checkCompletion(counts, successFn, failFn) {
		const method = 'checkCompletion';
		logger.debug('%s:%j:', method, counts);
		const isAllResponsesReceived = (counts.success + counts.fail === counts.expected);
		if (counts.success > 0) {
			logger.debug('%s: success', method);
			successFn();
		} else if (isAllResponsesReceived) {
			failFn(new Error('No successful events received'));
		} else {
			logger.debug('%s - not complete', method);
		}
	}
}

module.exports = AnyForTxStrategy;
