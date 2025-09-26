export function parseCSV(data) {
  const rows = data.split("\n").map(r => r.split(","));
  return rows;
}
