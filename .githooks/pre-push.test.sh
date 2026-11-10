#!/usr/bin/env bash
# Battery of the repo's git hooks (.githooks/): every case builds a throwaway world (a bare remote,
# a clone wired to this repo's hooks, stub tools on PATH and a throwaway global git config), pushes
# or commits for real, and reads what ran.
# Run from the repo root with bash 5 (on the Mac, Homebrew's: bash 3.2 gives false greens):
#   bash .githooks/pre-push.test.sh
set -u

if [ "${BASH_VERSINFO[0]:-0}" -lt 5 ]; then
  echo "RED: this battery needs bash 5, not $BASH_VERSION (on the Mac: /opt/homebrew/bin/bash)"
  exit 2
fi

HERE=$(cd "$(dirname "$0")/.." && pwd -P)
# Resolved (-P): the stubs log `pwd -P`, and on the Mac $TMPDIR sits behind the /var symlink.
SCRATCH=$(cd "$(mktemp -d "${TMPDIR:-/tmp}/ui-hooks-test.XXXXXX")" && pwd -P)
# No case reads a terminal: the stub hooks read their stdin to the end.
exec < /dev/null
trap 'rm -rf "${SCRATCH:?}"' EXIT
BASE_PATH=$PATH
ZERO=0000000000000000000000000000000000000000
passed=0
failed=0
n=0

ok() { passed=$((passed + 1)); echo "ok   - $1"; }
ko() { failed=$((failed + 1)); echo "FAIL - $1"; [ -f "$W/out" ] && sed 's/^/       | /' "$W/out"; }
check() { local name=$1; shift; if "$@"; then ok "$name"; else ko "$name"; fi; }

# The global hooks are stubs: each one records its arguments and stdin and exits with the code in
# <world>/<hook>.rc (0 when the file is missing).
write_global_stub() {
  cat > "$1" <<'EOF'
#!/usr/bin/env bash
world=$(cd "$(dirname "$0")/.." && pwd -P)
name=$(basename "$0")
printf '%s\n' "$@" > "$world/$name.args"
cat > "$world/$name.stdin"
exit "$(cat "$world/$name.rc" 2>/dev/null || echo 0)"
EOF
  chmod +x "$1"
}

# A tool stub: logs `<tool> <args> @ <commit> <clean|dirty> <dir>` and exits with the code in
# rc/<tool>-<args, _ for spaces>.rc of the checkout it runs in (0 when the file is missing).
write_tool_stub() {
  cat > "$1" <<'EOF'
#!/usr/bin/env bash
tool=$(basename "$0")
state=clean; [ -n "$(git status --porcelain 2>/dev/null)" ] && state=dirty
echo "$tool $* @ $(git rev-parse HEAD 2>/dev/null) $state $(pwd -P)" >> "$CALLS"
key=$(printf '%s' "$tool $*" | tr ' /' '__' | sed 's/_/-/')
exit "$(cat "rc/$key.rc" 2>/dev/null || echo 0)"
EOF
  chmod +x "$1"
}

# new_world [--no-global-path | --global-path <dir>]: a fresh world in $W, its clone in $W/work.
new_world() {
  n=$((n + 1))
  W="$SCRATCH/case$n"
  mkdir -p "$W/bin" "$W/global-hooks"
  local global_path="$W/global-hooks"
  case "${1:-}" in
    --no-global-path) global_path= ;;
    --global-path) global_path=$2 ;;
  esac
  {
    printf '[user]\n\tname = test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n'
    printf '[advice]\n\tdetachedHead = false\n[protocol "file"]\n\tallow = always\n'
    [ -n "$global_path" ] && printf '[core]\n\thooksPath = %s\n' "$global_path"
  } > "$W/gitconfig"
  export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL="$W/gitconfig" CALLS="$W/calls"
  for h in pre-push commit-msg pre-commit applypatch-msg; do write_global_stub "$W/global-hooks/$h"; done
  write_tool_stub "$W/bin/pnpm"
  write_tool_stub "$W/bin/actionlint"
  PATH="$W/bin:$BASE_PATH"
  git init -q --bare "$W/remote.git"
  git init -q "$W/work"
  cp -R "$HERE/.githooks" "$W/work/.githooks"
  mkdir -p "$W/work/src"
  echo "export const x = 1;" > "$W/work/src/index.ts"
  echo '{ "name": "@erplora/ui" }' > "$W/work/package.json"
  echo "# ui" > "$W/work/README.md"
  git -C "$W/work" config core.hooksPath .githooks
  git -C "$W/work" remote add origin "$W/remote.git"
  git -C "$W/work" add -A
  git -C "$W/work" commit -q -m "initial"
  : > "$W/calls"
}

