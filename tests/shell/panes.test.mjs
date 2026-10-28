import assert from 'node:assert/strict';
import test from 'node:test';
import { careerGraph, nowItems, skillMeters } from '../../src/features/terminal/panes.ts';

const resume = {
  experience: [
    { id: 'old', company: 'Old Co', position: 'Engineer', startDate: '2018-10', endDate: '2025-10', technologies: ['Node.js'] },
    { id: 'new', company: 'New Co', position: 'Senior Engineer', startDate: '2025-10' },
  ],
  education: [{ id: 'edu', institution: 'College', degree: "Bachelor's", field: 'ECE', startDate: '2014-08', endDate: '2018-05' }],
  skills: [
    { category: 'Later', priority: 2, skills: [{ name: 'Node.js', level: 'expert', yearsOfExperience: 6 }, { name: 'Zig', level: 'beginner' }] },
    { category: 'First', priority: 1, skills: [{ name: 'Go', level: 'advanced', yearsOfExperience: 2 }] },
  ],
};

test('career graph is newest first, marks HEAD and the entry current on a focus date', () => {
  const graph = careerGraph(resume, new Date('2019-04-04'));
  assert.deepEqual(graph.map(c => [c.id, c.head, c.focused]), [
    ['new', true, false], ['old', false, true], ['edu', false, false],
  ]);
  assert.equal(graph[2].title, "Bachelor's in ECE");
  assert.equal(careerGraph(resume, new Date('2025-10-15')).find(c => c.focused).id, 'new');
});

test('skill meters prefer matching focus skills, else top levels, else all grouped by priority', () => {
  assert.deepEqual(skillMeters(resume, { focus: ['node.js', 'unknown'] }), [
    { category: 'Used here', meters: [{ name: 'Node.js', level: 'expert', percent: 100, years: 6 }] },
  ]);
  assert.deepEqual(skillMeters(resume, { focus: ['dev'], limit: 2 })[0].meters.map(m => m.name), ['Node.js', 'Go']);
  assert.deepEqual(skillMeters(resume, { all: true }).map(g => g.category), ['First', 'Later']);
  const byName = Object.fromEntries(skillMeters(resume, { all: true }).flatMap(g => g.meters).map(m => [m.name, m.percent]));
  assert.deepEqual(byName, { Go: 33, 'Node.js': 100, Zig: 25 });
});

test('now items skip placeholder entries and TODO text', () => {
  const body = '## Work\n\nBuilding HCP.\n\n## Reading\n\nTODO: a book.\n';
  assert.deepEqual(nowItems(body, false), [{ heading: 'Work', text: 'Building HCP.' }]);
  assert.deepEqual(nowItems(body, true), []);
});
