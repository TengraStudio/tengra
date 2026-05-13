const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SERVICE_ROOT = path.join(process.cwd(), 'src', 'main', 'services');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function isExported(node) {
  return Boolean(node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword));
}

function isAbstract(node) {
  return Boolean(node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AbstractKeyword));
}

function lowerCamel(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function getConstructorDependencies(classNode, sourceFile) {
  const ctor = classNode.members.find(member => ts.isConstructorDeclaration(member));
  if (!ctor) {
    return [];
  }

  return ctor.parameters
    .map(param => {
      if (ts.isIdentifier(param.name)) {
        return param.name.text;
      }
      if (ts.isObjectBindingPattern(param.name) || ts.isArrayBindingPattern(param.name)) {
        return param.name.getText(sourceFile);
      }
      return null;
    })
    .filter(Boolean);
}

function hasStaticMetadata(classNode) {
  return classNode.members.some(member => {
    if (!ts.isPropertyDeclaration(member) || !member.modifiers) {
      return false;
    }
    const hasStatic = member.modifiers.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
    if (!hasStatic || !member.name || !ts.isIdentifier(member.name)) {
      return false;
    }
    return member.name.text === 'serviceName' || member.name.text === 'dependencies';
  });
}

function addMetadataToFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const insertions = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement) || !statement.name) {
      continue;
    }
    if (!isExported(statement) || isAbstract(statement)) {
      continue;
    }
    if (!statement.name.text.endsWith('Service')) {
      continue;
    }
    if (hasStaticMetadata(statement)) {
      continue;
    }

    const className = statement.name.text;
    const serviceName = lowerCamel(className);
    const dependencies = getConstructorDependencies(statement, sourceFile);
    const braceIndex = original.indexOf('{', statement.getStart(sourceFile));
    if (braceIndex < 0) {
      continue;
    }

    const afterBrace = original.slice(braceIndex + 1);
    const newlineMatch = afterBrace.match(/^(\r?\n)/);
    const insertPos = braceIndex + 1 + (newlineMatch ? newlineMatch[0].length : 0);
    const metadata = [
      `    static readonly serviceName = '${serviceName}';`,
      `    static readonly dependencies = [${dependencies.map(dep => `'${dep}'`).join(', ')}] as const;`,
      '',
    ].join('\n');

    insertions.push({ start: insertPos, end: insertPos, text: metadata });
  }

  if (insertions.length === 0) {
    return false;
  }

  let updated = original;
  for (const insertion of insertions.sort((a, b) => b.start - a.start)) {
    updated = `${updated.slice(0, insertion.start)}${insertion.text}${updated.slice(insertion.end)}`;
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  return false;
}

const files = walk(SERVICE_ROOT);
let changed = 0;

for (const file of files) {
  if (addMetadataToFile(file)) {
    changed += 1;
  }
}

console.log(`Updated ${changed} service files.`);
