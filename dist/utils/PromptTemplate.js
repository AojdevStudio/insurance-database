export class TemplateError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'TemplateError';
    }
}
export class PromptTemplate {
    template;
    options;
    sections = [];
    variablePattern = /\{\{([^}]+)\}\}|\{([^}]+)\}|\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
    constructor(template, options) {
        this.template = template;
        this.options = options;
        this.validateOptions();
        this.sections = this.parse();
    }
    validateOptions() {
        if (!this.options.variables || typeof this.options.variables !== 'object') {
            throw new TemplateError('Template options must include variables object', 'INVALID_OPTIONS');
        }
        Object.entries(this.options.variables).forEach(([name, variable]) => {
            if (!variable.type || !['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
                throw new TemplateError(`Invalid type for variable "${name}": ${variable.type}`, 'INVALID_VARIABLE_TYPE', { name, type: variable.type });
            }
            if (variable.defaultValue !== undefined) {
                if (!this.validateVariableValue(variable.defaultValue, variable)) {
                    throw new TemplateError(`Default value for "${name}" does not match type ${variable.type}`, 'INVALID_DEFAULT_VALUE', { name, value: variable.defaultValue, type: variable.type });
                }
            }
        });
    }
    parse() {
        const sections = [];
        let lastIndex = 0;
        let match;
        while ((match = this.variablePattern.exec(this.template)) !== null) {
            if (match.index > lastIndex) {
                sections.push({
                    text: this.template.slice(lastIndex, match.index),
                    isVariable: false
                });
            }
            const variableName = match[1] || match[2] || match[3];
            const [name, ...modifiers] = variableName.split('|').map(s => s.trim());
            const section = {
                text: match[0],
                isVariable: true,
                variableName: name
            };
            modifiers.forEach(modifier => {
                if (modifier.startsWith('default=')) {
                    section.defaultValue = this.parseDefaultValue(modifier.slice(8));
                }
                else if (modifier === 'optional') {
                    const variable = this.options.variables[name];
                    if (variable) {
                        variable.required = false;
                    }
                }
                else if (modifier.startsWith('if=')) {
                    section.conditional = true;
                    section.condition = modifier.slice(3);
                }
            });
            sections.push(section);
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < this.template.length) {
            sections.push({
                text: this.template.slice(lastIndex),
                isVariable: false
            });
        }
        return sections;
    }
    parseDefaultValue(value) {
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    validateVariableValue(value, variable) {
        if (value === undefined || value === null) {
            return !variable.required;
        }
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
    resolveConditional(section, variables) {
        if (!section.conditional || !section.condition) {
            return true;
        }
        try {
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
        }
        catch {
            return false;
        }
    }
    render(variables) {
        Object.entries(this.options.variables).forEach(([name, variable]) => {
            if (variable.required && variables[name] === undefined && variable.defaultValue === undefined) {
                throw new TemplateError(`Missing required variable: ${name}`, 'MISSING_VARIABLE', { name });
            }
        });
        if (!this.options.allowUnknownVariables) {
            Object.keys(variables).forEach(name => {
                if (!this.options.variables[name]) {
                    throw new TemplateError(`Unknown variable: ${name}`, 'UNKNOWN_VARIABLE', { name });
                }
            });
        }
        if (this.options.strictTypes) {
            Object.entries(variables).forEach(([name, value]) => {
                const variable = this.options.variables[name];
                if (variable && !this.validateVariableValue(value, variable)) {
                    throw new TemplateError(`Invalid type for variable "${name}": expected ${variable.type}`, 'INVALID_VARIABLE_VALUE', { name, value, expectedType: variable.type });
                }
            });
        }
        let result = '';
        for (const section of this.sections) {
            if (!section.isVariable) {
                result += section.text;
                continue;
            }
            if (!this.resolveConditional(section, variables)) {
                continue;
            }
            const name = section.variableName;
            const variable = this.options.variables[name];
            let value = variables[name];
            if (value === undefined) {
                value = section.defaultValue ?? variable?.defaultValue;
            }
            if (value === undefined && variable && !variable.required) {
                continue;
            }
            result += this.formatValue(value);
        }
        if (this.options.maxLength !== undefined && result.length > this.options.maxLength) {
            throw new TemplateError(`Template output exceeds maximum length of ${this.options.maxLength}`, 'MAX_LENGTH_EXCEEDED', { length: result.length, maxLength: this.options.maxLength });
        }
        if (this.options.minLength !== undefined && result.length < this.options.minLength) {
            throw new TemplateError(`Template output is shorter than minimum length of ${this.options.minLength}`, 'MIN_LENGTH_NOT_MET', { length: result.length, minLength: this.options.minLength });
        }
        return result;
    }
    formatValue(value) {
        if (value === undefined || value === null) {
            return '';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }
}
//# sourceMappingURL=PromptTemplate.js.map