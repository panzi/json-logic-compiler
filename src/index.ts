// RulesLogic type definition copied from @types/json-logic-js
// See: https://www.npmjs.com/package/@types/json-logic-js
// and: https://github.com/DefinitelyTyped/DefinitelyTyped
export type RulesLogic =
    | boolean
    | string
    | number
    | null
    | undefined
    | RulesLogic[]

    // AccessingData
    | { var: RulesLogic | [RulesLogic] | [RulesLogic, any] | [RulesLogic, any] }
    | { missing: RulesLogic | any[] }
    | { missing_some: [RulesLogic, RulesLogic | any[]] }

    // LogicBooleanOperations
    | { if: [any, any, any, ...any[]] }
    | { '==': [any, any] }
    | { '===': [any, any] }
    | { '!=': [any, any] }
    | { '!==': [any, any] }
    | { '!': any }
    | { '!!': any }
    | { or: RulesLogic[] }
    | { and: RulesLogic[] }

    // NumericOperations
    | { '>': [RulesLogic, RulesLogic] }
    | { '>=': [RulesLogic, RulesLogic] }
    | { '<': [RulesLogic, RulesLogic] | [RulesLogic, RulesLogic, RulesLogic] }
    | { '<=': [RulesLogic, RulesLogic] | [RulesLogic, RulesLogic, RulesLogic] }
    | { max: RulesLogic[] }
    | { min: RulesLogic[] }
    | { '+': RulesLogic[] | RulesLogic }
    | { '-': RulesLogic[] | RulesLogic }
    | { '*': RulesLogic[] | RulesLogic }
    | { '/': RulesLogic[] | RulesLogic }
    | { '%': [RulesLogic, RulesLogic] }

    // ArrayOperations
    | { map: [RulesLogic, RulesLogic] }
    | { filter: [RulesLogic, RulesLogic] }
    | { reduce: [RulesLogic, RulesLogic, RulesLogic] }
    | { all: [RulesLogic[], RulesLogic] | [RulesLogic, RulesLogic] }
    | { none: [RulesLogic[], RulesLogic] | [RulesLogic, RulesLogic] }
    | { some: [RulesLogic[], RulesLogic] | [RulesLogic, RulesLogic] }
    | { merge: Array<RulesLogic[] | RulesLogic> }
    | { in: [RulesLogic, RulesLogic[]] }

    // StringOperations
    | { in: [RulesLogic, RulesLogic] }
    | { cat: RulesLogic[] }
    | { substr: [RulesLogic, RulesLogic] | [RulesLogic, RulesLogic, RulesLogic] }

    // MiscOperations
    | { log: RulesLogic };


export interface Operations {
    [name: string]: (...args: any[]) => any
}

export interface Options {
    operations?: Operations;
}

function isSafeIndex(value: string): boolean {
    return /^[0-9]+$/.test(value);
}
const KEYWORDS = new Set<string>([
    'null', 'undefined', 'true', 'false',
    'if', 'else', 'switch', 'function', 'default', 'break', 'return',
    'continue', 'case', 'for', 'while', 'do', 'class', 'isinstance',
    'goto', 'extends', 'in', 'throw', 'super', 'typeof', 'yield',
    'export', 'import', 'from',
    'var', 'let', 'const',
    'this', 'with',
    'delete',
    'new', 'void',
    'try', 'catch', 'finally',
    'debugger',
]);

const RESERVED_NAMES = new Set<string>([
    ...KEYWORDS,
    'arg', 'item', 'accumulator', 'context', 'key', 'current', 'data', 'index',
    'resolve', 'truthy',
    'hasOwnProperty', 'String', 'Array', 'Object', 'Math', 'console',

    // log, substr, missing, and missing_some aren't here, because they are operators that are allowed to be overlaoded.
]);

function isSafeName(name: string): boolean {
    return /^[_a-zA-Z$][_a-zA-Z0-9$]*$/.test(name);
}

