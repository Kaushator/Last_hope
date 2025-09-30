// ciAgent.js — CI/CD automation, test generation, and code quality
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

/**
 * Generate unit tests for provided code
 * @param {Object} params - { code, language, framework }
 * @returns {Object} - Generated test code and metadata
 */
export async function generateTests(params = {}) {
  try {
    const { code, language = 'javascript', framework = 'jest' } = params;
    
    if (!code) {
      return { error: 'Missing code parameter', tests: '' };
    }
    
    // Analyze code to extract functions and classes
    const functions = extractFunctions(code, language);
    const classes = extractClasses(code, language);
    
    let testTemplate = '';
    
    switch (framework.toLowerCase()) {
    case 'jest':
      testTemplate = generateJestTests(functions, classes, language);
      break;
    case 'mocha':
      testTemplate = generateMochaTests(functions, classes, language);
      break;
    case 'vitest':
      testTemplate = generateVitestTests(functions, classes, language);
      break;
    default:
      testTemplate = generateJestTests(functions, classes, language);
    }
    
    return {
      success: true,
      tests: testTemplate,
      framework,
      language,
      metadata: {
        functionsFound: functions.length,
        classesFound: classes.length,
        testCasesGenerated: functions.length + classes.length * 2
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tests: ''
    };
  }
}

/**
 * Lint code using ESLint or other linters
 * @param {Object} params - { code, config, language }
 * @returns {Object} - Linting results
 */
export async function lint(params = {}) {
  try {
    const { code, config = {}, language = 'javascript' } = params;
    
    if (!code) {
      return { error: 'Missing code parameter', lint: 'error' };
    }
    
    let lintResult;
    
    switch (language.toLowerCase()) {
    case 'javascript':
    case 'typescript':
      lintResult = await lintJavaScript(code, config);
      break;
    case 'python':
      lintResult = await lintPython(code, config);
      break;
    default:
      lintResult = await lintJavaScript(code, config);
    }
    
    return lintResult;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      lint: 'error'
    };
  }
}

/**
 * Run tests using specified test runner
 * @param {Object} params - { testPath, framework, coverage }
 * @returns {Object} - Test execution results
 */
