/**
 * Variable type definition
 */
export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  type: VariableType;
  required: boolean;
  defaultValue?: unknown;
  validation?: (value: unknown) => boolean;
}

/**
 * Template options
 */
export interface TemplateOptions {
  variables: Record<string, TemplateVariable>;
  maxLength?: number;
  minLength?: number;
  allowUnknownVariables?: boolean;
  strictTypes?: boolean;
}

/**
 * Template section definition
 */
interface TemplateSection {
  text: string;
  isVariable: boolean;
  variableName?: string;
  defaultValue?: unknown;
  conditional?: boolean;
  condition?: string;
}

/**
 * Error thrown when template validation fails
 */
export class TemplateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

/**
 * A class for managing prompt templates with variable substitution and validation
 */
export class PromptTemplate {
  private sections: TemplateSection[] = [];
  private variablePattern = /\{\{([^}]+)\}\}|\{([^}]+)\}|\$([a-zA-Z_][a-zA-Z0-9_]*)/g;

  constructor(
    private template: string,
    private options: TemplateOptions
  ) {
    this.validateOptions();
    this.sections = this.parse();
  }

  /**
   * Validates template options
   * @throws {TemplateError} If options are invalid
   */
  private validateOptions(): void {
    if (!this.options.variables || typeof this.options.variables !== 'object') {
      throw new TemplateError(
        'Template options must include variables object',
        'INVALID_OPTIONS'
      );
    }

    // Validate each variable definition
    Object.entries(this.options.variables).forEach(([name, variable]) => {
      if (!variable.type || !['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
        throw new TemplateError(
          `Invalid type for variable "${name}": ${variable.type}`,
          'INVALID_VARIABLE_TYPE',
          { name, type: variable.type }
        );
      }

      if (variable.defaultValue !== undefined) {
        if (!this.validateVariableValue(variable.defaultValue, variable)) {
          throw new TemplateError(
            `Default value for "${name}" does not match type ${variable.type}`,
            'INVALID_DEFAULT_VALUE',
            { name, value: variable.defaultValue, type: variable.type }
          );
        }
      }
    });
  }

  /**
   * Parses template string into sections
   * @returns Array of template sections
   * @throws {TemplateError} If template syntax is invalid
   */
  private parse(): TemplateSection[] {
    const sections: TemplateSection[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = this.variablePattern.exec(this.template)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        sections.push({
          text: this.template.slice(lastIndex, match.index),
          isVariable: false
        });
      }

      // Get variable name and any modifiers
      const variableName = match[1] || match[2] || match[3];
      const [name, ...modifiers] = variableName.split('|').map(s => s.trim());

      // Parse modifiers
      const section: TemplateSection = {
        text: match[0],
        isVariable: true,
        variableName: name
      };

      modifiers.forEach(modifier => {
        if (modifier.startsWith('default=')) {
          section.defaultValue = this.parseDefaultValue(modifier.slice(8));
        } else if (modifier === 'optional') {
          const variable = this.options.variables[name];
          if (variable) {
            variable.required = false;
          }
        } else if (modifier.startsWith('if=')) {
          section.conditional = true;
          section.condition = modifier.slice(3);
        }
      });

      sections.push(section);
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < this.template.length) {
      sections.push({
        text: this.template.slice(lastIndex),
        isVariable: false
      });
    }

    return sections;
  }

  /**
   * Parses default value from modifier string
   * @param value Default value string
   * @returns Parsed default value
   */
  private parseDefaultValue(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * Validates a variable value against its definition
   * @param value Value to validate
   * @param variable Variable definition
   * @returns Whether the value is valid
   */
  private validateVariableValue(value: unknown, variable: TemplateVariable): boolean {
    if (value === undefined || value === null) {
      return !variable.required;
    }

    // Type checking
    switch (variable.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default:
        return false;
    }
  }

  /**
   * Resolves conditional sections
   * @param section Template section
   * @param variables Variable values
   * @returns Whether the section should be included
   */
  private resolveConditional(section: TemplateSection, variables: Record<string, unknown>): boolean {
    if (!section.conditional || !section.condition) {
      return true;
    }

    try {
      // Simple condition evaluation
      const [varName, operator, value] = section.condition.split(/\s+/);
      const varValue = variables[varName];

      switch (operator) {
        case '==':
          return varValue == value;
        case '!=':
          return varValue != value;
        case '>':
          return Number(varValue) > Number(value);
        case '<':
          return Number(varValue) < Number(value);
        case '>=':
          return Number(varValue) >= Number(value);
        case '<=':
          return Number(varValue) <= Number(value);
        default:
          return Boolean(varValue);
      }
    } catch {
      return false;
    }
  }

  /**
   * Renders the template with provided variables
   * @param variables Variable values
   * @returns Rendered template string
   * @throws {TemplateError} If validation fails
   */
  render(variables: Record<string, unknown>): string {
    // Validate required variables
    Object.entries(this.options.variables).forEach(([name, variable]) => {
      if (variable.required && variables[name] === undefined && variable.defaultValue === undefined) {
        throw new TemplateError(
          `Missing required variable: ${name}`,
          'MISSING_VARIABLE',
          { name }
        );
      }
    });

    // Check for unknown variables if not allowed
    if (!this.options.allowUnknownVariables) {
      Object.keys(variables).forEach(name => {
        if (!this.options.variables[name]) {
          throw new TemplateError(
            `Unknown variable: ${name}`,
            'UNKNOWN_VARIABLE',
            { name }
          );
        }
      });
    }

    // Validate variable types if strict mode is enabled
    if (this.options.strictTypes) {
      Object.entries(variables).forEach(([name, value]) => {
        const variable = this.options.variables[name];
        if (variable && !this.validateVariableValue(value, variable)) {
          throw new TemplateError(
            `Invalid type for variable "${name}": expected ${variable.type}`,
            'INVALID_VARIABLE_VALUE',
            { name, value, expectedType: variable.type }
          );
        }
      });
    }

    // Render sections
    let result = '';
    for (const section of this.sections) {
      if (!section.isVariable) {
        result += section.text;
        continue;
      }

      if (!this.resolveConditional(section, variables)) {
        continue;
      }

      const name = section.variableName!;
      const variable = this.options.variables[name];
      let value = variables[name];

      // Use default value if available
      if (value === undefined) {
        value = section.defaultValue ?? variable?.defaultValue;
      }

      // Skip if value is undefined and variable is optional
      if (value === undefined && variable && !variable.required) {
        continue;
      }

      // Convert value to string
      result += this.formatValue(value);
    }

    // Validate length constraints
    if (this.options.maxLength !== undefined && result.length > this.options.maxLength) {
      throw new TemplateError(
        `Template output exceeds maximum length of ${this.options.maxLength}`,
        'MAX_LENGTH_EXCEEDED',
        { length: result.length, maxLength: this.options.maxLength }
      );
    }

    if (this.options.minLength !== undefined && result.length < this.options.minLength) {
      throw new TemplateError(
        `Template output is shorter than minimum length of ${this.options.minLength}`,
        'MIN_LENGTH_NOT_MET',
        { length: result.length, minLength: this.options.minLength }
      );
    }

    return result;
  }

  /**
   * Formats a value for template output
   * @param value Value to format
   * @returns Formatted string
   */
  private formatValue(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }
} 