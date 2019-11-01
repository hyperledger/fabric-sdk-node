/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import { Constants } from './constants';
import * as BaseUtils from './lib/utility/baseUtils';
import { Given, Then } from 'cucumber';

Given(/^I place a scenario start message (.+?)$/, { timeout: Constants.STEP_SHORT as number }, async (featureType: string) => {
	BaseUtils.logScenarioStart(featureType);
});

Then(/^Force pass/, async () => {
	// Want to force a pass for some reason? Call this!
	return Promise.resolve();
});

Then(/^Test function/, async () => {
	// Want to test/debug an isolated function? Use ths, but add the test code below.
	return Promise.resolve();
});
