/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Checkpointer } from '../../checkpointer';
import { BlockListener } from '../../events';

export function newCheckpointBlockListener(listener: BlockListener, checkpointer: Checkpointer): BlockListener {
	return async (event) => {
		const checkpointBlockNumber = checkpointer.getBlockNumber();
		if (!checkpointBlockNumber || checkpointBlockNumber.equals(event.blockNumber)) {
			await listener(event);
			const nextBlockNumber = event.blockNumber.add(1);
			await checkpointer.setBlockNumber(nextBlockNumber);
		}
	};
}
