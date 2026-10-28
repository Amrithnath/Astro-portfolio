import assert from 'node:assert/strict';
import test from 'node:test';
import { tokenizeShell } from '../../src/shared/lib/shell-highlight.ts';

const kinds = command => tokenizeShell(command).filter(t => t.kind !== 'space').map(t => [t.kind, t.text]);

test('classifies commands, flags, paths and plain arguments', () => {
  assert.deepEqual(kinds('ls -la ~/projects/ --sort=date readme'), [
    ['cmd', 'ls'], ['flag', '-la'], ['path', '~/projects/'], ['flag', '--sort=date'], ['arg', 'readme'],
  ]);
});

test('treats the word after a pipe or chain operator as a command', () => {
  assert.deepEqual(kinds("echo $TECH_STACK | tr ':' '\\n' && uptime"), [
    ['cmd', 'echo'], ['var', '$TECH_STACK'], ['op', '|'], ['cmd', 'tr'], ['string', "':'"],
    ['string', "'\\n'"], ['op', '&&'], ['cmd', 'uptime'],
  ]);
});

test('keeps escaped quotes inside double-quoted strings and separates redirect operators', () => {
  assert.deepEqual(kinds('printf "say \\"hi\\"\\n" > out.txt'), [
    ['cmd', 'printf'], ['string', '"say \\"hi\\"\\n"'], ['op', '>'], ['arg', 'out.txt'],
  ]);
});

test('round-trips the original text exactly', () => {
  for (const command of ['grep -ri "<query>" ~/', 'cat .banner', '/sbin/init --system', 'echo "unterminated', 'a $ b']) {
    assert.equal(tokenizeShell(command).map(t => t.text).join(''), command);
  }
});
