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

function findProperty (props, key) {
    return props.find(
        (association) => { return association.key.value === key; }
    );
};

// Parse source and destination locale js files.
sourceTree = recast.parse(readFile(sourceFiles[0])).program.body[0];
destinationTree = recast.parse(readFile(sourceFiles[1])).program.body[0];

// Make references to dictionary properties.
// The body of the program has a single assignment expression, where the right
// side of the expression is the dictionary.
sourceProperties = sourceTree.expression.right.properties;
destinationProperties = destinationTree.expression.right.properties;

// Keep original comments.
sourceTree.comments = destinationTree.comments;

// Keep left side of the assignment, thus preserving the language key.
sourceTree.expression.left = destinationTree.expression.left;

// Search for missing strings by traversing the destination tree to reach the
// keys in the dictionary.
// We now traverse the properties of the dictionary and ask for the content
// (value, in AST terms) of each key.
sourceProperties.forEach(
    (eachProperty) => {
        let destinationProperty =
                findProperty(destinationProperties, eachProperty.key.value);
        if (destinationProperty) {
            eachProperty.value = destinationProperty.value;
        } else {
            eachProperty.value = recast.types.builders.literal('');
        }
    }
);

// Here comes the fun part. Search for strings that were in the destination file
// but not in the source one.
destinationProperties.forEach(
    (eachProperty, index) => {
        let sourceProperty =
                findProperty(sourceProperties, eachProperty.key.value);
        if (!sourceProperty) {
            // We found a string that existed in the destination language and
            // has been steamrolled by the translation update.
            // Just add the missing property at the end.
            sourceProperties.push(eachProperty);

            /*
            // EXPERIMENTAL:
            // Instead of attaching the missing property at the end, look for
            // the first common key after the missing one and shove it there.
            // This kind of works, but it often places missing strings in
            // meaningless places.
            for (let i = index; i < destinationProperties.length; i++) {
                let key = destinationProperties[i].key.value,
                    firstCommonProp = findProperty(sourceProperties, key);
                if (firstCommonProp) {
                    // Found the first common property. Let's find its index in
                    // the source properties
                    let insertionIndex =
                            sourceProperties.indexOf(firstCommonProp);
                    // And insert the missing property right there.
                    //sourceProperties.splice(insertionIndex, 0, eachProperty);
                    break;
                }
            }
            */
        }
    }
);

// Now export the modified AST into a new file
fs.writeFileSync(
    'lang-' + destinationLang + '-editme.js',
    recast.print(sourceTree, { quote: 'single' }).code
);
