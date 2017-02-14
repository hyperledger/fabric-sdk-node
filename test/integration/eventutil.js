/*
 Copyright 2017 London Stock Exchange All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the 'License');
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

                http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an 'AS IS' BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict';

function triggerEvent(eh, reginfo, timeout, action) {
	var timedout = true;
	var timeoutId = null;
	var timedReg = new Promise(function(resolve, reject) {
		if (reginfo.type == 'TX') {
			eh.registerTxEvent(reginfo.txid,
				function(event) {
					timedout = false;
					resolve();
					if (timeoutId) {
						clearTimeout(timeoutId);
					}
					eh.unregisterTxEvent(reginfo.txid);
				});
		} else if (reginfo.type == 'CHAINCODE') {
			var regid = eh.registerChaincodeEvent(reginfo.chaincodeID,
				reginfo.eventNameRegex,
				function(event) {
					timedout = false;
					resolve();
					if (timeoutId) {
						clearTimeout(timeoutId);
					}
					eh.unregisterChaincodeEvent(regid);
				});
		}
		if (timedout) {
			timeoutId = setTimeout(function() {
				if (timedout) {
					if (reginfo.type == 'TX') {
						eh.unregisterTxEvent(reginfo.txid);
					} else if (reginfo.type == 'CHAINCODE') {
						eh.unregisterChaincodeEvent(regid);
					}
					return reject();
				}
			}, timeout);
		}
	});
	var sendPromise = action();
	return Promise.all([sendPromise, timedReg]);
}

module.exports.triggerEvent = triggerEvent;