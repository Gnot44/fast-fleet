const fs = require('fs');
const styleGuide = JSON.parse(fs.readFileSync('C:/Users/kosit.g/.agents/skills/stitch-react-components/resources/style-guide.json', 'utf8'));
let css = '\n@theme {\n';
for (const [key, val] of Object.entries(styleGuide.theme.colors || {})) {
  css += `  --color-${key}: ${val};\n`;
}
for (const [key, val] of Object.entries(styleGuide.theme.fontFamily || {})) {
  css += `  --font-${key}: '${val[0]}';\n`;
}
for (const [key, val] of Object.entries(styleGuide.theme.spacing || {})) {
  css += `  --spacing-${key}: ${val};\n`;
}
css += '}\n';
fs.appendFileSync('src/index.css', css);
console.log('Appended to index.css');
