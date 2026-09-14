// Icons are irrelevant to behaviour tests; every named export renders nothing.
const Icon = () => null;
module.exports = new Proxy({ __esModule: true, default: Icon }, { get: (target, prop) => (prop in target ? target[prop] : Icon) });
