/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, User } from 'fabric-common';

import { Identity } from './identity';
import { IdentityData } from './identitydata';

export interface IdentityProvider {
	readonly type: string;
	fromJson(data: IdentityData): Identity;
	toJson(identity: Identity): IdentityData;
	getUserContext(identity: Identity, name: string): Promise<User>;
}
