# Node SDK release process

Using v2.2 branch and last release of v2.2.3 as an example throughout.

## Pre-check

Check top level `package.json` file properties **version** and **tag** are one above the current release and correct for publishing snapshots. Expect *2.2.4-snapshot* and *unstable*. If this is not the case then builds are likely to fail.  Consider fixing and creating a PR or move straight onto submit a PR for a new release.

## Submit release PR

- Update the **version** and **tag** properties in the top-level `package.json` file to be the appropriate values - next release version *2.2.4* and release npm tag *latest*.
- Git add, submit, push and create PR. Once the PR is merged, the build will do the npm publishing. Check the build completes successfully and that it has published to the npm registry at:
    - https://www.npmjs.com/package/fabric-network
    - https://www.npmjs.com/package/fabric-common
    - https://www.npmjs.com/package/fabric-protos
    - https://www.npmjs.com/package/fabric-ca-client

## Tag release

- Create in GitHub a [release](https://github.com/hyperledger/fabric-sdk-node/releases) draft, referring to previous releases for appropriate text. Be sure to set:
    - **Title**: v2.2.4
    - **Tag version**: v2.2.4
    - **Target Branch**: main *[NOTE: Check that no commits have gone into the branch since the commit that did the npm publishing as just selecting the branch will tag the latest commit.  If subsequent commits have gone in then the commit that did the publishing needs to be selected explicitly.]*
- Save as draft initially.
- When ready 'Publish release'. Publishing the release in GitHub creates a corresponding Git tag.

## Post-release PR

- Once the release is complete, create a PR to change the top-level `package.json` file's **version** and **tag** properties back to ones for publishing snapshots - *2.2.5-snapshot* and *unstable*.
