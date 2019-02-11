
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 *
 *   NOTE: this file must have a name that is alphabetically before the BasePackager testing
 *         to avoid errors of the rewiring when both test are run. This test must run before
 *         BasePackager.
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('Lifecycle Packager', () => {
	const Lifecycle = require('../../lib/packager/Lifecycle');
	let lifecycle;

	beforeEach(() => {
		lifecycle = new Lifecycle();
	});

	describe('#finalPackage', () => {

		it('should return the package when given all parameters', async () => {
			const final_package = await lifecycle.finalPackage('name', 'v1', 'golang', Buffer.from('abc'), '/path');
			expect(final_package.length).to.be.gt(200);
		});

		it('should return the package when given all parameters but the path', async () => {
			const final_package = await lifecycle.finalPackage('name', 'v1', 'golang', Buffer.from('abc'));
			expect(final_package.length).to.be.gt(200);
		});
	});

	describe('#buildMetaDataDescriptors', () => {
		it('should return a list of descriptors for the metadata without a path', async () => {
			const descriptors = await lifecycle.buildMetaDataDescriptors('node');
			expect(descriptors[0].name).to.equal('Chaincode-Package-Metadata.json');
		});

		it('should return a list of descriptors for the metadata with a path', async () => {
			const descriptors = await lifecycle.buildMetaDataDescriptors('golang', '/path');
			expect(descriptors[0].name).to.equal('Chaincode-Package-Metadata.json');
		});

		it('should return a list of descriptors for the metadata with no name and no path', async () => {
			const descriptors = await lifecycle.buildMetaDataDescriptors();
			expect(descriptors[0].name).to.equal('Chaincode-Package-Metadata.json');
		});
	});

	describe('#buildPackageDescriptors', () => {
		it('should return a list of descriptors for the package', async () => {
			const descriptors = await lifecycle.buildPackageDescriptors(Buffer.from('abc'));
			expect(descriptors[0].name).to.equal('Chaincode-Package.tar.gz');
		});

		it('should return an empty descriptor when no content provided', async () => {
			const descriptors = await lifecycle.buildPackageDescriptors();
			expect(descriptors[0].name).to.equal('Chaincode-Package.tar.gz');
		});
	});
});
