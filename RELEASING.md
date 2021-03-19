# Node SDK Release Process Document - Main Branch

Main branch does not expect to publish releases. Review this file in release branches for documentation of how to publish a release for that release branch.

Using main branch and **latest** release branch of v2.2 as example throughout.

## Check Version and Tag for Snapshot Builds

Check top level `package.json` file properties **version** and **tag** are correct for publishing snapshots.  Expect *2.3.0-snapshot* and *unstable*.  

If this is not the case then builds are likely to fail.  Consider fixing and creating a PR.

[NOTE: *2.3.0* is the anticipated next branch release, The major and minor version release number *m.m.0* should change as new release branches are created and main moves on]
