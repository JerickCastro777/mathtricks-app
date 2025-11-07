// extract-project-full.js  (versión mejorada - usa glob with cwd)
// Usage: node extract-project-full.js [project_root]
// Example: node extract-project-full.js .

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const arg = process.argv[2] || '.';
const projectRoot = path.resolve(arg);
const outFile = path.join(projectRoot, 'project_extraction.json');

console.log('PROJECT ROOT ->', projectRoot);
if (!fs.existsSync(projectRoot)) {
  console.error('ERROR: La carpeta indicada NO existe:', projectRoot);
  process.exit(1);
}

function safeParse(code, filePath) {
  try {
    return babelParser.parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx','classProperties','objectRestSpread','optionalChaining',
        'nullishCoalescingOperator','dynamicImport','decorators-legacy','typescript'
      ]
    });
  } catch (err) {
    console.warn(`[WARN] parse failed for ${filePath}: ${err.message}`);
    return null;
  }
}

function findFirebaseStrings(code) {
  const matches = [];
  const pathRegex = /(?:ref|get|set|update|onValue|push|child)\s*\(?\s*(['"`])([^'"`]+?)\1/gi;
  let m;
  while ((m = pathRegex.exec(code))) matches.push(m[2]);
  const keywords = ['signInWithEmailAndPassword','createUserWithEmailAndPassword','signOut','loginUser','registerUser','db','firebase','getDatabase','initializeApp','set','update','ref'];
  for (const kw of keywords) if (code.includes(kw)) matches.push(kw);
  return Array.from(new Set(matches));
}
function extractStringKeys(code) {
  const regex = /['"`]([a-zA-Z0-9_\/\{\}\-\:\$]+?)['"`]/g;
  const keys = new Set(); let m;
  while ((m = regex.exec(code))) {
    const s = m[1];
    if (s.length > 1 && s.length < 200) keys.add(s);
  }
  return Array.from(keys).slice(0,200);
}

function analyzeFile(fp, rel) {
  const content = fs.readFileSync(fp, 'utf8');
  const res = { path: rel, imports: [], exports: [], functions: [], variables: [], components: [], hooks: {useState:[],useContext:[],useEffect:[]}, objects: [], firebasePaths: [], stringKeys: [] };
  const ast = safeParse(content, fp);
  if (ast) {
    ast.program.body.forEach(node => {
      if (node.type === 'ImportDeclaration') {
        res.imports.push({ raw: content.slice(node.start,node.end), source: node.source.value, specifiers: node.specifiers.map(s => ({ type: s.type, local: s.local && s.local.name, imported: s.imported && s.imported.name || (s.type==='ImportDefaultSpecifier'?'default':null) })) });
      }
      if (node.type==='ExportNamedDeclaration' || node.type==='ExportDefaultDeclaration') {
        res.exports.push({ type: node.type==='ExportDefaultDeclaration'?'default':'named', raw: content.slice(node.start,node.end), declarationType: node.declaration && node.declaration.type });
      }
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        const n = path.node;
        res.functions.push({ name: n.id? n.id.name : '(anon)', params: n.params.map(p => p.type) });
      },
      VariableDeclaration(path) {
        path.node.declarations.forEach(d => {
          if (d.id && d.id.type === 'Identifier') {
            const v = { name: d.id.name, kind: path.node.kind };
            if (d.init && d.init.type === 'ArrowFunctionExpression') { v.isFunction=true; v.params = d.init.params.map(p => p.type); }
            else if (d.init && d.init.type === 'ObjectExpression') { v.isObject=true; v.objectKeys = d.init.properties.map(p => (p.key && (p.key.name||p.key.value)) || null).filter(Boolean); }
            res.variables.push(v);
          } else if (d.id && d.id.type === 'ArrayPattern') {
            const names = d.id.elements.map(e => e && e.name).filter(Boolean);
            if (d.init && d.init.type === 'CallExpression' && d.init.callee && d.init.callee.name) {
              const callName = d.init.callee.name;
              if (callName === 'useState') res.hooks.useState.push(...names);
              else if (callName === 'useContext') res.hooks.useContext.push(...names);
            }
            res.variables.push({ name: names.join(','), kind: 'destructured', initCall: d.init && d.init.callee && d.init.callee.name });
          }
        });
      },
      CallExpression(path) {
        const node = path.node;
        if (node.callee && node.callee.type === 'Identifier') {
          if (node.callee.name === 'useEffect') res.hooks.useEffect.push('useEffect');
          if (node.callee.name === 'useContext' && node.arguments && node.arguments[0]) res.hooks.useContext.push(node.arguments[0].name || 'context');
        }
        if (node.arguments && node.arguments[0] && node.arguments[0].type === 'StringLiteral') {
          const s = node.arguments[0].value;
          if (s.includes('/users') || s.includes('/questions') || s.includes('{uid}')) res.firebasePaths.push(s);
        }
        if (node.callee && node.callee.type === 'MemberExpression' && node.callee.property && node.callee.property.name) {
          res.variables.push({ invoked: node.callee.property.name });
        }
      },
      JSXElement(path) {
        const parentFn = path.getFunctionParent();
        if (parentFn && parentFn.node) res.components.push({ name: parentFn.node.id ? parentFn.node.id.name : parentFn.node.type, jsx: true });
        else { const parentVar = path.findParent(p => p.isVariableDeclarator && p.node && p.node.id && p.node.id.name); if (parentVar) res.components.push({ name: parentVar.node.id.name, jsx: true }); }
      },
      ObjectExpression(path) {
        const parent = path.parentPath && path.parentPath.node;
        const keys = path.node.properties.map(p => (p.key && (p.key.name || p.key.value)) || null).filter(Boolean);
        if (parent && parent.type === 'VariableDeclarator' && parent.id && parent.id.name) res.objects.push({ name: parent.id.name, keys });
        else if (keys.length) res.objects.push({ name: '(anon)', keys });
      }
    });
  }

  res.firebasePaths = Array.from(new Set(res.firebasePaths.concat(findFirebaseStrings(content))));
  res.stringKeys = extractStringKeys(content);
  return res;
}

// ---- find files using glob with cwd (fixed for Windows) ----
const patterns = ['**/*.js','**/*.jsx','**/*.ts','**/*.tsx'];
const ignore = ['**/node_modules/**','**/.git/**','**/dist/**','**/android/**','**/ios/**','.expo/**'];

let allFiles = [];
for (const p of patterns) {
  const found = glob.sync(p, { cwd: projectRoot, ignore, nodir:true });
  console.log(`pattern ${p} -> found ${found.length}`);
  allFiles = allFiles.concat(found);
}
allFiles = Array.from(new Set(allFiles)).sort();
console.log('TOTAL found files (after dedupe):', allFiles.length);

const output = { generatedAt: new Date().toISOString(), root: projectRoot, files: {} };

allFiles.forEach((rel) => {
  try {
    const abs = path.join(projectRoot, rel);
    const info = analyzeFile(abs, rel);
    output.files[rel] = info;
  } catch (err) {
    console.error('Error analyzing', rel, err && err.message);
  }
});

fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
console.log('WROTE:', outFile);
console.log('FILES IN JSON:', Object.keys(output.files).length);
if (Object.keys(output.files).length) console.log('Primeros archivos:', Object.keys(output.files).slice(0,10));