push() { (cd "$W/work" && git push "$@") > "$W/out" 2>&1; }
remote_tip() { git -C "$W/remote.git" rev-parse -q --verify "$1" || echo none; }
head_sha() { git -C "$W/work" rev-parse HEAD; }
commit_file() {
  mkdir -p "$(dirname "$W/work/$1")"
  echo "$2" > "$W/work/$1"
  git -C "$W/work" add -A
  git -C "$W/work" commit -q -m "$1=$2"
}
called() { grep -qF -- "$1" "$W/calls"; }
not_called() { ! grep -q . "$W/calls"; }
times_called() { grep -cF -- "$1" "$W/calls"; }
# The commands in the order they ran, without their commit and folder.
order() { sed 's/ @ .*//' "$W/calls" | tr '\n' ','; }

INSTALL="pnpm install --frozen-lockfile"
LINT="pnpm lint"
TYPECHECK="pnpm typecheck"
TEST="pnpm test"
ACTIONLINT="actionlint -color"

echo "== pre-push: the checks of the removed test workflow"

new_world
push origin main
sha=$(head_sha)
check "first push of main (new branch) is accepted when the checks pass" test "$(remote_tip main)" = "$sha"
check "pnpm install --frozen-lockfile runs on the pushed commit" called "$INSTALL @ $sha clean"
check "pnpm lint runs on the pushed commit" called "$LINT @ $sha clean"
check "pnpm typecheck runs on the pushed commit" called "$TYPECHECK @ $sha clean"
check "pnpm test runs on the pushed commit" called "$TEST @ $sha clean"
check "the order is the workflow's: install, lint, typecheck, test" \
  test "$(order)" = "$INSTALL,$LINT,$TYPECHECK,$TEST,"
check "without workflows in the commit, actionlint has nothing to lint and does not run" \
  bash -c "! grep -q '^actionlint' '$W/calls'"
check "the checks run in a checkout other than the working tree" \
  bash -c "grep -q . '$W/calls' && ! grep -qF ' $W/work' '$W/calls'"
check "the global pre-push gets the same arguments" \
  test "$(cat "$W/pre-push.args" 2>/dev/null)" = "$(printf 'origin\n%s' "$W/remote.git")"
check "the global pre-push gets the same stdin" \
  test "$(cat "$W/pre-push.stdin" 2>/dev/null)" = "refs/heads/main $sha refs/heads/main $ZERO"

commit_file README.md "docs only"
: > "$W/calls"
push origin main
sha2=$(head_sha)
check "an update touching only docs is checked too (the workflow had no path filter)" called "$TEST @ $sha2 clean"
check "the global pre-push gets the update's old and new tips" \
  test "$(cat "$W/pre-push.stdin" 2>/dev/null)" = "refs/heads/main $sha2 refs/heads/main $sha"

commit_file .github/workflows/x.yml "on: push"
: > "$W/calls"
push origin main
sha3=$(head_sha)
check "a commit with workflows is accepted when actionlint passes" test "$(remote_tip main)" = "$sha3"
check "a commit with workflows runs actionlint on the pushed commit" called "$ACTIONLINT @ $sha3 clean"
check "with workflows the order is the workflow's: actionlint, install, lint, typecheck, test" \
  test "$(order)" = "$ACTIONLINT,$INSTALL,$LINT,$TYPECHECK,$TEST,"

for step in "$ACTIONLINT" "$INSTALL" "$LINT" "$TYPECHECK" "$TEST"; do
  new_world
  commit_file .github/workflows/x.yml "on: push"
  push origin main
  before=$(remote_tip main)
  key=$(printf '%s' "$step" | tr ' /' '__' | sed 's/_/-/')
  commit_file "rc/$key.rc" 1
  : > "$W/calls"
  push origin main; rc=$?
  check "a red «${step}» aborts the push" test "$rc" -ne 0 -a "$(remote_tip main)" = "$before"
  check "the abort names «${step}»" grep -qF "pre-push: $step failed on" "$W/out"
  check "the abort after «${step}» says the push is aborted" grep -q "failed on .*: push aborted" "$W/out"
  check "nothing runs after a red «${step}»" test "$(order)" = "$(printf '%s,' "$ACTIONLINT" "$INSTALL" "$LINT" "$TYPECHECK" "$TEST" | sed "s/\(.*$step,\).*/\1/")"
