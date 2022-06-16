/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Network} from '../../network';
import {Query} from './query';

export type QueryHandlerFactory = (network: Network) => QueryHandler;

export interface QueryHandler {
	evaluate(query: Query): Promise<Buffer>;
}
