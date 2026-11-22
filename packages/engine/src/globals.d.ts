// Available in every runtime EyeSpy targets (browsers, web views, Node 17+),
// but not part of the ES2022 lib the engine compiles against.
declare function structuredClone<T>(value: T): T;