done

new_world
push origin main
before=$(remote_tip main)
commit_file "rc/pnpm-test.rc" 1
echo 0 > "$W/work/rc/pnpm-test.rc"
push origin main; rc=$?
check "a red commit is refused even if the working tree is green" test "$rc" -ne 0 -a "$(remote_tip main)" = "$before"
git -C "$W/work" checkout -q -- rc
commit_file "rc/pnpm-test.rc" 0
echo 1 > "$W/work/rc/pnpm-test.rc"
echo junk > "$W/work/untracked.txt"
push origin main; rc=$?
check "a green commit is pushed even if the working tree is red" test "$rc" -eq 0 -a "$(remote_tip main)" = "$(head_sha)"

new_world
push origin main
git -C "$W/work" checkout -q -b feature
commit_file README.md feature
: > "$W/calls"
push origin feature; rc=$?
fsha=$(head_sha)
check "a new non-main branch is checked (the workflow ran on every pull request)" \
  test "$rc" -eq 0 -a "$(remote_tip feature)" = "$fsha" -a -n "$(grep -F "$TEST @ $fsha" "$W/calls")"
check "the global pre-push sees the new branch with a zero remote tip" \
  test "$(cat "$W/pre-push.stdin" 2>/dev/null)" = "refs/heads/feature $fsha refs/heads/feature $ZERO"
: > "$W/calls"
push origin --delete feature; rc=$?
check "deleting a remote branch is accepted" test "$rc" -eq 0 -a "$(remote_tip feature)" = none
check "deleting a remote branch runs no checks" not_called
check "the global pre-push still sees the deletion" \
  test "$(cat "$W/pre-push.stdin" 2>/dev/null)" = "(delete) $ZERO refs/heads/feature $fsha"

new_world
push origin main main:copy; rc=$?
check "the same commit pushed to two branches is accepted" \
  test "$rc" -eq 0 -a "$(remote_tip copy)" = "$(head_sha)" -a "$(remote_tip main)" = "$(head_sha)"
check "the same commit pushed to two branches is checked once" test "$(times_called "$TEST @")" -eq 1

new_world
push origin main
git -C "$W/work" tag v1
: > "$W/calls"
push origin v1; rc=$?
check "pushing a tag is accepted" test "$rc" -eq 0 -a "$(remote_tip refs/tags/v1)" = "$(head_sha)"
check "pushing a tag runs no checks (the workflow never ran on tags)" not_called
check "the global pre-push still sees the tag" \
  test "$(cat "$W/pre-push.stdin" 2>/dev/null)" = "refs/tags/v1 $(head_sha) refs/tags/v1 $ZERO"

new_world
echo 1 > "$W/pre-push.rc"
push origin main; rc=$?
check "a failing global pre-push aborts the push" test "$rc" -ne 0 -a "$(remote_tip main)" = none
check "a failing global pre-push stops before the checks" not_called
check "the abort names the global pre-push" grep -q "the global pre-push hook .* rejected the push" "$W/out"

new_world --no-global-path
push origin main; rc=$?
check "without a global hooksPath the push works" test "$rc" -eq 0 -a "$(remote_tip main)" = "$(head_sha)"
check "without a global hooksPath the checks still run" called "$TEST @ $(head_sha)"

new_world --global-path "$SCRATCH/empty-global-hooks"
mkdir -p "$SCRATCH/empty-global-hooks"
push origin main; rc=$?
check "a global hooksPath without pre-push does not break the push" test "$rc" -eq 0 -a "$(remote_tip main)" = "$(head_sha)"

new_world
git -C "$W/work" config core.hooksPath "$W/work/.githooks"
printf '[core]\n\thooksPath = %s\n' "$W/work/.githooks" >> "$W/gitconfig"
perl -e 'alarm 60; exec @ARGV' bash -c 'cd "$1" && git push origin main' _ "$W/work" > "$W/out" 2>&1; rc=$?
check "a global hooksPath that is .githooks itself does not loop" test "$rc" -eq 0 -a "$(remote_tip main)" = "$(head_sha)"

