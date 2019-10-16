/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as BaseUtils from './lib/utility/baseUtils';

import { Given, Then } from 'cucumber';

Given(/^I place a scenario start message (.+?)$/, { timeout: Constants.STEP_SHORT as number }, async (featureType) => {
	BaseUtils.logScenarioStart(featureType);
});

Then(/^Force pass/, async () => {
	return Promise.resolve();
});
