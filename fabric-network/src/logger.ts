/*
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// reuse the client implementation of the logger as we are part of the client
// abstracted out in case we want to change this in the future.
import {Utils} from 'fabric-common';
// eslint-disable-next-line @typescript-eslint/unbound-method
export const getLogger = Utils.getLogger;
