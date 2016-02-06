function extendType(x, y) {
    var pType = Object.getPrototypeOf(x);
    var yProps = getDescriptors(y);
    var qType = Object.create(ptype, yProps);
    var xProps = getDescriptors(x);
    return Object.create(qtype, xProps);    
}

function getDescriptors(x) {
    return Object.getOwnPropertyNames(x).
        map(Object.getOwnPropertyDescriptor.bind(null, x));
}

module.exports = extendType;
