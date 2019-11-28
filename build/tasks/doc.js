/**
 * SPDX-License-Identifier: Apache-2.0
 */


const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');
const fs = require('fs-extra');
const path = require('path');
const replace = require('gulp-replace');

const currentBranch = process.env.BUILD_BRANCH || 'master';
const docsRoot = process.env.DOCS_ROOT || './docs/gen';

gulp.task('clean', () => {
	return fs.removeSync(path.join(docsRoot, currentBranch));
});

const docSrc = [
	'docs/index.md',
	'fabric-network/index.js',
	'fabric-network/lib/**/*.js',
	'fabric-client/index.js',
	'fabric-client/lib/**/*.js',
	'!fabric-client/lib/protos/**',
	'fabric-ca-client/index.js',
	'fabric-ca-client/lib/FabricCAServices.js',
	'fabric-ca-client/lib/FabricCAClient.js',
	'fabric-ca-client/lib/AffiliationService.js',
	'fabric-ca-client/lib/IdentityService.js',
];

gulp.task('jsdocs', ['clean'], () => {
	gulp.src(docSrc, {read: false})
		.pipe(jsdoc({
			opts: {
				tutorials: './docs/tutorials',
				destination: path.join(docsRoot, currentBranch)
			},
			templates: {
				systemName: 'Hyperledger Fabric SDK for node.js',
				theme: 'cosmo' // cerulean, cosmo, cyborg, flatly, journal, lumen, paper, readable, sandstone, simplex, slate, spacelab, superhero, united, yeti
			}
		}));
});

gulp.task('docs-dev', ['docs'], () => {
	gulp.watch(docSrc, ['docs']);
});


gulp.task('docs', ['jsdocs'], () => {
	const packageJson = require(path.join(__dirname, '../..', 'package.json'));

	// jsdocs produced
	// if this is the master build then we need to ensure that the index.html and
	// the 404.html page are properly setup and configured.
	if (currentBranch === 'master') {
		gulp.src('./docs/redirectTemplates/*.html')
			.pipe(replace('LATEST__VERSION', packageJson.docsLatestVersion))
			.pipe(gulp.dest(docsRoot));
	} else { // eslint-disable-next-line
		console.log(`Not updating or routing logic, as not master branch - it is ${currentBranch}`);
	}
});
