/**
 * A safe mathematical expression parser that validates expressions
 * before attempting to evaluate them.
 */

export class MathExpressionParser {
  private static readonly VALID_OPERATORS = ['+', '-', '*', '/', '^', '(', ')'];
  private static readonly VALID_CHARS_REGEX = /^[0-9+\-*/^().\s]+$/;

  /**
   * Validates a mathematical expression
   * @param expression The expression to validate
   * @returns An object with isValid flag and error message if invalid
   */
  static validate(expression: string): { isValid: boolean; error?: string } {
    if (!expression || expression.trim().length === 0) {
      return { isValid: false, error: 'Expression cannot be empty' };
    }

    // Check for invalid characters
    if (!this.VALID_CHARS_REGEX.test(expression)) {
      const invalidChars = expression
        .split('')
        .filter(char => !this.VALID_CHARS_REGEX.test(char))
        .filter((char, index, self) => self.indexOf(char) === index);

      return {
        isValid: false,
        error: `Invalid character(s) in expression: ${invalidChars.join(', ')}`
      };
    }

    // Check for consecutive operators (except minus for negative numbers)
    if (/[+*/^]{2,}/.test(expression)) {
      return { isValid: false, error: 'Consecutive operators are not allowed' };
    }

    // Check for operators at the end (except closing parenthesis)
    if (/[+\-*/^]$/.test(expression.trim())) {
      return { isValid: false, error: 'Expression cannot end with an operator' };
    }

    // Check for operators at the beginning (except minus and opening parenthesis)
    if (/^[+*/^]/.test(expression.trim())) {
      return { isValid: false, error: 'Expression cannot start with an operator (except -)' };
    }

    // Check balanced parentheses
    let parenCount = 0;
    for (const char of expression) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        return { isValid: false, error: 'Unbalanced parentheses' };
      }
    }
    if (parenCount !== 0) {
      return { isValid: false, error: 'Unbalanced parentheses' };
    }

    return { isValid: true };
  }

  /**
   * Safely evaluates a mathematical expression
   * @param expression The expression to evaluate
   * @returns The result or an error object
   */
  static evaluate(expression: string): { result?: number; error?: string } {
    const validation = this.validate(expression);

    if (!validation.isValid) {
      return { error: validation.error };
    }

    try {
      // Replace ^ with ** for exponentiation
      const jsExpression = expression.replace(/\^/g, '**');

      // Create a safe evaluation context using Function constructor
      // This is safer than eval but still evaluates mathematical expressions
      const func = new Function(`"use strict"; return (${jsExpression})`);
      const result = func();

      if (typeof result !== 'number' || !isFinite(result)) {
        return { error: 'Expression resulted in an invalid number' };
      }

      return { result };
    } catch (error) {
      return { error: `Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Formats an expression for display, adding spaces around operators
   * @param expression The expression to format
   * @returns The formatted expression
   */
  static format(expression: string): string {
    return expression
      .replace(/([+\-*/^])/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export convenience functions
export function validateMathExpression(expression: string): { isValid: boolean; error?: string } {
  return MathExpressionParser.validate(expression);
}

export function evaluateMathExpression(expression: string): { result?: number; error?: string } {
  return MathExpressionParser.evaluate(expression);
}