// test_v1.js
const { tokenize } = require("../src/tokenizer_v1");
const { validateTokens } = require("../src/validator");
const { validateBars } = require("../src/bars_validator");
const { renderText, validateText } = require("../src/pipeline_v1");

// Test cases
const testCases = [
  {
    name: "Mixed dynamics with phrase break",
    line: "MY e_mo_tions {b} run_ning ^^so alone^^ but ^still^ STRONG***"
  },
  {
    name: "Single word soft phrase (should error)",
    line: "I feel ^^good^^ today"
  },
  {
    name: "Normal with soft high",
    line: "I feel ^good^ today"
  },
  {
    name: "Consecutive soft high (should warn)",
    line: "I ^feel^ ^so^ good"
  },
  {
    name: "Unclosed soft marker (should warn)",
    line: "I feel ^^so good"
  },
  {
    name: "Section tag",
    line: "[Verse 1]"
  },
  {
    name: "Drop section",
    line: "[Drop]"
  },
  {
    name: "Post-Chorus section",
    line: "[Post-Chorus]"
  },
  {
    name: "Refrain section",
    line: "[Refrain]"
  },
  {
    name: "Section tag with lyrics on same line",
    line: "[Chorus] I LOVE you"
  },
  {
    name: "PEM markers - elongate and compress",
    line: "I love~> you>> so much"
  },
  {
    name: "PEM markers - spill and cut",
    line: "hold~| this momentx forever"
  },
  {
    name: "Multiple PEM markers on one word",
    line: "stay~>> with me"
  },
  {
    name: "LOUD word with PEM marker",
    line: "I LOVE~> you"
  },
  {
    name: "DYN markers - soften, push, breathy, emphasis",
    line: "whisper< loud> breathy~ shout!"
  },
  {
    name: "Bars tags - full 8 bars",
    line: "||B:8|| we go on and on"
  },
  {
    name: "Bars tags - 1 bar single word",
    line: "||B:1|| go"
  },
  {
    name: "Bars tags - 1 bar fade/space",
    line: "B1FS"
  },
  {
    name: "Rest tokens with durations",
    line: "R:q R:e R:h"
  },
  {
    name: "Texture tokens with vocal timbres",
    line: "I feel T:raspy and T:airy"
  }
];

console.log("=== ARLNS Tokenizer Tests ===\n");

testCases.forEach(({ name, line }) => {
  console.log(`\n--- ${name} ---`);
  console.log(`Input: "${line}"\n`);
  
  const tokens = tokenize(line);
  const report = validateTokens(tokens);
  const barsReport = validateBars(tokens);
  
  console.log("Tokens:");
  tokens.forEach((token, i) => {
    if (token.type === "WORD") {
      console.log(`  [${i}] ${token.text} (${token.dynamic})`);
    } else if (token.type === "BREATH") {
      console.log(`  [${i}] BREATH (${token.size})`);
    } else if (token.type === "SECTION_TAG") {
      console.log(`  [${i}] SECTION_TAG: ${token.text}`);
    } else if (token.type === "PEM") {
      console.log(`  [${i}] PEM: ${token.kind}`);
    } else if (token.type === "DYN") {
      console.log(`  [${i}] DYN: ${token.kind}`);
    } else if (token.type === "BARS_FS") {
      console.log(`  [${i}] BARS_FS (${token.kind})`);
    } else if (token.type === "REST") {
      console.log(`  [${i}] REST (${token.duration})`);
    } else if (token.type === "TEXTURE") {
      console.log(`  [${i}] TEXTURE (${token.kind})`);
    } else {
      console.log(`  [${i}] ${token.type}`);
    }
  });
  
  console.log(`\nValidation: ${report.ok ? "✓ PASS" : "✗ FAIL"}`);
  
  if (report.errors.length > 0) {
    console.log("\nErrors:");
    report.errors.forEach(err => {
      console.log(`  - ${err.message} (index: ${err.index})`);
    });
  }
  
  if (report.warnings.length > 0) {
    console.log("\nWarnings:");
    report.warnings.forEach(warn => {
      console.log(`  - ${warn.message} (index: ${warn.index})`);
    });
  }

  const hasBarsHint = /B\s*:\s*\d+|B1FS/i.test(line);
  if (hasBarsHint || barsReport.errors.length > 0 || barsReport.warnings.length > 0) {
    const barsOk = barsReport.errors.length === 0;
    console.log(`\nBars Validation: ${barsOk ? "✓ PASS" : "✗ FAIL"}`);

    if (barsReport.errors.length > 0) {
      console.log("\nBars Errors:");
      barsReport.errors.forEach(err => {
        console.log(`  - ${err.message} (index: ${err.index})`);
      });
    }

    if (barsReport.warnings.length > 0) {
      console.log("\nBars Warnings:");
      barsReport.warnings.forEach(warn => {
        console.log(`  - ${warn.message} (index: ${warn.index})`);
      });
    }
  }
});

console.log("\n=== End Tests ===");

console.log("\n=== Pipeline Demo ===\n");

const demoText = [
  "[Verse]",
  "||B:8|| we go on and on",
  "B1FS",
  "I love~> you>> so much***"
].join("\n");

const demoReport = validateText(demoText);
console.log(`Validation: ${demoReport.ok ? "✓ PASS" : "✗ FAIL"}`);

console.log("\nRender (shorthand):");
console.log(renderText(demoText, { view: "shorthand" }));

console.log("\nRender (clean):");
console.log(renderText(demoText, { view: "clean" }));

console.log("\nRender (debug):");
console.log(renderText(demoText, { view: "debug" }));