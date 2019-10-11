/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Then } from 'cucumber';

Then(/^Force pass/, async () => {
	return Promise.resolve();
});
