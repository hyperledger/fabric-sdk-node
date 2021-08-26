/**
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Constants from './constants';
import * as BaseUtils from './lib/utility/baseUtils';
import {Given, Then} from 'cucumber';

Given(/^I place a scenario start message (.+?)$/, {timeout: Constants.STEP_SHORT}, (featureType: string) => {
	BaseUtils.logScenarioStart(featureType);
	return Promise.resolve();
});

Then(/^Force pass/, () => {
	// Want to force a pass for some reason? Call this!
	return Promise.resolve();
});

Then(/^Test function/, () => {
	// Want to test/debug an isolated function? Use ths, but add the test code below.
	return Promise.resolve();
});
