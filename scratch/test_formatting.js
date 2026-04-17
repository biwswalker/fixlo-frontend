/**
 * TEST SCRIPT for formatAccountName logic
 * This logic matches src/actions/dashboard.ts
 */

function formatAccountName(webAcc) {
  const trimmed = webAcc.trim();
  
  // Pattern 1: Pipe (ID | Name) -> Name (ID)
  if (trimmed.includes('|')) {
    const [id, name] = trimmed.split('|').map(s => s.trim());
    return name ? `${name} (${id})` : id;
  }

  // Pattern 3: Numeric only -> Default Bank (Account)
  if (/^\d+$/.test(trimmed)) {
    return `ธนาคารไทยพาณิชย์ (${trimmed})`;
  }

  // Pattern 2: Combined (DigitsText) -> Text (Digits)
  const combinedMatch = trimmed.match(/^(\d+)(.+)$/);
  if (combinedMatch) {
    const [, id, name] = combinedMatch;
    return `${name.trim()} (${id.trim()})`;
  }

  return trimmed;
}

const testCases = [
  { input: "0832343197 | ทรูวอลเลต", expected: "ทรูวอลเลต (0832343197)" },
  { input: "4291650387ธนาคารไทยพาณิชย์", expected: "ธนาคารไทยพาณิชย์ (4291650387)" },
  { input: "4291650387", expected: "ธนาคารไทยพาณิชย์ (4291650387)" },
  { input: "Other | Name", expected: "Name (Other)" },
  { input: "OnlyText", expected: "OnlyText" },
];

console.log("--- STARTING TESTS ---");
testCases.forEach((tc, i) => {
  const result = formatAccountName(tc.input);
  const passed = result === tc.expected;
  console.log(`Test ${i + 1}: ${passed ? "✅" : "❌"} | Input: "${tc.input}" | Got: "${result}" | Expected: "${tc.expected}"`);
});

/**
 * Aggregation logic test
 */
function aggregateBreakdown(rows) {
  const map = new Map();
  
  rows.forEach(row => {
    const rawAccount = row.account || 'Unknown';
    const formattedName = formatAccountName(rawAccount);
    const amount = Number(row.total || 0);
    
    map.set(formattedName, (map.get(formattedName) || 0) + amount);
  });

  return Array.from(map.entries())
    .map(([account, total]) => ({ account, total }))
    .sort((a, b) => b.total - a.total);
}

const mockRows = [
  { account: "4291650387", total: 100 },
  { account: "4291650387ธนาคารไทยพาณิชย์", total: 200 },
  { account: "0832343197 | ทรูวอลเลต", total: 50 },
];

console.log("\n--- AGGREGATION TEST ---");
const aggregated = aggregateBreakdown(mockRows);
console.log(JSON.stringify(aggregated, null, 2));

const scbTotal = aggregated.find(a => a.account.includes("4291650387"))?.total;
if (scbTotal === 300) {
  console.log("✅ Aggregation Logic Passed (100 + 200 = 300)");
} else {
  console.log(`❌ Aggregation Logic Failed (Expected 300, got ${scbTotal})`);
}