export function compileToString(logic: RulesLogic, options?: Options): [string, Operations] {
    const buffer: string[] = ['return '];
    const operations: Operations = Object.assign(Object.create(null), options?.operations);
    const usedOperations: Operations = Object.create(null);
    const safeNames: {[name: string]: string} = Object.create(null);
    let unsafeNameCount = 0;
    let needResolve = false;
    let needLog = false;
    let needSubstr = false;
    let needTruthy = false;
    let needHasOwnProperty = false;
    let needsMissingSome = false;

    function commaList(logic: RulesLogic[], varName: string) {
        if (logic.length > 0) {
            compile(logic[0], varName);
            for (let index = 1; index < logic.length; ++ index) {
                buffer.push(', ');
                compile(logic[index], varName);
            }
        }
    }

    function compileBool(logic: RulesLogic, varName: string) {
        if (mayNeedTruthy(logic)) {
            needTruthy = true;
            buffer.push('truthy(');
            compile(logic, varName);
            buffer.push(')');
        } else {
            compile(logic, varName);
        }
    }

    function compile(logic: RulesLogic, varName: string) {
        const argType = typeof logic;
        if (logic === null || argType === 'number' || argType === 'string' || argType === 'boolean') {
            buffer.push(JSON.stringify(logic));
            return;
        }

        if (logic === undefined) {
            buffer.push('undefined');
            return;
        }

        if (Array.isArray(logic)) {
            buffer.push('[');
            commaList(logic, varName);
            buffer.push(']');
            return;
        }

        const key = getOp(logic);

        if (key === null) {
            throw new TypeError(`illegal logic expression: ${JSON.stringify(logic, null, 4)}`);
        }

        const args: any[] = Array.isArray(logic[key]) ? logic[key] : [logic[key]];

        if (key in safeNames) {
            const name = safeNames[key];
            buffer.push(name, '(');
            commaList(args, varName);
            buffer.push(')');
            return;
        }

        if (key in operations) {
            let safeName: string;
            if (isSafeName(key)) {
                safeName = RESERVED_NAMES.has(key) ? `_${key}` : key;
            } else {
                safeName = key.replace(/-([a-zA-Z0-9]?)/g, (_, ch) => ch.toUpperCase());
                if (isSafeName(safeName)) {
                    if (RESERVED_NAMES.has(key)) {
                        safeName = `_${safeName}`;
                    }
                    if (safeName in usedOperations) {
                        safeName = `_${unsafeNameCount}`;
                        unsafeNameCount ++;
                    }
                } else {
                    safeName = `_${unsafeNameCount}`;
                    unsafeNameCount ++;
                }
            }

            safeNames[key] = safeName;
            usedOperations[safeName] = operations[key];

            buffer.push(safeName, '(');
            commaList(args, varName);
            buffer.push(')');
            return;
        }

        switch (key) {
            case 'var':
                const prop: RulesLogic|undefined = args[0];
                const defaultValue: RulesLogic|undefined = args[1];

                if (prop === undefined || prop === null || prop === '') {
                    buffer.push(varName);
                } else if (isLogic(prop)) {
                    needResolve = true;
                    buffer.push('resolve(', varName, ', ');
                    compile(prop as RulesLogic, varName);
                    buffer.push(', ');
                    if (defaultValue === undefined) {
                        buffer.push('null');
                    } else {
                        compile(defaultValue, varName);
                    }
                    buffer.push(')');
                } else if (!isPrimitive(prop)) {
                    throw new Error(`illegal var key: ${JSON.stringify(prop)}`);
                } else {
                    buffer.push(varName);
                    if (typeof prop === 'number') {
                        buffer.push('?.[', JSON.stringify(prop), ']');
                    } else {
                        const path = String(prop).split('.');
                        for (let index = 0; index < path.length; ++ index) {
                            const prop = path[index];
                            if (isSafeName(prop) && !KEYWORDS.has(prop)) {
                                buffer.push('?.', prop);
                            } else {
                                buffer.push('?.[', JSON.stringify(prop), ']');
                            }
                        }

                        if (defaultValue !== undefined) {
                            buffer.push(' ?? ');
                            compile(defaultValue, varName);
                        }
                    }
                }
                break;

            case 'missing':
                needHasOwnProperty = true;
                buffer.push('Object.keys([');
                commaList(args, varName);
                buffer.push(
                    '].reduce((accumulator, key) => { if (!hasOwnProperty.call(',
                    varName,
                    ', key)) { accumulator[key] = true; } return accumulator; }, {}))');
                break;

            case 'missing_some':
                needsMissingSome = true;
                const minKeys = args[0] ?? 0;
                const keys = args[1] ?? [];
                buffer.push('missing_some(', varName, ', ');
                compile(minKeys, varName);
                buffer.push(', ');
                compile(keys, varName);
                buffer.push(')');
                break;

            case 'if':
            case '?:':
                if (args.length === 0) {
                    buffer.push('null');
                } else {
                    buffer.push('(');
                    for (let index = 0; index < args.length;) {
                        if (index + 1 >= args.length) {
                            buffer.push('null');
                            break;
                        }
                        compileBool(args[index ++], varName);
                        buffer.push(' ? ');
                        compile(args[index ++], varName);
                        buffer.push(' : ');
                        if (index < args.length) {
                            compile(args[index ++], varName);
                        } else {
                            buffer.push('null');
                        }
                    }
                    buffer.push(')');
                }
                break;

            case '==':
            case '===':
            case '!=':
            case '!==':
                // TODO: operator precedence logic
                if (args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('(');
                compile(args[0], varName);
                buffer.push(' ', key, ' ');
                compile(args[1], varName);
                buffer.push(')');
                break;

            case '!':
            case '!!':
                buffer.push(key);
                if (args.length !== 1) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 1 argument: ${JSON.stringify(logic, null, 4)}`);
                }
                compileBool(args[0], varName);
                break;

            case 'or':
            case 'and':
                if (args.length === 0) {
                    buffer.push('undefined');
                    return;
                }
                const op = key == 'or' ? ' || ' : ' && ';
                buffer.push('(');
                compileBool(args[0], varName);
                for (let index = 1; index < args.length; ++ index) {
                    buffer.push(op);
                    compileBool(args[index], varName);
                }
                buffer.push(')');
                break;

            case '>':
            case '>=':
            case '<':
            case '<=':
                if (args.length < 2) {
                    buffer.push('false');
                }
                buffer.push('(');
                compile(args[0], varName);
                buffer.push(' ', key, ' ');
                compile(args[1], varName);
                for (let index = 2; index < args.length; ++ index) {
                    buffer.push(' && ');
                    compile(args[index - 1], varName);
                    buffer.push(' ', key, ' ');
                    compile(args[index], varName);
                }
                buffer.push(')');
                break;

            case 'max':
            case 'min':
                buffer.push('Math.', key, '(');
                commaList(args, varName);
                buffer.push(')');
                break;

            case '+':
                if (args.length === 0) {
                    throw new TypeError(`illegal logic expression, ${key} needs 1 or more arguments: ${JSON.stringify(logic, null, 4)}`);
                } else if (args.length === 1) {
                    if (!isNumber(args[0])) {
                        buffer.push('+');
                    }
                    compile(args[0], varName);
                } else {
                    buffer.push('(');
                    if (!isNumber(args[0])) {
                        buffer.push('+');
                    }
                    compile(args[0], varName);
                    for (let index = 1; index < args.length; ++ index) {
                        buffer.push(' + ');
                        if (!isNumber(args[index])) {
                            buffer.push('+');
                        }
                        compile(args[index], varName);
                    }
                    buffer.push(')');
                }
                break;

            case '-':
                if (args.length === 0 || args.length > 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs 1 or 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                } else if (args.length === 1) {
                    buffer.push('-');
                    compile(args[0], varName);
                } else {
                    buffer.push('(');
                    compile(args[0], varName);
                    buffer.push(' - ');
                    compile(args[1], varName);
                    buffer.push(')');
                }
                break;

            case '*':
                if (args.length === 0) {
                    throw new TypeError(`illegal logic expression, ${key} needs at least 1 argument: ${JSON.stringify(logic, null, 4)}`);
                } else if (args.length === 1) {
                    if (!isNumber(args[0])) {
                        buffer.push('+');
                    }
                    compile(args[0], varName);
                } else {
                    buffer.push('(');
                    compile(args[0], varName);
                    for (let index = 1; index < args.length; ++ index) {
                        buffer.push(' * ');
                        compile(args[index], varName);
                    }
                    buffer.push(')');
                }
                break;

            case '%':
            case '/':
                if (args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('(');
                compile(args[0], varName);
                for (let index = 1; index < args.length; ++ index) {
                    buffer.push(' ', key, ' ');
                    compile(args[index], varName);
                }
                buffer.push(')');
                break;

            case 'map':
                if (args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('(');
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'map'), '(item => ');
                compile(args[1], 'item');
                buffer.push(') ?? [])');
                break;

            case 'reduce':
                if (args.length < 2 || args.length > 3) {
                    throw new TypeError(`illegal logic expression, ${key} needs 2 to 3 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                compile(args[0], varName);
                buffer.push(
                    arrayMethod(args[0], 'reduce'),
                    '((accumulator, current, index, data) => { var context = { accumulator, current, index, data }; return ');
                compile(args[1], 'context');
                buffer.push('; }');
                if (args.length > 2) {
                    buffer.push(', ');
                    compile(args[2], varName);
                    buffer.push(')');
                }
                break;

            case 'filter':
                if (args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('(');
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'filter'), '(item => ');
                compileBool(args[1], 'item');
                buffer.push(') ?? [])');
                break;

            case 'all':
                if (args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'every'), '(item => ');
                compileBool(args[1], 'item');
                buffer.push(')');
                break;

            case 'none':
                if (args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('!');
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'every'), '(item => ');
                compileBool(args[1], 'item');
                buffer.push(')');
                break;

            case 'some':
                if (args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'some'), '(item => ');
                compileBool(args[1], 'item');
                buffer.push(')')
                break;

            case 'merge':
                if (args.length === 0) {
                    buffer.push('[]');
                } else {
                    buffer.push('(');
                    compile(args[0], varName);
                    buffer.push(arrayMethod(args[0], 'concat'), '(');
                    commaList(args.slice(1), varName);
                    buffer.push(') ?? [])');
                }
                break;

            case 'in':
                if (args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                compile(args[1], varName);
                buffer.push(arrayMethod(args[1], 'includes'), '(');
                compile(args[0], varName);
                buffer.push(')');
                break;

            case 'cat':
                if (args.length === 0) {
                    buffer.push("''");
                } else if (args.length === 1) {
                    buffer.push('String(');
                    compile(args[0], varName);
                    buffer.push(')');
                } else {
                    buffer.push('[');
                    commaList(args, varName);
                    buffer.push("].join('')");
                }
                break;

            case 'substr':
                if (args.length < 2 || args.length > 3) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                needSubstr = true;
                buffer.push('substr(');
                commaList(args, varName);
                buffer.push(')');
                break;

            case 'log':
                needLog = true;
                buffer.push('log(');
                if (args.length !== 1) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 1 argument: ${JSON.stringify(logic, null, 4)}`);
                }
                compile(args[0], varName);
                buffer.push(')');
                break;

            default:
                throw new TypeError(`illegal logic expression: ${JSON.stringify(logic, null, 4)}`);
        }
    }

    compile(logic, 'arg');

    buffer.push(';');

    if (needLog) {
        buffer.unshift('function log(value) { console.log(value); return value; }\n');
    }

    if (needResolve) {
        buffer.unshift(String(resolve) + '\n');
    }

    if (needSubstr) {
        buffer.unshift(String(substr) + '\n')
    }

    if (needTruthy) {
        buffer.unshift('function truthy(value) { return Array.isArray(value) ? value.length !== 0 : !!value; }\n')
    }

    if (needsMissingSome) {
        buffer.unshift(String(missing_some) + '\n');
    }

    if (needHasOwnProperty || needsMissingSome) {
        buffer.unshift('const hasOwnProperty = Object.hasOwnProperty;\n');
    }

    return [buffer.join(''), usedOperations];
}

function substr(source, start, end) {
    if (end < 0) {
        // JavaScript doesn't support negative end, this emulates PHP behavior
        var temp = String(source).substr(start);
        return temp.substr(0, temp.length + end);
    }
    return String(source).substr(start, end);
}

const hasOwnProperty = Object.hasOwnProperty;

function missing_some(obj, count, keys) {
    var missingMap = {};
    for (var index = 0; index < keys.length; ++ index) {
        var key = keys[index];
        if (!hasOwnProperty.call(obj, key)) {
            missingMap[key] = true;
        }
    }
    var missing = Object.keys(missingMap);
    return missing.length >= count ? missing : [];
}

function resolve(obj, prop, defaultValue) {
    if (prop == null || prop === '') {
        return obj;
    }

    if (obj == null) {
        return defaultValue;
    }

    var path = String(prop).split('.');
    for (var index = 0; index < path.length; ++ index) {
        obj = obj[path[index]];
        if (obj == null) {
            return defaultValue;
        }
    }

    return obj;
}

function isPrimitive(value: any): boolean {
    const valueType = typeof value;
    return value === null || valueType === 'number' || valueType === 'string' || valueType === 'boolean' || valueType === 'undefined';
}

function isLogic(value: any): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    let hasKey = false;
    for (const _ in value) {
        if (hasKey) {
            return false;
        }
        hasKey = true;
    }

    return hasKey;
}

function getOp(value: any): string|null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    let key: string|null = null;
    for (const curKey in value) {
        if (key !== null) {
            return null;
        }
        key = curKey;
    }

    return key;
}

function isEmpty(ops: {[key: string]: any}): boolean {
    for (const _ in ops) {
        return false;
    }
    return true;
}

export function compileToFunction(logic: RulesLogic, options?: Options): (arg: any) => any {
    const [code, usedOperations] = compileToString(logic, options);

    if (isEmpty(usedOperations)) {
        return new Function('arg', code) as any;
    }

    const wrappedCode = `return function(arg) {${code}}`;
    const argNames: string[] = [];
    const args: ((...args: any[]) => any)[] = [];

    for (const argName in usedOperations) {
        argNames.push(argName);
        args.push(usedOperations[argName]);
    }

    const wrapper = new Function(...argNames, wrappedCode);
    return wrapper(...args);
}

function mayNeedTruthy(logic: RulesLogic): boolean {
    if (isPrimitive(logic)) {
        return false;
    }

    const key = getOp(logic);

    if (key === null) {
        return true;
    }

    switch (key) {
        case '<':
        case '>':
        case '<=':
        case '>=':
        case '==':
        case '!=':
        case '===':
        case '!==':
        case '!':
        case '!!':
        case 'cat':
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
        case 'in':
        case 'substr':
        case 'some':
        case 'all':
        case 'none':
            return false;
    }

    return true;
}

function isNumber(logic: RulesLogic): boolean {
    if (typeof logic === 'number') {
        return true;
    }

    if (isPrimitive(logic)) {
        return false;
    }

    const key = getOp(logic);

    if (key === null) {
        return false;
    }

    switch (key) {
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
            return true;
    }

    return false;
}

function arrayMethod(arg: RulesLogic, method: string): string {
    if (isArray(arg)) {
        return `.${method}`;
    }

    return `?.${method}?.`;
}

function isArray(logic: RulesLogic): boolean {
    if (Array.isArray(logic)) {
        return true;
    }

    if (isPrimitive(logic)) {
        return false;
    }

    const key = getOp(logic);

    if (key === null) {
        return false;
    }

    switch (key) {
        case 'map':
        case 'filter':
        case 'merge':
        case 'missing':
        case 'missing_some':
            return true;
    }

    return false;
}

export const EXTRA_OPERATIONS: Operations = {
    timestamp(value: any) {
        if (value instanceof Date) {
            return value.getTime();
        }

        const typeStr = typeof value;
        if (typeStr === 'string') {
            return new Date(value).getTime();
        }

        if (typeStr === 'number') {
            return value;
        }

        const typeMsg = value === null       ? 'null' :
                        typeStr === 'object' ? value.constructor.name :
                        typeStr;
        throw new TypeError(`value is not a Date object but ${typeMsg}`);
    },

    days: (value: number) => +value * 1000 * 60 * 60 * 24,
    hours: (value: number) => +value * 1000 * 60 * 60,
    now: Date.now,

    'is-nan': isNaN,
    'is-array': Array.isArray,
    'is-finite': isFinite,
    'is-empty': isEmpty,
    'typeof': (value: any) => typeof value,

    matches(text: string, pattern: string|RegExp, flags?: string) {
        return new RegExp(pattern, flags).test(text);
    },

    'time-since': (value: any) => {
        if (value instanceof Date) {
            return Date.now() - value.getTime();
        }

        const typeStr = typeof value;
        if (typeStr === 'string') {
            return Date.now() - new Date(value).getTime();
        }

        if (typeStr === 'number') {
            return Date.now() - value;
        }

        const typeMsg = value === null       ? 'null' :
                        typeStr === 'object' ? value.constructor.name :
                        typeStr;
        throw new TypeError(`value is not a Date object but ${typeMsg}`);
    },

    combinations(...lists: readonly any[][]): any[][] {
        const combinations: any[][] = [];
        const listCount = lists.length;
        const stack: number[] = new Array(listCount);
        const item: any[] = new Array(listCount);
        let stackPtr = 0;

        stack[0] = 0;
        while (stackPtr >= 0) {
            if (stackPtr === listCount) {
                combinations.push([...item]);
                -- stackPtr;
            } else {
                const list  = lists[stackPtr];
                const index = stack[stackPtr];

                if (index === list.length) {
                    -- stackPtr;
                } else {
                    item[stackPtr] = list[index];
                    stack[stackPtr] = index + 1;
                    ++ stackPtr;
                    stack[stackPtr] = 0;
                }
            }
        }

        return combinations;
    },

    zip(...lists: readonly any[][]): any[][] {
        const zipped: any[][] = [];
        const listCount = lists.length;

        if (listCount > 0) {
            let itemCount = Infinity;
            for (const list of lists) {
                if (list.length < itemCount) {
                    itemCount = list.length;
                }
            }

            for (let listIndex = 0; listIndex < itemCount; ++ listIndex) {
                const item = new Array(listCount);
                for (let tupleIndex = 0; tupleIndex < listCount; ++ tupleIndex) {
                    item[tupleIndex] = lists[tupleIndex][listIndex];
                }
                zipped.push(item);
            }
        }

        return zipped;
    },

    E:       () => Math.E,
    LN10:    () => Math.LN10,
    LN2:     () => Math.LN2,
    LOG2E:   () => Math.LOG2E,
    LOG10E:  () => Math.LOG10E,
    PI:      () => Math.PI,
    SQRT1_2: () => Math.SQRT1_2,
    SQRT2:   () => Math.SQRT2,

    abs:       Math.abs,
    acos:      Math.acos,
    asin:      Math.asin,
    atan:      Math.atan,
    atan2:     Math.atan2,
    ceil:      Math.ceil,
    cos:       Math.cos,
    exp:       Math.exp,
    floor:     Math.floor,
    logarthim: Math.log, // log() is console.log()
    pow:       Math.pow,
    round:     Math.round,
    sin:       Math.sin,
    sqrt:      Math.sqrt,
    tan:       Math.tan,
};
