#!/usr/bin/env bun
/**
 * Example usage of the MathExpressionParser
 * This demonstrates how to safely handle mathematical expressions
 * including invalid ones like "1+!"
 */

import { MathExpressionParser } from "./math-expression-parser";

// Test various expressions
const testExpressions = [
  "1+1",
  "2*3+4",
  "10/2",
  "(1+2)*3",
  "2^3",
  "1+!",      // Invalid: exclamation mark not allowed
  "1++2",     // Invalid: consecutive operators
  "1+",       // Invalid: ends with operator
  "+1",       // Invalid: starts with operator (except -)
  "((1+2)",   // Invalid: unbalanced parentheses
  "abc",      // Invalid: letters not allowed
  "1+@2",     // Invalid: @ symbol not allowed
];

console.log("Mathematical Expression Parser Examples\n");
console.log("=" .repeat(50));

for (const expr of testExpressions) {
  console.log(`\nExpression: "${expr}"`);

  // First validate the expression
  const validation = MathExpressionParser.validate(expr);

  if (validation.isValid) {
    console.log("✅ Valid expression");

    // If valid, evaluate it
    const evaluation = MathExpressionParser.evaluate(expr);
    if (evaluation.result !== undefined) {
      console.log(`Result: ${evaluation.result}`);
    } else {
      console.log(`❌ Evaluation error: ${evaluation.error}`);
    }
  } else {
    console.log(`❌ Invalid expression: ${validation.error}`);
  }
}

console.log("\n" + "=" .repeat(50));
console.log("\nSpecial case: '1+!' expression");
console.log("-" .repeat(30));

const problematicExpr = "1+!";
const result = MathExpressionParser.evaluate(problematicExpr);

if (result.error) {
  console.log(`❌ Cannot evaluate '${problematicExpr}'`);
  console.log(`Error: ${result.error}`);
} else {
  console.log(`✅ Result: ${result.result}`);
}

console.log("\nThe parser correctly identifies '1+!' as invalid");
console.log("because '!' is not a valid mathematical operator.");