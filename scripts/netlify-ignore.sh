#!/usr/bin/env bash
# Netlify's build ignore rule (netlify.toml `[build] ignore`): exit 0 skips the build, anything else
# builds. Build minutes are scarce (300 a month), so a push that changes only files the site and its
# functions never use skips: docs, Markdown, workflows, tests and test-only support code (the
# browser flows, `*-support.ts`, `fake-*.ts`, the server's test helpers) and this rule itself.
# `netlify-ignore.test.ts` checks that nothing the build reads imports an excluded file. Builds anyway
# when Netlify has no earlier build to compare with, or for a retry or a manual deploy of the same
# commit (someone wants that build: a changed environment variable needs one). Netlify runs it from
# the base directory with CACHED_COMMIT_REF (the last built commit) and COMMIT_REF (this one) set.
#
# Netlify records a skip as a failed deploy, "Canceled build due to no content change": that is a
# skip, not an error (the log above it says the ignore command returned exit code 0).
set -u
if [ -z "${CACHED_COMMIT_REF:-}" ] || [ -z "${COMMIT_REF:-}" ]; then exit 1; fi
if [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then exit 1; fi
# Unknown to this clone (a shallow one): build.
git cat-file -e "$CACHED_COMMIT_REF^{commit}" 2>/dev/null || exit 1
if git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- . \
  ':(exclude)docs/' \
  ':(exclude)*.md' \
  ':(exclude).github/' \
  ':(exclude)*.test.ts' \
  ':(exclude)src/flows/' \
  ':(exclude)src/server/test/' \
  ':(exclude)src/*-support.ts' \
  ':(exclude)src/*/fake-*.ts' \
  ':(exclude)scripts/netlify-ignore.sh'; then
  echo "netlify-ignore: SKIPPED, nothing the site or its functions use changed since $CACHED_COMMIT_REF"
  exit 0
fi
echo "netlify-ignore: building, the site or its functions changed since $CACHED_COMMIT_REF"
exit 1
