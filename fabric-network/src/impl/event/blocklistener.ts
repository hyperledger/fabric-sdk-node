/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { FilteredBlock } from 'fabric-common';
import Long = require('long');

export interface BlockEvent {
	type: string;
	blockNumber: Long;
}

export interface FilteredBlockEvent extends BlockEvent {
	type: 'filtered';
	blockData: FilteredBlock;
}

export type BlockListener = (event: BlockEvent) => Promise<void>;
