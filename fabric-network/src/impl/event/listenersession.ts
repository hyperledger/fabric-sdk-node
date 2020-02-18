/**
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ListenerSession {
	start(): Promise<void>;
	close(): void;
}