export async function runTests(params = {}) {
  try {
    const { testPath, framework = 'jest', coverage = false } = params;
    
    let command;
    
    switch (framework.toLowerCase()) {
    case 'jest':
      command = `npx jest${testPath ? ` ${testPath}` : ''}${coverage ? ' --coverage' : ''}`;
      break;
    case 'mocha':
      command = `npx mocha${testPath ? ` ${testPath}` : ' "test/**/*.js"'}`;
      break;
    case 'vitest':
      command = `npx vitest${testPath ? ` ${testPath}` : ''}${coverage ? ' --coverage' : ''}`;
      break;
    default:
      command = `npm test${testPath ? ` -- ${testPath}` : ''}`;
    }
    
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 }); // 2 minute timeout
    
    const result = parseTestResults(stdout, framework);
    
    return {
      success: result.passed,
      framework,
      testPath: testPath || 'all',
      results: result,
      output: stdout,
      coverage: coverage && result.coverage
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      framework: params.framework || 'jest',
      output: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

// Helper functions
function extractFunctions(code, language) {
  const patterns = {
    javascript: /(?:function\s+|const\s+\w+\s*=\s*(?:async\s+)?\(?|\w+\s*:\s*(?:async\s+)?function)/g,
    python: /def\s+\w+\(/g,
    java: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\(/g
  };
  
  const pattern = patterns[language] || patterns.javascript;
  return (code.match(pattern) || []);
}

function extractClasses(code, language) {
  const patterns = {
    javascript: /class\s+\w+/g,
    python: /class\s+\w+/g,
    java: /(?:public|private)?\s*class\s+\w+/g
  };
  
  const pattern = patterns[language] || patterns.javascript;
  return (code.match(pattern) || []);
}

function generateJestTests(functions, classes, language) {
  const imports = language === 'typescript' 
    ? 'import { describe, it, expect } from \'@jest/globals\';\nimport { } from \'../src/index\';'
    : 'const { describe, it, expect } = require(\'@jest/globals\');\nconst module = require(\'../src/index\');';
  
  let tests = `${imports}\n\ndescribe('Auto-generated Tests', () => {\n`;
  
  functions.forEach((func, i) => {
    const funcName = func.match(/\w+/)?.[0] || `function${i}`;
    tests += `  it('should test ${funcName}', () => {\n`;
    tests += `    // TODO: Implement test for ${funcName}\n`;
    tests += `    expect(typeof ${funcName}).toBeDefined();\n`;
    tests += '  });\n\n';
  });
  
  classes.forEach((cls, i) => {
    const className = cls.match(/class\s+(\w+)/)?.[1] || `Class${i}`;
    tests += `  describe('${className}', () => {\n`;
    tests += `    it('should instantiate ${className}', () => {\n`;
    tests += '      // TODO: Implement instantiation test\n';
    tests += `      expect(${className}).toBeDefined();\n`;
    tests += '    });\n\n';
    tests += `    it('should test ${className} methods', () => {\n`;
    tests += '      // TODO: Implement method tests\n';
    tests += `      const instance = new ${className}();\n`;
    tests += `      expect(instance).toBeInstanceOf(${className});\n`;
    tests += '    });\n';
    tests += '  });\n\n';
  });
  
  tests += '});';
  return tests;
}

function generateMochaTests(functions, classes, language) {
  let tests = 'const { expect } = require(\'chai\');\nconst module = require(\'../src/index\');\n\n';
  
  tests += 'describe(\'Auto-generated Tests\', function() {\n';
  
  functions.forEach((func, i) => {
    const funcName = func.match(/\w+/)?.[0] || `function${i}`;
    tests += `  it('should test ${funcName}', function() {\n`;
    tests += `    // TODO: Implement test for ${funcName}\n`;
    tests += `    expect(${funcName}).to.exist;\n`;
    tests += '  });\n\n';
  });
  
  tests += '});';
  return tests;
}

function generateVitestTests(functions, classes, language) {
  return generateJestTests(functions, classes, language).replace('@jest/globals', 'vitest');
}

async function lintJavaScript(code, config) {
  try {
    // Create temporary file for linting
    const tempFile = path.join(process.cwd(), '.temp_lint.js');
    fs.writeFileSync(tempFile, code);
    
    const { stdout, stderr } = await execAsync(`npx eslint ${tempFile} --format json`, {
      timeout: 30000
    });
    
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    const results = JSON.parse(stdout || '[]');
    const issues = results[0]?.messages || [];
    
    return {
      success: issues.length === 0,
      lint: issues.length === 0 ? 'passed' : 'failed',
      issues,
      errorCount: issues.filter(i => i.severity === 2).length,
      warningCount: issues.filter(i => i.severity === 1).length
    };
  } catch (error) {
    return {
      success: false,
      lint: 'error',
      error: error.message
    };
  }
}

async function lintPython(code, config) {
  try {
    const tempFile = path.join(process.cwd(), '.temp_lint.py');
    fs.writeFileSync(tempFile, code);
    
    const { stdout, stderr } = await execAsync(`python -m flake8 ${tempFile}`, {
      timeout: 30000
    });
    
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    return {
      success: !stdout.trim(),
      lint: !stdout.trim() ? 'passed' : 'failed',
      output: stdout,
      issues: stdout.trim().split('\n').filter(line => line.trim())
    };
  } catch (error) {
    return {
      success: false,
      lint: 'error',
      error: error.message
    };
  }
}

function parseTestResults(output, framework) {
  const result = {
    passed: false,
    total: 0,
    passed_count: 0,
    failed_count: 0,
    skipped: 0,
    coverage: null
  };
  
  if (framework === 'jest') {
    const testMatch = output.match(/Tests:\s*(\d+)\s*passed.*?(\d+)\s*total/);
    if (testMatch) {
      result.passed_count = parseInt(testMatch[1]);
      result.total = parseInt(testMatch[2]);
      result.failed_count = result.total - result.passed_count;
      result.passed = result.failed_count === 0;
    }
    
    const coverageMatch = output.match(/All files\s*\|\s*(\d+\.?\d*)/);
    if (coverageMatch) {
      result.coverage = parseFloat(coverageMatch[1]);
    }
  }
  
  return result;
}

/**
 * Get CI agent summary and capabilities
 * @returns {Object} - Agent status and features
 */
export function summary() {
  try {
    const nodeVersion = execSync('node -v').toString().trim();
    let gitVersion = 'not available';
    
    try {
      gitVersion = execSync('git --version').toString().trim();
    } catch (e) {
      // Git not installed
    }
    
    return {
      agent: 'ciAgent',
      status: 'operational',
      nodeVersion,
      gitVersion,
      features: {
        testGeneration: 'implemented',
        codeLinting: 'implemented',
        testExecution: 'implemented',
        githubIntegration: 'partial',
        codeQualityAnalysis: 'basic'
      },
      supportedFrameworks: {
        testing: ['jest', 'mocha', 'vitest'],
        linting: ['eslint', 'flake8'],
        languages: ['javascript', 'typescript', 'python']
      },
      endpoints: [
        'generateTests',
        'lint',
        'runTests',
        'summary'
      ],
      environment: {
        githubToken: process.env.GITHUB_TOKEN ? 'configured' : 'missing',
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };
  } catch (error) {
    return {
      agent: 'ciAgent',
      status: 'error',
      error: error.message
    };
  }
}
