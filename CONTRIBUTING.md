# Contributions Welcome!

This repository is part of the Fabric project.
Please consult [Fabric's CONTRIBUTING documentation](http://hyperledger-fabric.readthedocs.io/en/latest/CONTRIBUTING.html) as the basis on how to contribute to this repository.

## To code contributors

The following check-list is for code contributors to make sure their changesets are compliant to the coding standards and avoid time wasted in rejected changesets:

Check the coding styles, run the following command and make sure no ESLint violations are present:
* `gulp`

Run the full unit test bucket and make sure 100% are passing.  Because v1.0 is still in active development, all tests may not pass. You can run each individually to isolate the failure(s):
* `gulp test`

The gulp test command above also generates code coverage reports. Your new code should be accompanied with unit tests and provide 80% line coverage or higher.

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
s
