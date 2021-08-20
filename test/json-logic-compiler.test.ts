import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { compileStringToFunction, compileToFunction, compileToString, Operations } from '../src';

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
                let code: string;
                let ops: Operations;
                let func: (arg: any) => any;
                let result: any;

                try {
                    [code, ops] = compileToString(rule);
                } catch (error) {
                    throw new Error(
                        `     error: ${error}\n` +
                        `      rule: ${JSON.stringify(rule)}\n` +
                        `      data: ${JSON.stringify(data)}`);
                }

                try {
                    func = compileStringToFunction(code, ops);
                    result = func(data);
                } catch (error) {
                    throw new Error(
                        `     error: ${error}\n` +
                        `      rule: ${JSON.stringify(rule)}\n` +
                        `      data: ${JSON.stringify(data)}\n` +
                        `      code: ${code.replace(/\n/g, '\n            ')}`);
                }

                expect(result).toEqualMessage(
                    expectedResult,
                    `     error: Wrong result\n` +
                    `      rule: ${JSON.stringify(rule)}\n` +
                    `      data: ${JSON.stringify(data)}\n` +
                    `      code: ${code.replace(/\n/g, '\n            ')}\n` +
                    `  expected: ${JSON.stringify(expectedResult)}\n` +
                    `    actual: ${JSON.stringify(result)}`);
            }
        });
    });
});

describe('basic', () => {
    it("Bad operator", () => {
        expect(() => compileToFunction({"fubar": []} as any)).
            toThrow(/Unrecognized operation/);
    });

    it("logging", () => {
        let lastMsg: any;
        const log = console.log;
        console.log = function (logged) {
            lastMsg = logged;
        };
        try {
            const result = compileToFunction({"log": [1]})();
            expect(result).toEqual(1);
            expect(lastMsg).toEqual(1);
        } finally {
            console.log = log;
        }
    });
  
    /* TODO: port tests
    QUnit.test( "edge cases", function( assert ) {
      assert.equal( jsonLogic.apply(), undefined, "Called with no arguments" );
  
      assert.equal( jsonLogic.apply({ var: "" }, 0), 0, "Var when data is 'falsy'" );
      assert.equal( jsonLogic.apply({ var: "" }, null), null, "Var when data is null" );
      assert.equal( jsonLogic.apply({ var: "" }, undefined), undefined, "Var when data is undefined" );
  
      assert.equal( jsonLogic.apply({ var: ["a", "fallback"] }, undefined), "fallback", "Fallback works when data is a non-object" );
    });
  
    QUnit.test( "Expanding functionality with add_operator", function( assert) {
      // Operator is not yet defined
      assert.throws(
        function() {
          jsonLogic.apply({"add_to_a": []});
        },
        /Unrecognized operation/
      );
  
      // Set up some outside data, and build a basic function operator
      var a = 0;
      var add_to_a = function(b) {
        if (b === undefined) {
          b=1;
        } return a += b;
      };
      jsonLogic.add_operation("add_to_a", add_to_a);
      // New operation executes, returns desired result
      // No args
      assert.equal( jsonLogic.apply({"add_to_a": []}), 1 );
      // Unary syntactic sugar
      assert.equal( jsonLogic.apply({"add_to_a": 41}), 42 );
      // New operation had side effects.
      assert.equal(a, 42);
  
      var fives = {
        add: function(i) {
          return i + 5;
        },
        subtract: function(i) {
          return i - 5;
        },
      };
  
      jsonLogic.add_operation("fives", fives);
      assert.equal( jsonLogic.apply({"fives.add": 37}), 42 );
      assert.equal( jsonLogic.apply({"fives.subtract": [47]}), 42 );
  
      // Calling a method with multiple var as arguments.
      jsonLogic.add_operation("times", function(a, b) {
        return a*b;
      });
      assert.equal(
        jsonLogic.apply(
          {"times": [{"var": "a"}, {"var": "b"}]},
          {a: 6, b: 7}
        ),
        42
      );
  
      // Remove operation:
      jsonLogic.rm_operation("times");
  
      assert.throws(
        function() {
          jsonLogic.apply({"times": [2, 2]});
        },
        /Unrecognized operation/
      );
  
      // Calling a method that takes an array, but the inside of the array has rules, too
      jsonLogic.add_operation("array_times", function(a) {
        return a[0]*a[1];
      });
      assert.equal(
        jsonLogic.apply(
          {"array_times": [[{"var": "a"}, {"var": "b"}]]},
          {a: 6, b: 7}
        ),
        42
      );
    });
  
    QUnit.test("Control structures don't eval depth-first", function(assert) {
      // Depth-first recursion was wasteful but not harmful until we added custom operations that could have side-effects.
  
      // If operations run the condition, if truthy, it runs and returns that consequent.
      // Consequents of falsy conditions should not run.
      // After one truthy condition, no other condition should run
      var conditions = [];
      var consequents = [];
      jsonLogic.add_operation("push.if", function(v) {
        conditions.push(v); return v;
      });
      jsonLogic.add_operation("push.then", function(v) {
        consequents.push(v); return v;
      });
      jsonLogic.add_operation("push.else", function(v) {
        consequents.push(v); return v;
      });
  
      jsonLogic.apply({"if": [
        {"push.if": [true]},
        {"push.then": ["first"]},
        {"push.if": [false]},
        {"push.then": ["second"]},
        {"push.else": ["third"]},
      ]});
      assert.deepEqual(conditions, [true]);
      assert.deepEqual(consequents, ["first"]);
  
      conditions = [];
      consequents = [];
      jsonLogic.apply({"if": [
        {"push.if": [false]},
        {"push.then": ["first"]},
        {"push.if": [true]},
        {"push.then": ["second"]},
        {"push.else": ["third"]},
      ]});
      assert.deepEqual(conditions, [false, true]);
      assert.deepEqual(consequents, ["second"]);
  
      conditions = [];
      consequents = [];
      jsonLogic.apply({"if": [
        {"push.if": [false]},
        {"push.then": ["first"]},
        {"push.if": [false]},
        {"push.then": ["second"]},
        {"push.else": ["third"]},
      ]});
      assert.deepEqual(conditions, [false, false]);
      assert.deepEqual(consequents, ["third"]);
  
  
      jsonLogic.add_operation("push", function(arg) {
        i.push(arg); return arg;
      });
      var i = [];
  
      i = [];
      jsonLogic.apply({"and": [{"push": [false]}, {"push": [false]}]});
      assert.deepEqual(i, [false]);
      i = [];
      jsonLogic.apply({"and": [{"push": [false]}, {"push": [true]}]});
      assert.deepEqual(i, [false]);
      i = [];
      jsonLogic.apply({"and": [{"push": [true]}, {"push": [false]}]});
      assert.deepEqual(i, [true, false]);
      i = [];
      jsonLogic.apply({"and": [{"push": [true]}, {"push": [true]}]});
      assert.deepEqual(i, [true, true]);
  
  
      i = [];
      jsonLogic.apply({"or": [{"push": [false]}, {"push": [false]}]});
      assert.deepEqual(i, [false, false]);
      i = [];
      jsonLogic.apply({"or": [{"push": [false]}, {"push": [true]}]});
      assert.deepEqual(i, [false, true]);
      i = [];
      jsonLogic.apply({"or": [{"push": [true]}, {"push": [false]}]});
      assert.deepEqual(i, [true]);
      i = [];
      jsonLogic.apply({"or": [{"push": [true]}, {"push": [true]}]});
      assert.deepEqual(i, [true]);
    });
    */
});
