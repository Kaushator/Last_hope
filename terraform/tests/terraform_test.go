package test

import (
	"testing"
	"time"

	"github.com/gruntwork-io/terratest/modules/gcp"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

// TestTerraformGCPLastHope tests the complete Terraform configuration
func TestTerraformGCPLastHope(t *testing.T) {
	t.Parallel()

	// Configuration for Terratest
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		// Path to the Terraform code that will be tested
		TerraformDir: "../",

		// Variables to pass to the Terraform code using -var options
		Vars: map[string]interface{}{
			"project_id":  "test-project-" + randomString(8),
			"region":      "us-central1",
			"environment": "test",
		},

		// Disable colors in Terraform output
		NoColor: true,
	})

	// Clean up resources with "terraform destroy" at the end of the test
	defer terraform.Destroy(t, terraformOptions)

	// Run "terraform init" and "terraform apply"
	terraform.InitAndApply(t, terraformOptions)

	// Test outputs
	testTerraformOutputs(t, terraformOptions)
}

// TestTerraformValidation tests Terraform configuration validation
func TestTerraformValidation(t *testing.T) {
	terraformOptions := &terraform.Options{
		TerraformDir: "../",
	}

	// Run terraform validate
	terraform.Init(t, terraformOptions)
	terraform.Validate(t, terraformOptions)
}

// TestTerraformPlan tests Terraform plan
func TestTerraformPlan(t *testing.T) {
	terraformOptions := &terraform.Options{
		TerraformDir: "../",
		Vars: map[string]interface{}{
			"project_id":  "test-project-" + randomString(8),
			"region":      "us-central1",
			"environment": "test",
		},
	}

	terraform.Init(t, terraformOptions)
	terraform.Plan(t, terraformOptions)
}

// testTerraformOutputs tests all expected outputs
func testTerraformOutputs(t *testing.T, terraformOptions *terraform.Options) {
	// Test service URL output
	serviceURL := terraform.Output(t, terraformOptions, "service_url")
	assert.NotEmpty(t, serviceURL)
	assert.Contains(t, serviceURL, "run.app")

	// Test docker repository output
	dockerRepo := terraform.Output(t, terraformOptions, "docker_repository")
	assert.NotEmpty(t, dockerRepo)
	assert.Contains(t, dockerRepo, "docker.pkg.dev")

	// Test storage bucket output
	storageBucket := terraform.Output(t, terraformOptions, "storage_bucket")
	assert.NotEmpty(t, storageBucket)

	// Test secret names
	htxSecret := terraform.Output(t, terraformOptions, "htx_secret_name")
	assert.NotEmpty(t, htxSecret)
	assert.Contains(t, htxSecret, "htx-api-key")

	fernetSecret := terraform.Output(t, terraformOptions, "fernet_secret_name")
	assert.NotEmpty(t, fernetSecret)
	assert.Contains(t, fernetSecret, "fernet-encryption-key")

	// Test service account
	serviceAccount := terraform.Output(t, terraformOptions, "service_account_email")
	assert.NotEmpty(t, serviceAccount)
	assert.Contains(t, serviceAccount, "gserviceaccount.com")
}

// TestCloudRunService tests the Cloud Run service specifically
func TestCloudRunService(t *testing.T) {
	projectID := gcp.GetGoogleProjectIDFromEnvVar(t)
	region := "us-central1"

	terraformOptions := &terraform.Options{
		TerraformDir: "../",
		Vars: map[string]interface{}{
			"project_id":  projectID,
			"region":      region,
			"environment": "test",
		},
	}

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	serviceName := terraform.Output(t, terraformOptions, "service_name")
	
	// Verify the Cloud Run service exists
	service := gcp.GetCloudRunService(t, projectID, serviceName, region)
	assert.Equal(t, serviceName, service.Name)
	assert.Equal(t, region, service.Location)
}

// TestSecretManager tests Secret Manager integration
func TestSecretManager(t *testing.T) {
	projectID := gcp.GetGoogleProjectIDFromEnvVar(t)

	terraformOptions := &terraform.Options{
		TerraformDir: "../",
		Vars: map[string]interface{}{
			"project_id":  projectID,
			"environment": "test",
		},
	}

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Test secret creation
	htxSecret := terraform.Output(t, terraformOptions, "htx_secret_name")
	
	// Verify secret exists (this would require additional GCP client setup)
	assert.NotEmpty(t, htxSecret)
}

// TestStorageBucket tests Cloud Storage bucket
func TestStorageBucket(t *testing.T) {
	projectID := gcp.GetGoogleProjectIDFromEnvVar(t)

	terraformOptions := &terraform.Options{
		TerraformDir: "../",
		Vars: map[string]interface{}{
			"project_id":  projectID,
			"environment": "test",
		},
	}

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	bucketName := terraform.Output(t, terraformOptions, "storage_bucket")
	
	// Verify bucket exists and has correct configuration
	assert.NotEmpty(t, bucketName)
	
	// Test bucket accessibility (would require GCS client)
	// bucket := storage.NewClient(context.Background())
}

// TestEnvironmentSpecificConfig tests environment-specific configurations
func TestEnvironmentSpecificConfig(t *testing.T) {
	environments := []string{"dev", "staging", "prod"}

	for _, env := range environments {
		t.Run(env, func(t *testing.T) {
			terraformOptions := &terraform.Options{
				TerraformDir: "../",
				Vars: map[string]interface{}{
					"project_id":  "test-project-" + randomString(8),
					"environment": env,
				},
			}

			terraform.Init(t, terraformOptions)
			plan := terraform.Plan(t, terraformOptions)
			
			// Verify environment-specific resources are planned
			assert.Contains(t, plan, env)
		})
	}
}

// TestSecurityConfiguration tests security-related configurations
func TestSecurityConfiguration(t *testing.T) {
	terraformOptions := &terraform.Options{
		TerraformDir: "../",
		Vars: map[string]interface{}{
			"project_id":       "test-project-" + randomString(8),
			"environment":      "prod",
			"enable_public_access": false,
		},
	}

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Test that public access is properly configured
	// This would require checking the actual IAM bindings
}

// TestMonitoringAlerts tests monitoring and alerting configuration
func TestMonitoringAlerts(t *testing.T) {
	terraformOptions := &terraform.Options{
		TerraformDir: "../",
		Vars: map[string]interface{}{
			"project_id":        "test-project-" + randomString(8),
			"enable_monitoring": true,
		},
	}

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Verify monitoring alerts are created
	// This would require GCP monitoring client to verify
}

// TestFeatureFlags tests various feature flag combinations
func TestFeatureFlags(t *testing.T) {
	testCases := []struct {
		name string
		vars map[string]interface{}
	}{
		{
			name: "all_features_enabled",
			vars: map[string]interface{}{
				"project_id":        "test-project-" + randomString(8),
				"enable_monitoring": true,
				"enable_logging":    true,
				"enable_secrets":    true,
			},
		},
		{
			name: "minimal_features",
			vars: map[string]interface{}{
				"project_id":        "test-project-" + randomString(8),
				"enable_monitoring": false,
				"enable_logging":    false,
				"enable_secrets":    true,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			terraformOptions := &terraform.Options{
				TerraformDir: "../",
				Vars:         tc.vars,
			}

			terraform.Init(t, terraformOptions)
			plan := terraform.Plan(t, terraformOptions)
			
			// Verify plan contains expected resources based on feature flags
			assert.NotEmpty(t, plan)
		})
	}
}

// Helper function to generate random strings
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}