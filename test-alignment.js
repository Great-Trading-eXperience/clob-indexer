// Test script to verify exact character counts
const width = 78;

// Test different lines to see exact lengths
const lines = [
  "Client Status",
  "ID │ Status │ Messages │ Subs │ Type │ Last Activity",
  "Recent Messages (Last 5)",
  "No messages received yet...",
];

lines.forEach(line => {
  const paddingNeeded = width - line.length;
  const fullLine = `│ ${line}${' '.repeat(paddingNeeded)} │`;
  console.log(`"${line}" = ${line.length} chars, padding: ${paddingNeeded}, total: ${fullLine.length}`);
  console.log(fullLine);
  console.log('─'.repeat(80));
});

// Test the exact border
console.log('├' + '─'.repeat(78) + '┤');
console.log('└' + '─'.repeat(78) + '┘');