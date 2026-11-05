const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'server/providers/jamendo.cjs'), 'utf8');
// Use the existing jamendo.cjs file that was already created
if (content && content.length > 0) {
  console.log('Jamendo provider already exists, length:', content.length);
} else {
  console.log('Jamendo provider file is empty');
}

// Also check if we need to create it from the template
const templatePath = path.join(__dirname, 'server/providers/templates/jamendo.cjs');
if (fs.existsSync(templatePath)) {
  const template = fs.readFileSync(templatePath, 'utf8');
  fs.writeFileSync(path.join(__dirname, 'server/providers/jamendo.cjs'), template);
  console.log('Copied from template');
} else {
  console.log('No template found');
}
