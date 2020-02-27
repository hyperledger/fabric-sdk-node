/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	Endorser,
	EventInfo,
} from 'fabric-common';

export interface CommitError extends Error {
	peer: Endorser;
}

export interface CommitEvent extends EventInfo {
	peer: Endorser;
}

export type CommitListener = (error?: CommitError, event?: CommitEvent) => void;
