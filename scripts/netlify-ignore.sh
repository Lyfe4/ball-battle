#!/usr/bin/env bash
# Netlify's build ignore rule (netlify.toml `[build] ignore`): exit 0 skips the build, anything else
# builds. Build minutes are scarce (300 a month), so a push that changes only files the site and its
# functions never use (docs, Markdown, workflows, tests) skips. Builds anyway when Netlify has no
# earlier build to compare with, or for a retry or a manual deploy of the same commit (someone wants
# that build: a changed environment variable needs one). Netlify runs it from the base directory
# with CACHED_COMMIT_REF (the last build's commit) and COMMIT_REF (this one) set.
set -u
if [ -z "${CACHED_COMMIT_REF:-}" ] || [ -z "${COMMIT_REF:-}" ]; then exit 1; fi
if [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then exit 1; fi
# Unknown to this clone (a shallow one): build.
git cat-file -e "$CACHED_COMMIT_REF^{commit}" 2>/dev/null || exit 1
git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- . \
  ':(exclude)docs/' \
  ':(exclude)*.md' \
  ':(exclude).github/' \
  ':(exclude)*.test.ts'
