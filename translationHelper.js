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

// Parse source and destination locale js files
const sourceTree = recast.parse(readFile(sourceFiles[0])).program.body[0];
const destinationTree = recast.parse(readFile(sourceFiles[1])).program.body[0];

// Keep original comments
sourceTree.comments = destinationTree.comments;

// Keep left side of the assignment, thus preserving the language key
sourceTree.expression.left = destinationTree.expression.left;

// Search for missing strings by traversing the destination tree to reach the
// keys in the dictionary.
// The body of the program has a single assignment expression, where the right
// side of the expression is the dictionary. We can then traverse the properties
// of that dictionary and ask for the content (value, in AST terms) of each key.
sourceTree.expression.right.properties.forEach(
    (each) => {
        let sourceString = each.key.value,
            destinationProperty =
                destinationTree.expression.right.properties.find(
                    (association) => {
                        return association.key.value == each.key.value
                    }
                );
        if (destinationProperty) {
            each.value = destinationProperty.value;
        } else {
            each.value.value = '';
        }
    }
);

// Now export the modified AST into a new file
fs.writeFileSync(
    'lang-' + destinationLang + '-editme.js',
    recast.print(sourceTree, { quote: 'single' }).code
);
