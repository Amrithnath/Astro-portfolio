const emojiByType = {
  feat: '✨',
  fix: '🐛',
  perf: '⚡',
  security: '🔒',
  refactor: '♻️',
  docs: '📝',
  ci: '👷',
  build: '📦',
  chore: '🔧',
  style: '💄',
  test: '✅',
  revert: '⏪',
};

const startsWithEmoji = /^\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*\s+\S/u;

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-emoji': ({ subject }) => [
          startsWithEmoji.test(subject || ''),
          'subject must begin with a Unicode emoji followed by a space',
        ],
        'type-emoji': ({ type, subject, header }) => {
          const expected = emojiByType[type];
          if (!expected || !subject) return [true, ''];
          const found = subject.match(/^\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?/u)?.[0];
          const breakingFeature =
            type === 'feat' && /^feat(?:\([^)]*\))?!:/.test(header || '') && found === '💥';
          return [breakingFeature || found === expected || (type === 'fix' && found === '🔒'), `type ${type} normally uses ${expected}`];
        },
      },
    },
  ],
  rules: {
    'subject-case': [0],
    'type-enum': [2, 'always', ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'security', 'style', 'test']],
    'subject-emoji': [2, 'always'],
    'type-emoji': [1, 'always'],
  },
  ignores: [
    (commit) => /^chore\(main\): release \d+\.\d+\.\d+(?:\s|$)/.test(commit),
    (commit) => /^Merge\s/.test(commit),
    (commit) => /^chore: 🔀 merge\b/i.test(commit),
    (commit) => /^revert(?:\(|:)/.test(commit),
  ],
};
