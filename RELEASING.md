# Node SDK Release Process Document - For Latest Branch

Using v2.2 branch and last release of v2.2.3 as an example throughout.

## Pre-Check

Check top level `package.json` file properties **version** and **tag** are one above the current release and correct for publishing snapshots.  Expect *2.2.4-snapshot* and *unstable-2.2*.  If this is not the case then builds are likely to fail.  Consider fixing and creating a PR or move straight onto submit a PR for a new release.

## Submit Release PR

- Create a jira for publish  - publish v2.2.4.
- Run `scripts/changelog.sh` script from the project root directory.  It takes two arguments; last release commit hash and next release version number - `./scripts/changelog.sh <commithash> 2.2.4`.
- Update the **version** and **tag** properties in the top-level `package.json` file to be the appropriate values - next release version *2.2.4* and release npm tag *latest*.  **[NOTE: This would be latest-2.2 when a new branch supercedes as latest.]**
- Create `release_notes/v2.2.4.txt` file with appropriate text - "This is a maintenance release containing bug fixes".
- Git add, submit, push and create PR.  The build once the PR is merged will do the npm publishing.  Check it has npm published at https://www.npmjs.com/package/fabric-client and https://www.npmjs.com/package/fabric-common

## Tag Release

- Create in GitHub a release draft with similar text to the release_notes - "This is a maintenance release containing bug fixes": 
    - Code > Tags > Releases > Draft a new release
    - Be sure to set:
        - Title = v2.2.4
        - Tag version = v2.2.4
        - Target Branch = release-2.2  [NOTE: Check that no commits have gone into the branch since the commit that did the npm publishing as just just selecting the branch will tag the latest commit.  If subsequent commits have gone in then the commit that did the publishing needs to be selected explicityly.]
- Save as draft iniitallly.
- When ready 'Publish release'.  Publishing the release in GitHub creates a corresponding Git tag.

## Post Release Clean-up

- Create a jira for Reset snapshot publishing to 2.2.5.
- Once the release is complete, create a PR to change the top-level `package.json` file's **version** and **tag** properties back to ones for publishing snapshots - *2.2.5-snapshot* and *unstable-2.2*.

## Post Release Announcement

Post a release notice on mailing list or slack channel if appropriate.



