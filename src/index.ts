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
    'arg', 'item', 'accumulator', 'context', 'missing', 'key', 'current', 'data', 'index',
    'resolve', 'log', 'substr', 'truthy',
    'Array', 'Object', 'Math', 'console',
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

    function commaList(logic: RulesLogic[], varName: string) {
        if (logic.length > 0) {
            compile(logic[0], varName);
            for (let index = 0; index < logic.length; ++ index) {
                buffer.push(', ');
                compile(logic[index], varName);
            }
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

        const args = logic[key];

        if (key in safeNames) {
            const name = safeNames[key];
            buffer.push(name, '(');
            if (Array.isArray(args)) {
                commaList(args, varName);
            } else {
                compile(args, varName);
            }
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
            if (Array.isArray(args)) {
                commaList(args, varName);
            } else {
                compile(args, varName);
            }
            buffer.push(')');
            return;
        }

        switch (key) {
            case 'var':
                let prop: RulesLogic|undefined;
                let defaultValue: RulesLogic|undefined;

                if (Array.isArray(args)) {
                    prop = args[0];
                    defaultValue = args[1];
                } else {
                    prop = args;
                }

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
                const items = Array.isArray(args) ? args : [args];
                buffer.push('Object.keys([');
                commaList(items, varName);
                buffer.push(
                    '].reduce((missing, key) => { if (!Object.prototype.hasOwnProperty.call(',
                    varName,
                    ', key)) { missing[key] = true; } return missing; }, {}))');
                break;

            case 'missing_some':
                throw new Error(`${key} is not implemented`);
                break;

            case 'if':
            case '?:':
                if (!Array.isArray(args) || args.length === 0) {
                    buffer.push('null');
                } else {
                    buffer.push('(');
                    for (let index = 0; index < args.length;) {
                        if (index + 1 >= args.length) {
                            buffer.push('null');
                            break;
                        }
                        compile(args[index ++], varName);
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
                if (!Array.isArray(args) || args.length !== 2) {
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
                if (Array.isArray(args)) {
                    if (args.length !== 1) {
                        throw new TypeError(`illegal logic expression, ${key} needs exactly 1 argument: ${JSON.stringify(logic, null, 4)}`);
                    }
                    compile(args[0], varName);
                } else {
                    compile(args, varName);
                }
                break;

            case 'or':
            case 'and':
                if (!Array.isArray(args)) {
                    compile(args, varName);
                    return;
                } else if (args.length === 0) {
                    buffer.push('undefined');
                    return;
                }
                const op = key == 'or' ? ' || ' : ' && ';
                buffer.push('(');
                compile(args[0], varName);
                for (let index = 1; index < args.length; ++ index) {
                    buffer.push(op);
                    compile(args[index], varName);
                }
                buffer.push(')');
                break;

            case '>':
            case '>=':
            case '<':
            case '<=':
                if (!Array.isArray(args) || args.length < 2) {
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
                if (Array.isArray(args)) {
                    commaList(args, varName);
                } else {
                    compile(args, varName);
                }
                buffer.push(')');
                break;

            case '+':
                if (!Array.isArray(args)) {
                    buffer.push('+');
                    compile(args, varName);
                } else if (args.length === 0) {
                    throw new TypeError(`illegal logic expression, ${key} needs 1 or more arguments: ${JSON.stringify(logic, null, 4)}`);
                } else if (args.length === 1) {
                    buffer.push('+');
                    compile(args[0], varName);
                } else {
                    buffer.push('(');
                    compile(args[0], varName);
                    for (let index = 1; index < args.length; ++ index) {
                        buffer.push(' + ');
                        compile(args[index], varName);
                    }
                    buffer.push(')');
                }
                break;
                
            case '-':
                if (!Array.isArray(args)) {
                    buffer.push('-');
                    compile(args, varName);
                } else if (args.length === 0 || args.length > 2) {
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
                if (!Array.isArray(args) || args.length < 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs 2 or more arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('(');
                compile(args[0], varName);
                for (let index = 1; index < args.length; ++ index) {
                    buffer.push(' * ');
                    compile(args[index], varName);
                }
                buffer.push(')');
                break;
        
            case '%':
            case '/':
                if (!Array.isArray(args) || args.length !== 2) {
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
                if (!Array.isArray(args) || args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('(');
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'map'), '(item => ');
                compile(args[1], 'item');
                buffer.push(') ?? [])');
                break;
        
            case 'reduce':
                if (!Array.isArray(args) || args.length < 2 || args.length > 3) {
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
                if (!Array.isArray(args) || args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('(');
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'filter'), '(item => ');
                if (mayNeedTruthy(args[1])) {
                    needTruthy = true;
                    buffer.push('truthy(');
                    compile(args[1], 'item');
                    buffer.push(')');
                } else {
                    compile(args[1], 'item');
                }
                buffer.push(') ?? [])');
                break;

            case 'all':
                if (!Array.isArray(args) || args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'every'), '(item => ');
                if (mayNeedTruthy(args[1])) {
                    needTruthy = true;
                    buffer.push('truthy(');
                    compile(args[1], 'item');
                    buffer.push(')');
                } else {
                    compile(args[1], 'item');
                }
                buffer.push(')');
                break;

            case 'none':
                if (!Array.isArray(args) || args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                buffer.push('!');
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'every'), '(item => ');
                if (mayNeedTruthy(args[1])) {
                    needTruthy = true;
                    buffer.push('truthy(');
                    compile(args[1], 'item');
                    buffer.push(')');
                } else {
                    compile(args[1], 'item');
                }
                buffer.push(')');
                break;

            case 'some':
                if (!Array.isArray(args) || args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                compile(args[0], varName);
                buffer.push(arrayMethod(args[0], 'some'), '(item => ');
                if (mayNeedTruthy(args[1])) {
                    needTruthy = true;
                    buffer.push('truthy(');
                    compile(args[1], 'item');
                    buffer.push(')');
                } else {
                    compile(args[1], 'item');
                }
                buffer.push(')')
                break;

            case 'merge':
                if (!Array.isArray(args) || args.length === 0) {
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
                if (!Array.isArray(args) || args.length !== 2) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                compile(args[1], varName);
                buffer.push(arrayMethod(args[1], 'contains'), '(');
                compile(args[0], varName);
                buffer.push(') ?? null');
                break;

            case 'cat':
                if (Array.isArray(args)) {
                    buffer.push('[');
                    commaList(args, varName);
                    buffer.push('].join("")');
                } else {
                    buffer.push('String(');
                    compile(args, varName);
                    buffer.push(')');
                }
                break;

            case 'substr':
                if (!Array.isArray(args) || args.length < 2 || args.length > 3) {
                    throw new TypeError(`illegal logic expression, ${key} needs exactly 2 arguments: ${JSON.stringify(logic, null, 4)}`);
                }
                if (args.length > 2) {
                    needSubstr = true;
                    buffer.push('substr(');
                    compile(args[0], varName);
                    buffer.push(', ');
                    compile(args[1], varName);
                    buffer.push(', ');
                    compile(args[2], varName);
                    buffer.push(')');
                } else {
                    compile(args[0], varName);
                    buffer.push('?.substr?.(');
                    compile(args[1], varName);
                    buffer.push(')');
                }
                break;
        
            case 'log':
                needLog = true;
                buffer.push('log(');
                if (Array.isArray(args)) {
                    if (args.length !== 1) {
                        throw new TypeError(`illegal logic expression, ${key} needs exactly 1 argument: ${JSON.stringify(logic, null, 4)}`);
                    }
                    compile(args[0], varName);
                } else {
                    compile(args, varName);
                }
                buffer.push(')');
                break;
    
            default:
                throw new TypeError(`illegal logic expression: ${JSON.stringify(logic, null, 4)}`);
        }
    }

    compile(logic, 'arg');

    buffer.push(';\n');

    if (needLog) {
        buffer.unshift('function log(value) { console.log(value); return value; }\n');
    }

    if (needResolve) {
        buffer.unshift(String(resolve) + '\n');
    }

    if (needSubstr) {
        buffer.unshift('function substr(str, start, end) { return end < 0 ? str?.substr?.(start, str.length - end) : str?.substr?.(start, end)}\n')
    }

    if (needTruthy) {
        buffer.unshift('function truthy(value) { return Array.isArray(value) ? value.length !== 0 : !!value; }\n')
    }

    return [buffer.join(''), usedOperations];
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
        case 'and':
        case 'or':
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

import * as fs from 'fs';
const rules = JSON.parse(fs.readFileSync(`${__dirname}/../tmp/rules.json`, 'utf8'));

const logic = {"*": [{"var": "foo"}, {"var": "bar.x"}]};
const options: Options = {
    operations: {
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
    }
}
console.log(`function (arg) {\n    ${compileToString(rules as any, options)[0].replace(/\n/g, '\n    ')}}`);

console.log(compileToFunction(logic)({
    foo: 1,
    bar: {
        x: 2,
        y: 3
    }
}));
