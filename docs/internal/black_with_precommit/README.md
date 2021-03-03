# Run Black Python formatter using pre-commit

Currently, Black runs with the rest of the lint fixes as part of lint-staged. This is not standard.

The standard way to run Black is via pre-commit. This can be accomplished by moving the `.pre-commit-config.yaml` file from this dir to the root of this repo.
