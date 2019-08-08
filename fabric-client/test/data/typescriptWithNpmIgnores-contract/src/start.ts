/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shim } from 'fabric-shim';
import { Chaincode } from '.';

Shim.start(new Chaincode());
