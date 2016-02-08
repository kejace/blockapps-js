function extendType(x, y) {
    var pType = Object.getPrototypeOf(x);
    var yProps = getDescriptors(y);
    var qType = Object.create(pType, yProps);
    var xProps = getDescriptors(x);
    return Object.create(qType, xProps);    
}

function getDescriptors(x) {
    return Object.getOwnPropertyNames(x).
        map(Object.getOwnPropertyDescriptor.bind(null, x));
}

module.exports = extendType;
