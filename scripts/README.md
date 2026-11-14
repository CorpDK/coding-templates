# Maintainer scripts

| Script                                       | Purpose                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`npm-b0-bootstrap.sh`](npm-b0-bootstrap.sh) | One-time npm B0 for the seven generator scaffolds: publish lockstep CalVer (`--tag bootstrap`), deprecate, configure trusted publishing (local 2FA). Not used by GitHub Actions. |

CI publish uses [`.github/scripts/publish-ds-automation.sh`](../.github/scripts/publish-ds-automation.sh) only.
