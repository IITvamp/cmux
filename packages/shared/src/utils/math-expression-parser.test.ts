import { describe, expect, it } from "vitest";
import { MathExpressionParser, validateMathExpression, evaluateMathExpression } from "./math-expression-parser";

describe("MathExpressionParser", () => {
  describe("validate", () => {
    it("should reject expressions with invalid characters like '!'", () => {
      const result = MathExpressionParser.validate("1+!");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid character(s) in expression: !");
    });

    it("should reject other invalid expressions", () => {
      const testCases = [
        { expr: "1+@", expectedError: "Invalid character(s) in expression: @" },
        { expr: "1+#", expectedError: "Invalid character(s) in expression: #" },
        { expr: "1+$", expectedError: "Invalid character(s) in expression: $" },
        { expr: "1+%", expectedError: "Invalid character(s) in expression: %" },
        { expr: "1+&", expectedError: "Invalid character(s) in expression: &" },
        { expr: "abc", expectedError: "Invalid character(s) in expression: a, b, c" },
        { expr: "1++2", expectedError: "Consecutive operators are not allowed" },
        { expr: "1+", expectedError: "Expression cannot end with an operator" },
        { expr: "+1", expectedError: "Expression cannot start with an operator (except -)" },
        { expr: "((1+2)", expectedError: "Unbalanced parentheses" },
        { expr: "(1+2))", expectedError: "Unbalanced parentheses" },
        { expr: "", expectedError: "Expression cannot be empty" },
        { expr: "   ", expectedError: "Expression cannot be empty" },
      ];

      testCases.forEach(({ expr, expectedError }) => {
        const result = MathExpressionParser.validate(expr);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(expectedError);
      });
    });

    it("should accept valid mathematical expressions", () => {
      const validExpressions = [
        "1+1",
        "2*3",
        "10/2",
        "2^3",
        "(1+2)*3",
        "3.14159",
        "-5",
        "(-5+3)*2",
        "1 + 2 * 3",
        "((1+2)*(3+4))",
        "2.5 * 3.7",
        "10 - 5 + 3",
      ];

      validExpressions.forEach(expr => {
        const result = MathExpressionParser.validate(expr);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe("evaluate", () => {
    it("should not evaluate invalid expressions like '1+!'", () => {
      const result = MathExpressionParser.evaluate("1+!");
      expect(result.result).toBeUndefined();
      expect(result.error).toBe("Invalid character(s) in expression: !");
    });

    it("should correctly evaluate valid expressions", () => {
      const testCases = [
        { expr: "1+1", expected: 2 },
        { expr: "2*3", expected: 6 },
        { expr: "10/2", expected: 5 },
        { expr: "2^3", expected: 8 },
        { expr: "(1+2)*3", expected: 9 },
        { expr: "3.14159", expected: 3.14159 },
        { expr: "-5", expected: -5 },
        { expr: "(-5+3)*2", expected: -4 },
        { expr: "1 + 2 * 3", expected: 7 },
        { expr: "2.5 * 4", expected: 10 },
      ];

      testCases.forEach(({ expr, expected }) => {
        const result = MathExpressionParser.evaluate(expr);
        expect(result.error).toBeUndefined();
        expect(result.result).toBe(expected);
      });
    });

    it("should handle division by zero", () => {
      const result = MathExpressionParser.evaluate("1/0");
      expect(result.result).toBeUndefined();
      expect(result.error).toBe("Expression resulted in an invalid number");
    });
  });

  describe("format", () => {
    it("should format expressions with spaces around operators", () => {
      expect(MathExpressionParser.format("1+2")).toBe("1 + 2");
      expect(MathExpressionParser.format("1+2*3")).toBe("1 + 2 * 3");
      expect(MathExpressionParser.format("(1+2)*3")).toBe("(1 + 2) * 3");
      expect(MathExpressionParser.format("1  +  2")).toBe("1 + 2");
    });
  });

  describe("convenience functions", () => {
    it("validateMathExpression should work correctly", () => {
      const result1 = validateMathExpression("1+!");
      expect(result1.isValid).toBe(false);

      const result2 = validateMathExpression("1+1");
      expect(result2.isValid).toBe(true);
    });

    it("evaluateMathExpression should work correctly", () => {
      const result1 = evaluateMathExpression("1+!");
      expect(result1.error).toBeDefined();

      const result2 = evaluateMathExpression("1+1");
      expect(result2.result).toBe(2);
    });
  });
});