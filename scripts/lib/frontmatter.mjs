/**
 * Parse the top-level YAML frontmatter of a skill or agent file.
 *
 * Returns the collected key/value map plus the structural problems found, so
 * the caller decides whether they are validation errors or hard failures.
 */
export function parseFrontmatter(text, { requiredKeys = ["name", "description"] } = {}) {
  const issues = [];
  const lines = text.split("\n");
  if (lines[0] !== "---") {
    issues.push({ line: 1, message: "SKILL.md must start with YAML frontmatter" });
    return { values: null, issues };
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    issues.push({ line: 1, message: "SKILL.md frontmatter is missing its closing --- delimiter" });
    return { values: null, issues };
  }
  const values = new Map();
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (match === null) {
      issues.push({ line: index + 1, message: "invalid top-level YAML frontmatter entry" });
      continue;
    }
    const [, key, rawValue = ""] = match;
    if (values.has(key)) {
      issues.push({ line: index + 1, message: `duplicate frontmatter key ${key}` });
    }
    values.set(key, rawValue.trim().replace(/^(['"])(.*)\1$/, "$2"));
  }
  for (const key of requiredKeys) {
    const value = values.get(key);
    if (value === undefined || value === "" || /^[>|]-?$/.test(value)) {
      const keyLine = lines.findIndex((line) => line.startsWith(`${key}:`)) + 1 || 1;
      const hasBlockValue =
        value !== undefined &&
        /^[>|]-?$/.test(value) &&
        lines.slice(keyLine, end).some((line) => /^\s+\S/.test(line));
      if (!hasBlockValue) {
        issues.push({ line: keyLine, message: `frontmatter ${key} must be non-empty` });
      }
    }
  }
  return { values, issues };
}
