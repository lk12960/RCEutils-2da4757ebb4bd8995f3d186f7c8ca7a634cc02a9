const fs = require('fs');
const path = require('path');

const commandsPath = path.join(__dirname, 'commands'); // adjust if needed

function checkOptionsOrder(commandFile) {
  try {
    const command = require(commandFile);
    if (!command.data || typeof command.data.toJSON !== 'function') return;

    const json = command.data.toJSON();

    if (!json.options) return; // no options to check

    let foundOptional = false;
    for (const option of json.options) {
      if (option.required === false) {
        foundOptional = true;
      } else if (option.required === true && foundOptional) {
        // Required after optional → problem!
        return `❌ ${path.basename(commandFile)} has required option '${option.name}' after optional ones`;
      }
    }
  } catch (err) {
    return `⚠️ Failed to parse ${path.basename(commandFile)}: ${err.message}`;
  }
  return null; // no problem
}

function walk(dir) {
  let problems = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      problems = problems.concat(walk(fullPath));
    } else if (file.endsWith('.js')) {
      const problem = checkOptionsOrder(fullPath);
      if (problem) problems.push(problem);
    }
  }
  return problems;
}

const results = walk(commandsPath);

if (results.length === 0) {
  console.log('✅ All commands have required options before optional ones!');
} else {
  console.log(results.join('\n'));
}
