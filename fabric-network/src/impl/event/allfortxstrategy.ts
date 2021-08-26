/*
 * Copyright 2018, 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {EventCount, SuccessCallback, FailCallback, TransactionEventStrategy} from './transactioneventstrategy';

import * as Logger from '../../logger';
const logger = Logger.getLogger('AllForTxStrategy');

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
export class AllForTxStrategy extends TransactionEventStrategy {
	protected checkCompletion(counts: EventCount, successFn: SuccessCallback, failFn: FailCallback):void {
		const method = 'checkCompletion';
		logger.debug('%s:%j', method, counts);
		const isAllResponsesReceived = (counts.success + counts.fail === counts.expected);
		if (isAllResponsesReceived) {
			if (counts.success > 0) {
				logger.debug('%s - success', method);
				successFn();
			} else {
				failFn(new Error('No successful events received'));
			}
		} else {
			logger.debug('%s: not complete', method);
		}
	}
}
