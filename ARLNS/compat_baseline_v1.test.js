const assert = require('node:assert/strict');

const { tokenize } = require('../src/tokenizer_v1');
const { parse } = require('../src/parser_v1');
const { validateTokens } = require('../src/validator');
const { validateText } = require('../src/pipeline_v1');

function run() {
  // 1) Tokenizer baseline for a mixed notation line.
  const mixedLine = 'MY e_mo_tions {b} run_ning ^^so alone^^ but ^still^ STRONG***';
  const mixedTokens = tokenize(mixedLine);

  assert.deepStrictEqual(
    mixedTokens.map((t) => t.type),
    [
      'WORD', 'WORD', 'SYLLABLE_SPLIT', 'WORD', 'SYLLABLE_SPLIT', 'WORD',
      'BREATH', 'WORD', 'SYLLABLE_SPLIT', 'WORD', 'SOFT_MODE_TOGGLE',
      'WORD', 'WORD', 'SOFT_MODE_TOGGLE', 'WORD', 'SOFT_HIGH_TOGGLE',
      'WORD', 'SOFT_HIGH_TOGGLE', 'WORD', 'PHRASE_BREAK'
    ],
    'Tokenizer token type sequence changed for mixed notation line.'
  );

  // 2) Parser baseline for section handling and current dynamic mapping behavior.
  const sectionText = ['[Verse 1]', 'I LOVE you***', '^^so alone^^ but ^still^ STRONG'].join('\n');
  const doc = parse(sectionText);

  assert.equal(doc.type, 'DOCUMENT');
  assert.equal(doc.sections.length, 1, 'Parser section count changed.');
  assert.equal(doc.sections[0].name, 'Verse 1', 'Parser section name changed.');
  assert.equal(doc.sections[0].lines.length, 2, 'Parser line count in section changed.');

  const line1Dyn = doc.sections[0].lines[0].tokens
    .filter((t) => t.type === 'WORD')
    .map((t) => `${t.text}:${t.dynamic}`);
  const line2Dyn = doc.sections[0].lines[1].tokens
    .filter((t) => t.type === 'WORD')
    .map((t) => `${t.text}:${t.dynamic}`);

  assert.deepStrictEqual(
    line1Dyn,
    ['I:LOUD', 'LOVE:LOUD', 'you:NORMAL'],
    'Parser dynamic mapping changed on baseline line 1.'
  );

  assert.deepStrictEqual(
    line2Dyn,
    ['so:NORMAL', 'alone:NORMAL', 'but:NORMAL', 'still:NORMAL', 'STRONG:LOUD'],
    'Parser dynamic mapping changed on baseline line 2.'
  );

  // 3) Validator baseline on raw tokenizer output.
  const validatorReport = validateTokens(mixedTokens);
  assert.equal(validatorReport.ok, true, 'Validator baseline ok state changed.');
  assert.deepStrictEqual(validatorReport.errors, [], 'Validator baseline errors changed.');
  assert.deepStrictEqual(validatorReport.warnings, [], 'Validator baseline warnings changed.');

  // 4) Pipeline baseline for end-to-end validation.
  const pipelineReport = validateText(sectionText);
  assert.equal(pipelineReport.ok, true, 'Pipeline baseline ok state changed.');
  assert.deepStrictEqual(
    pipelineReport.errors.map((e) => e.code),
    [],
    'Pipeline baseline error codes changed.'
  );
  assert.deepStrictEqual(
    pipelineReport.warnings.map((w) => w.code),
    [],
    'Pipeline baseline warning codes changed.'
  );

  console.log('compat-baseline: PASS');
}

run();