# As a submodule of hub or saas: the push from packages/ui is checked in a checkout of its own,
# outside the superproject (CI checked ui out alone, so its own pnpm-workspace.yaml applies).
new_world
push origin main
git init -q "$W/super"
git -C "$W/super" submodule add -q "$W/remote.git" packages/ui > /dev/null 2>&1
git -C "$W/super" commit -q -m "ui as a submodule"
sub="$W/super/packages/ui"
git -C "$sub" config core.hooksPath .githooks
git -C "$sub" checkout -q -b from-submodule
echo "from the submodule" > "$sub/README.md"
git -C "$sub" commit -q -am "edit in the submodule"
ssha=$(git -C "$sub" rev-parse HEAD)
: > "$W/calls"
(cd "$sub" && git push origin from-submodule) > "$W/out" 2>&1; rc=$?
check "a push from the submodule checkout is accepted when the checks pass" \
  test "$rc" -eq 0 -a "$(remote_tip from-submodule)" = "$ssha"
check "a push from the submodule checkout checks the pushed commit" called "$TEST @ $ssha clean"
check "a push from the submodule checkout is checked outside the superproject" \
  bash -c "grep -q . '$W/calls' && ! grep -qF ' $W/super' '$W/calls'"
check "a push from the submodule checkout leaves no worktree behind" \
  test "$(git -C "$sub" worktree list | wc -l | tr -d ' ')" -eq 1

new_world
mkdir -p "$W/minbin"
for tool in git bash perl; do ln -s "$(command -v "$tool")" "$W/minbin/$tool"; done
if PATH="$W/minbin:/usr/bin:/bin" command -v pnpm > /dev/null; then
  echo "skip - pnpm is in /usr/bin or /bin: the missing-pnpm case cannot hide it"
else
  PATH="$W/minbin:/usr/bin:/bin" push origin main; rc=$?
  check "without pnpm the push is aborted" test "$rc" -ne 0 -a "$(remote_tip main)" = none
  check "the abort says pnpm is missing" grep -q "pre-push: pnpm is missing" "$W/out"
fi

new_world
commit_file .github/workflows/x.yml "on: push"
mkdir -p "$W/minbin"
for tool in git bash perl; do ln -s "$(command -v "$tool")" "$W/minbin/$tool"; done
ln -s "$W/bin/pnpm" "$W/minbin/pnpm"
if PATH="$W/minbin:/usr/bin:/bin" command -v actionlint > /dev/null; then
  echo "skip - actionlint is in /usr/bin or /bin: the missing-actionlint case cannot hide it"
else
  PATH="$W/minbin:/usr/bin:/bin" push origin main; rc=$?
  check "with workflows and without actionlint the push is aborted" test "$rc" -ne 0 -a "$(remote_tip main)" = none
  check "the abort says actionlint is missing" grep -q "pre-push: actionlint is missing" "$W/out"
fi

echo "== delegates to the global hooks"

for hook in commit-msg pre-commit applypatch-msg; do
  new_world
  echo msg > "$W/msg"
  # pre-commit takes no arguments; commit-msg and applypatch-msg take the message file.
  args="$W/msg"; [ "$hook" = pre-commit ] && args=
  (cd "$W/work" && bash ".githooks/$hook" $args) > "$W/out" 2>&1; rc=$?
  check "$hook: passes when the global one passes" test "$rc" -eq 0
  check "$hook: the global one gets the same arguments" test -f "$W/$hook.args" -a "$(cat "$W/$hook.args" 2>/dev/null)" = "$args"
  echo 1 > "$W/$hook.rc"
  (cd "$W/work" && bash ".githooks/$hook" $args) > "$W/out" 2>&1; rc=$?
  check "$hook: fails when the global one fails" test "$rc" -ne 0
  new_world --no-global-path
  (cd "$W/work" && bash ".githooks/$hook" $args) > "$W/out" 2>&1; rc=$?
  check "$hook: exits 0 without a global hooksPath" test "$rc" -eq 0
done

new_world
echo 1 > "$W/commit-msg.rc"
echo x > "$W/work/x.txt"
git -C "$W/work" add x.txt
before=$(head_sha)
git -C "$W/work" commit -q -m "x" > "$W/out" 2>&1; rc=$?
check "git commit runs the global commit-msg through .githooks" test "$rc" -ne 0 -a "$(head_sha)" = "$before"
rm "$W/commit-msg.rc"
echo 1 > "$W/pre-commit.rc"
git -C "$W/work" commit -q -m "x" > "$W/out" 2>&1; rc=$?
check "git commit runs the global pre-commit through .githooks" test "$rc" -ne 0 -a "$(head_sha)" = "$before"

echo
if [ "$failed" -eq 0 ]; then echo "GREEN: $passed passed"; else echo "RED: $failed failed, $passed passed"; fi
[ "$failed" -eq 0 ]
