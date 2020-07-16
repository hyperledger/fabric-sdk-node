/*
# SPDX-License-Identifier: Apache-2.0
*/

const path = require('path');
const runShellCommand = require('./runShellCommand').runShellCommand;

async function main() {
	const dockerComposeDir = path.resolve(__dirname, '..', '..', 'test', 'fixtures', 'docker-compose');
	const options = {
		cwd: dockerComposeDir
	};
	// make sure that necessary containers are up by docker-compose
	await runShellCommand('docker-compose -f docker-compose-tls-level-db.yaml -p node up -d && sleep 15', options);
	await runShellCommand('docker ps -a', options);
}

main().catch(console.error); // eslint-disable-line no-console
