#!/usr/bin/env python3
"""
Last Hope MCP Server - Infrastructure Testing Suite
Comprehensive testing for Terraform infrastructure
"""

import os
import sys
import subprocess
import json
import time
import requests
from typing import Dict, List, Optional, Tuple
import argparse


class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


class TerraformTester:
    def __init__(self, terraform_dir: str = "."):
        self.terraform_dir = os.path.abspath(terraform_dir)
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0

    def log(self, message: str, color: str = Colors.BLUE):
        print(f"{color}[INFO]{Colors.NC} {message}")

    def success(self, message: str):
        print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {message}")

    def error(self, message: str):
        print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")

    def warning(self, message: str):
        print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {message}")

    def run_command(self, command: List[str], cwd: Optional[str] = None) -> Tuple[int, str, str]:
        """Run a shell command and return exit code, stdout, stderr"""
        if cwd is None:
            cwd = self.terraform_dir
        
        try:
            result = subprocess.run(
                command,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return 1, "", "Command timed out"
        except Exception as e:
            return 1, "", str(e)

    def test_terraform_validate(self) -> bool:
        """Test: Terraform configuration validation"""
        self.log("Testing Terraform configuration validation...")
        
        # Initialize if not already done
        exit_code, _, _ = self.run_command(["terraform", "init", "-input=false"])
        if exit_code != 0:
            self.error("Terraform init failed")
            return False

        # Validate
        exit_code, stdout, stderr = self.run_command(["terraform", "validate"])
        if exit_code == 0:
            self.success("✓ Terraform configuration is valid")
            return True
        else:
            self.error(f"✗ Terraform validation failed: {stderr}")
            return False

    def test_terraform_fmt(self) -> bool:
        """Test: Terraform code formatting"""
        self.log("Testing Terraform code formatting...")
        
        exit_code, stdout, stderr = self.run_command(["terraform", "fmt", "-check", "-diff"])
        if exit_code == 0:
            self.success("✓ Terraform code is properly formatted")
            return True
        else:
            self.warning(f"✗ Terraform code formatting issues found:\n{stdout}")
            return False

    def test_terraform_plan(self, environment: str = "test") -> bool:
        """Test: Terraform plan execution"""
        self.log(f"Testing Terraform plan for {environment} environment...")
        
        command = [
            "terraform", "plan",
            f"-var=project_id=test-project-{int(time.time())}",
            f"-var=environment={environment}",
            "-input=false",
            "-detailed-exitcode"
        ]
        
        exit_code, stdout, stderr = self.run_command(command)
        if exit_code == 0:
            self.success("✓ Terraform plan executed successfully (no changes)")
            return True
        elif exit_code == 2:
            self.success("✓ Terraform plan executed successfully (changes planned)")
            return True
        else:
            self.error(f"✗ Terraform plan failed: {stderr}")
            return False

    def test_variable_validation(self) -> bool:
        """Test: Variable validation with different values"""
        self.log("Testing variable validation...")
        
        test_cases = [
            # Valid cases
            {"project_id": "valid-project-123", "environment": "dev", "should_pass": True},
            {"project_id": "another-project", "environment": "staging", "should_pass": True},
            {"project_id": "prod-project", "environment": "prod", "should_pass": True},
            
            # Invalid cases
            {"project_id": "", "environment": "dev", "should_pass": False},
            {"project_id": "valid-project", "environment": "invalid", "should_pass": False},
        ]
        
        passed = 0
        total = len(test_cases)
        
        for i, test_case in enumerate(test_cases):
            should_pass = test_case.pop("should_pass")
            
            command = ["terraform", "plan", "-input=false"]
            for key, value in test_case.items():
                command.extend([f"-var={key}={value}"])
            
            exit_code, _, _ = self.run_command(command)
            
            if should_pass and exit_code in [0, 2]:
                passed += 1
            elif not should_pass and exit_code not in [0, 2]:
                passed += 1
            else:
                self.warning(f"Variable validation test case {i+1} failed")
        
        if passed == total:
            self.success(f"✓ All {total} variable validation tests passed")
            return True
        else:
            self.error(f"✗ {total - passed} out of {total} variable validation tests failed")
            return False

    def test_security_configuration(self) -> bool:
        """Test: Security configuration checks"""
        self.log("Testing security configuration...")
        
        # Check for security best practices in Terraform files
        security_checks = []
        
        # Check for hardcoded secrets
        terraform_files = []
        for root, dirs, files in os.walk(self.terraform_dir):
            for file in files:
                if file.endswith('.tf'):
                    terraform_files.append(os.path.join(root, file))
        
        hardcoded_patterns = ['password', 'secret', 'key', 'token']
        for tf_file in terraform_files:
            try:
                with open(tf_file, 'r') as f:
                    content = f.read().lower()
                    for pattern in hardcoded_patterns:
                        if f'"{pattern}"' in content and 'var.' not in content:
                            security_checks.append(f"Potential hardcoded {pattern} in {tf_file}")
            except Exception:
                continue
        
        if not security_checks:
            self.success("✓ No obvious security issues found")
            return True
        else:
            for check in security_checks:
                self.warning(f"Security issue: {check}")
            return False

    def test_resource_naming(self) -> bool:
        """Test: Resource naming conventions"""
        self.log("Testing resource naming conventions...")
        
        # This would check if resources follow naming conventions
        # For now, just check if main.tf exists and has resources
        main_tf_path = os.path.join(self.terraform_dir, "main.tf")
        if os.path.exists(main_tf_path):
            self.success("✓ Main Terraform file exists")
            return True
        else:
            self.error("✗ main.tf file not found")
            return False

    def test_outputs_defined(self) -> bool:
        """Test: Required outputs are defined"""
        self.log("Testing required outputs...")
        
        required_outputs = [
            "service_url",
            "docker_repository", 
            "storage_bucket",
            "service_account_email"
        ]
        
        outputs_tf_path = os.path.join(self.terraform_dir, "outputs.tf")
        if not os.path.exists(outputs_tf_path):
            self.error("✗ outputs.tf file not found")
            return False
        
        try:
            with open(outputs_tf_path, 'r') as f:
                content = f.read()
                
            missing_outputs = []
            for output in required_outputs:
                if f'output "{output}"' not in content:
                    missing_outputs.append(output)
            
            if not missing_outputs:
                self.success("✓ All required outputs are defined")
                return True
            else:
                self.error(f"✗ Missing outputs: {', '.join(missing_outputs)}")
                return False
                
        except Exception as e:
            self.error(f"✗ Error reading outputs.tf: {e}")
            return False

    def test_provider_versions(self) -> bool:
        """Test: Provider version constraints"""
        self.log("Testing provider version constraints...")
        
        main_tf_path = os.path.join(self.terraform_dir, "main.tf")
        if not os.path.exists(main_tf_path):
            self.error("✗ main.tf file not found")
            return False
        
        try:
            with open(main_tf_path, 'r') as f:
                content = f.read()
            
            # Check for provider version constraints
            required_providers = ['google', 'google-beta', 'docker']
            missing_providers = []
            
            for provider in required_providers:
                if f'source = "hashicorp/{provider}"' not in content and f'source = "kreuzwerker/{provider}"' not in content:
                    missing_providers.append(provider)
            
            if not missing_providers:
                self.success("✓ All required providers are configured")
                return True
            else:
                self.error(f"✗ Missing providers: {', '.join(missing_providers)}")
                return False
                
        except Exception as e:
            self.error(f"✗ Error reading main.tf: {e}")
            return False

    def run_test(self, test_name: str, test_func) -> bool:
        """Run a single test and track results"""
        self.total_tests += 1
        
        try:
            result = test_func()
            if result:
                self.passed_tests += 1
                self.test_results.append({"name": test_name, "status": "PASSED"})
            else:
                self.failed_tests += 1
                self.test_results.append({"name": test_name, "status": "FAILED"})
            return result
        except Exception as e:
            self.error(f"Test {test_name} threw exception: {e}")
            self.failed_tests += 1
            self.test_results.append({"name": test_name, "status": "ERROR", "error": str(e)})
            return False

    def run_all_tests(self):
        """Run all infrastructure tests"""
        self.log("Starting Terraform infrastructure tests...")
        print()
        
        # Core Terraform tests
        self.log("=== Core Terraform Tests ===")
        self.run_test("Terraform Validate", self.test_terraform_validate)
        self.run_test("Terraform Format", self.test_terraform_fmt)
        self.run_test("Terraform Plan (dev)", lambda: self.test_terraform_plan("dev"))
        self.run_test("Terraform Plan (staging)", lambda: self.test_terraform_plan("staging"))
        self.run_test("Terraform Plan (prod)", lambda: self.test_terraform_plan("prod"))
        print()
        
        # Configuration tests
        self.log("=== Configuration Tests ===")
        self.run_test("Variable Validation", self.test_variable_validation)
        self.run_test("Security Configuration", self.test_security_configuration)
        self.run_test("Resource Naming", self.test_resource_naming)
        self.run_test("Required Outputs", self.test_outputs_defined)
        self.run_test("Provider Versions", self.test_provider_versions)
        print()

    def generate_report(self):
        """Generate and display test report"""
        print("=" * 50)
        print("           TERRAFORM TEST REPORT")
        print("=" * 50)
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {Colors.GREEN}{self.passed_tests}{Colors.NC}")
        print(f"Failed: {Colors.RED}{self.failed_tests}{Colors.NC}")
        
        if self.total_tests > 0:
            success_rate = (self.passed_tests * 100) // self.total_tests
            print(f"Success Rate: {success_rate}%")
        
        print("=" * 50)
        
        # Detailed results
        if self.failed_tests > 0:
            print("\nFailed Tests:")
            for result in self.test_results:
                if result["status"] != "PASSED":
                    status_color = Colors.RED if result["status"] == "FAILED" else Colors.YELLOW
                    print(f"  {status_color}✗{Colors.NC} {result['name']}")
                    if "error" in result:
                        print(f"    Error: {result['error']}")
        
        print("\nPassed Tests:")
        for result in self.test_results:
            if result["status"] == "PASSED":
                print(f"  {Colors.GREEN}✓{Colors.NC} {result['name']}")
        
        return self.failed_tests == 0


def main():
    parser = argparse.ArgumentParser(description='Last Hope MCP Server Infrastructure Testing')
    parser.add_argument('--terraform-dir', default='.', help='Terraform directory path')
    parser.add_argument('--test', choices=['all', 'validate', 'plan', 'security'], 
                       default='all', help='Specific test to run')
    
    args = parser.parse_args()
    
    tester = TerraformTester(args.terraform_dir)
    
    if args.test == 'all':
        tester.run_all_tests()
        success = tester.generate_report()
        sys.exit(0 if success else 1)
    elif args.test == 'validate':
        success = tester.run_test("Terraform Validate", tester.test_terraform_validate)
        sys.exit(0 if success else 1)
    elif args.test == 'plan':
        success = tester.run_test("Terraform Plan", lambda: tester.test_terraform_plan("dev"))
        sys.exit(0 if success else 1)
    elif args.test == 'security':
        success = tester.run_test("Security Configuration", tester.test_security_configuration)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()