/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventInfo } from 'fabric-common';

export type BlockEvent = EventInfo;
export type BlockListener = (event: BlockEvent) => Promise<void>;
