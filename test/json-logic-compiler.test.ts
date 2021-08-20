import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { compileStringToFunction, compileToString } from '../src';

declare module "expect/build/types" {
    interface Matchers<R> {
        toEqualMessage(expected: unknown, message: string): R;
    }
}

expect.extend({
    toEqualMessage(received: any, expected: any, message: string) {
        let pass = true;
        try {
            expect(received).toEqual(expected);
        } catch (e) {
            pass = false;
        }
        return {
            pass,
            message: () => message,
            expected,
            received
        };
    }
});

const tests: (string|[any, any, any])[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'tests.json'), 'utf-8'));

interface TestGroup {
    name: string;
    tests: [any, any, any][];
}

const groupedTests: TestGroup[] = [];
let group: TestGroup = {
    name: 'JsonLogic Test',
    tests: [],
};

for (const test of tests) {
    if (typeof test === 'string') {
        if (group.tests.length > 0) {
            groupedTests.push(group);
        }
        group = {
            name: test,
            tests: [],
        };
    } else {
        group.tests.push(test);
    }
}

describe('tests', () => {
    groupedTests.forEach(group => {
        it(group.name, () => {
            for (const [rule, data, expectedResult] of group.tests) {
                const [code, ops] = compileToString(rule);
                const func = compileStringToFunction(code, ops);
                const result = func(data);
                expect(result).toEqualMessage(
                    expectedResult,
                    `      rule: ${JSON.stringify(rule)}\n` +
                    `      data: ${JSON.stringify(data)}\n` +
                    `      code: ${code.replace(/\n/g, '\n            ')}\n` +
                    `  expected: ${JSON.stringify(expectedResult)}\n` +
                    `    actual: ${JSON.stringify(result)}`);
            }
        });
    });
});
