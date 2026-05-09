// Pre-request script for data setup
// This script can be used to set up test data before running requests

// Function to generate a random test email
function generateTestEmail() {
    const timestamp = Date.now();
    return `test${timestamp}@example.com`;
}

// Function to generate a random test username
function generateTestUsername() {
    const timestamp = Date.now();
    return `testuser${timestamp}`;
}

// Function to set current timestamp
function setTimestamp() {
    pm.environment.set("timestamp", Date.now());
}

// Function to reset test IDs to default values
function resetTestIds() {
    pm.environment.set("testUserId", "1");
    pm.environment.set("testProjectId", "1");
    pm.environment.set("testSuiteId", "1");
    pm.environment.set("testCaseId", "1");
    pm.environment.set("testStepId", "1");
    pm.environment.set("testRunId", "1");
    pm.environment.set("testResultId", "1");
    pm.environment.set("requirementId", "1");
    pm.environment.set("defectId", "1");
    pm.environment.set("testPlanId", "1");
    pm.environment.set("milestoneId", "1");
    pm.environment.set("customFieldId", "1");
    pm.environment.set("notificationId", "1");
    pm.environment.set("auditTrailId", "1");
    pm.environment.set("versionId", "1");
}

// Function to check if access token is valid
function checkAccessToken() {
    const token = pm.environment.get("accessToken");
    if (!token || token === "") {
        console.log("No access token found. Please run the Login request first.");
    }
}

// Function to refresh access token if expired
function refreshAccessToken() {
    const refreshToken = pm.environment.get("refreshToken");
    if (refreshToken && refreshToken !== "") {
        // This would typically make a request to refresh the token
        // For now, just log a message
        console.log("Refresh token available. Consider refreshing access token.");
    }
}

// Execute setup functions based on request name
const requestName = pm.request.name;

if (requestName.includes("Register")) {
    pm.environment.set("testEmail", generateTestEmail());
    pm.environment.set("testUsername", generateTestUsername());
}

if (requestName.includes("Setup") || requestName.includes("Reset")) {
    resetTestIds();
}

// Always check access token for authenticated requests
if (requestName !== "Register" && requestName !== "Login") {
    checkAccessToken();
}
