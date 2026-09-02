import { readFileSync } from "node:fs";

const STATUS_ALIASES = new Map([
  ["portable", "portable"],
  ["portable unchanged", "portable"],
  ["adapted", "adapted"],
  ["wording edit", "adapted"],
  ["unsupported", "unsupported"],
]);

export const PORTABILITY_STATUSES = ["portable", "adapted", "unsupported"];

function splitRow(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().replace(/`/g, ""));
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function describeColumn(columnName, columnIndex) {
  return columnName === null ? `column ${columnIndex + 1}` : `${columnName} column`;
}

/**
 * The single portability parser shared by the generator and the validator.
 *
 * `column` selects the classification cell by header name. When it is a number
 * the cell is taken positionally; the default of 1 is the second column, which
 * is where today's single-target table keeps its classification.
 */
export function parsePortability(text, { column = 1 } = {}) {
  const columnName = typeof column === "string" ? column : null;
  const positionalIndex = typeof column === "number" ? column : 1;
  const lines = text.split("\n");
  const records = new Map();
  const issues = [];
  let tableFound = false;
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim().startsWith("|")) {
      index += 1;
      continue;
    }
    const start = index;
    let end = index;
    while (end < lines.length && lines[end].trim().startsWith("|")) end += 1;
    index = end;
    if (end - start < 3) continue;
    if (!isSeparatorRow(splitRow(lines[start + 1]))) continue;

    const header = splitRow(lines[start]);
    let columnIndex = positionalIndex;
    if (columnName !== null) {
      columnIndex = header.findIndex(
        (cell) => cell.toLowerCase() === columnName.toLowerCase(),
      );
      if (columnIndex === -1) continue;
    }
    tableFound = true;

    for (let row = start + 2; row < end; row += 1) {
      const cells = splitRow(lines[row]);
      const skill = cells[0];
      if (skill === undefined || skill === "") continue;
      const cell = cells[columnIndex];
      if (cell === undefined) {
        issues.push({
          line: row + 1,
          message: `portability row for ${skill} has no ${describeColumn(columnName, columnIndex)}`,
        });
        continue;
      }
      const status = STATUS_ALIASES.get(cell.toLowerCase());
      if (status === undefined) {
        issues.push({
          line: row + 1,
          message: `unrecognized portability classification ${JSON.stringify(cell)} for ${skill}; expected one of ${PORTABILITY_STATUSES.join(", ")}`,
        });
        continue;
      }
      if (records.has(skill)) {
        issues.push({ line: row + 1, message: `duplicate portability row for ${skill}` });
      }
      records.set(skill, status);
    }
  }

  if (!tableFound) {
    issues.push({
      line: 1,
      message: `portability record has no table with a ${describeColumn(columnName, positionalIndex)}`,
    });
  }
  return { records, issues };
}

export function readPortability(path, options) {
  return parsePortability(readFileSync(path, "utf8"), options);
}
