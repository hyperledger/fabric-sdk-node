Cryptogen created using fabric 1.4 level cryptogen using `generate.sh`

Mulitple configs are generated:
- config-base, does not include anchor peers
- config-update, used to update anchor peers

Both folders contain a ./generate.sh to run, that creates new material to be used. A smart person would use a script to run them both, that's what `generateAll.sh` does

Don't forget:
- export the cryptogen path before you run the command, toherwise it will fail, and you will cry

The above is to be automated in the build so that we create new material prior to evey test, which will prevent certifaicate expiration issues.
