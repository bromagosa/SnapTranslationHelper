const fs = require('fs'),
    args = process.argv.slice(2),
    sourceFiles = args.filter((arg) => { return !arg.startsWith('--'); }),
    recast = require('recast'),
    langs =
        sourceFiles.map(
            (each) => { return each.substr(each.lastIndexOf('/') + 6, 2); }
        ),
    sourceLang = langs[0],
    destinationLang = langs[1],
    SnapTranslator = { dict: {} };

function readFile (fileName) {
    return fs.readFileSync(__dirname + '/' + fileName, { encoding: 'utf-8' });
}

// Parse and load source locale js file
const source = readFile(sourceFiles[0]);
eval(source);
const tree = recast.parse(source);

// Just load destination locale js file
eval(readFile(sourceFiles[1]));

// Search for missing strings by traversing the destination tree to reach the
// keys in the dictionary. This works because we know how lang files are
// structured.
// The body of the program has a single assignment expression, where the right
// side of the expression is the dictionary. We can then traverse the properties
// of that dictionary and ask for the content (value, in AST terms) of each key.
tree.program.body[0].expression.right.properties.forEach(
    (each) => {
        let sourceString = each.key.value,
            translation = SnapTranslator.dict[destinationLang][sourceString];
        each.value.value = translation || ('MISSING: ' + each.key.value);
    }
);

// Now export the modified AST into a new file
fs.writeFileSync(
    'lang-' + destinationLang + '-editme.js',
    recast.print(tree).code
);
