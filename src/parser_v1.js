// parser_v1.js
// Lyric Performance Control – v1 Parser
// Takes tokens from tokenizer and builds structured output

const { tokenize } = require('./tokenizer_v1');
const { parseSectionHeader } = require('./metadata_parser_v1');

function parse(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;
  let softMode = false;
  let softHighMode = false;
  
  for (const line of lines) {
    if (!line.trim()) continue;

    // Check for section header (with or without metadata) before tokenizing
    const sectionHeader = parseSectionHeader(line.trim());
    if (sectionHeader.isSection) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        type: 'SECTION',
        name: sectionHeader.name,
        metadata: sectionHeader.metadata,
        metaErrors: sectionHeader.errors,
        lines: []
      };
      continue;
    }
    
    const rawTokens = tokenize(line);
    
    // Process tokens and apply state-based transformations
    const tokens = processTokensWithState(rawTokens, { softMode, softHighMode });
    
    // Update state based on mode markers
    for (const token of rawTokens) {
      if (token.type === 'SOFT_MODE_TOGGLE') {
        softMode = !softMode;
      }
      if (token.type === 'SOFT_HIGH_TOGGLE') {
        softHighMode = !softHighMode;
      }
    }
    
    // Add line to current section
    const lineData = {
      type: 'LINE',
      tokens: tokens,
      phrases: groupIntoPhrases(tokens)
    };
      
    if (currentSection) {
      currentSection.lines.push(lineData);
    } else {
      // No section yet, create a default one
      if (sections.length === 0 || sections[sections.length - 1].name !== 'DEFAULT') {
        sections.push({
          type: 'SECTION',
          name: 'DEFAULT',
          lines: []
        });
      }
      sections[sections.length - 1].lines.push(lineData);
    }
  }
  
  // Add final section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return {
    type: 'DOCUMENT',
    sections: sections
  };
}

function processTokensWithState(tokens, state) {
  const processed = [];
  
  for (const token of tokens) {
    if (token.type === 'WORD') {
      // Determine dynamic based on state and word format
      let dynamic = 'NORMAL';
      
      // ALL CAPS = LOUD
      if (/^[A-Z]+$/.test(token.text)) {
        dynamic = 'LOUD';
      } else if (state.softHighMode) {
        dynamic = 'SOFT_HIGH';
      } else if (state.softMode) {
        dynamic = 'SOFT';
      }
      
      processed.push({
        ...token,
        dynamic
      });
    } else {
      processed.push(token);
    }
  }
  
  return processed;
}

function groupIntoPhrases(tokens) {
  const phrases = [];
  let currentPhrase = [];
  
  for (const token of tokens) {
    if (token.type === 'PHRASE_BREAK') {
      if (currentPhrase.length > 0) {
        phrases.push({
          type: 'PHRASE',
          tokens: currentPhrase
        });
        currentPhrase = [];
      }
    } else {
      currentPhrase.push(token);
    }
  }
  
  // Add final phrase
  if (currentPhrase.length > 0) {
    phrases.push({
      type: 'PHRASE',
      tokens: currentPhrase
    });
  }
  
  return phrases;
}

function parseToAIFormat(text) {
  const doc = parse(text);
  const output = [];
  
  for (const section of doc.sections) {
    if (section.name !== 'DEFAULT') {
      output.push(`[${section.name}]`);
    }
    
    for (const line of section.lines) {
      const lineText = formatLineForAI(line);
      if (lineText) {
        output.push(lineText);
      }
    }
    
    output.push(''); // Blank line after section
  }
  
  return output.join('\n');
}

function formatLineForAI(line) {
  const parts = [];
  
  for (const token of line.tokens) {
    switch (token.type) {
      case 'WORD':
        let word = token.text;
        // Apply dynamic formatting
        if (token.dynamic === 'LOUD') {
          word = word.toUpperCase();
        } else if (token.dynamic === 'SOFT') {
          word = `^^${word}`;
        } else if (token.dynamic === 'SOFT_HIGH') {
          word = `^${word}^`;
        }
        parts.push(word);
        break;
        
      case 'BREATH':
        parts.push(token.size === 'large' ? '{B}' : '{b}');
        break;
        
      case 'PEM':
        const pemMap = {
          'ELONGATE': '~>',
          'COMPRESS': '>>',
          'SPILL': '~|',
          'CUT': 'x'
        };
        parts.push(pemMap[token.kind] || '');
        break;
        
      case 'DYN':
        const dynMap = {
          'SOFTEN': '<',
          'PUSH': '>',
          'BREATHY': '~',
          'EMPHASIS': '!'
        };
        parts.push(dynMap[token.kind] || '');
        break;
        
      case 'PHRASE_BREAK':
        parts.push('***');
        break;
        
      case 'SYLLABLE_SPLIT':
        parts.push('_');
        break;
        
      case 'CADENCE':
        const cadenceMap = {
          'FALL':        '\\',
          'FALL_STRONG': '\\\\',
          'FALL_TRAIL':  '\\~',
          'RISE':        '/',
          'RISE_STRONG': '//',
          'RISE_TRAIL':  '/~'
        };
        parts.push(cadenceMap[token.kind] || '');
        break;

      case 'CHAR':
        parts.push(token.text);
        break;

      case 'REST':
        parts.push(`R:${token.duration}`);
        break;

      case 'TEXTURE':
        parts.push(`T:${token.kind}`);
        break;
    }
  }
  
  return parts.join(' ').trim();
}

module.exports = {
  parse,
  parseToAIFormat,
  groupIntoPhrases
};
