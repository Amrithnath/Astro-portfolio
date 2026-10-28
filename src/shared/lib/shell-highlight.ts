// Tokenises a one-line shell command for zsh-syntax-highlighting style rendering.
export type ShellTokenKind = 'cmd' | 'flag' | 'string' | 'var' | 'op' | 'path' | 'arg' | 'space';

export interface ShellToken {
  kind: ShellTokenKind;
  text: string;
}

const OPERATOR = /^(\|\||&&|[|;&<>]|>>)/;
const VARIABLE = /^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*)/;

function classifyWord(word: string, expectCommand: boolean): ShellTokenKind {
  if (expectCommand) return 'cmd';
  if (/^--?[A-Za-z]/.test(word)) return 'flag';
  if (/^[~./]/.test(word) || word.includes('/')) return 'path';
  return 'arg';
}

export function tokenizeShell(input: string): ShellToken[] {
  const tokens: ShellToken[] = [];
  let expectCommand = true;
  let i = 0;
  while (i < input.length) {
    const rest = input.slice(i);
    const space = /^\s+/.exec(rest);
    if (space) {
      tokens.push({ kind: 'space', text: space[0] });
      i += space[0].length;
      continue;
    }
    const op = OPERATOR.exec(rest);
    if (op) {
      tokens.push({ kind: 'op', text: op[0] });
      expectCommand = !/^[<>]/.test(op[0]);
      i += op[0].length;
      continue;
    }
    const quote = rest[0];
    if (quote === '"' || quote === "'") {
      let end = 1;
      while (end < rest.length && rest[end] !== quote) end += rest[end] === '\\' && quote === '"' ? 2 : 1;
      const text = rest.slice(0, Math.min(end + 1, rest.length));
      tokens.push({ kind: 'string', text });
      expectCommand = false;
      i += text.length;
      continue;
    }
    const variable = VARIABLE.exec(rest);
    if (variable) {
      tokens.push({ kind: 'var', text: variable[0] });
      expectCommand = false;
      i += variable[0].length;
      continue;
    }
    const word = /^[^\s|;&<>"'$]+|^\$/.exec(rest)![0];
    tokens.push({ kind: classifyWord(word, expectCommand), text: word });
    expectCommand = false;
    i += word.length;
  }
  return tokens;
}
