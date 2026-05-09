// Common test scripts that can be reused across requests

// Test for successful status code (200, 201, 204)
function testSuccessStatus() {
    pm.test("Status code is success", function () {
        pm.expect([200, 201, 204]).to.include(pm.response.code);
    });
}

// Test for error status code (400, 401, 403, 404, 422)
function testErrorStatus() {
    pm.test("Status code is error", function () {
        pm.expect([400, 401, 403, 404, 422]).to.include(pm.response.code);
    });
}

// Test for JSON response
function testJsonResponse() {
    pm.test("Response is JSON", function () {
        pm.response.to.be.json;
    });
}

// Test for response time
function testResponseTime(maxMs) {
    pm.test(`Response time is less than ${maxMs}ms`, function () {
        pm.expect(pm.response.responseTime).to.be.below(maxMs);
    });
}

// Test for required fields in response
function testRequiredFields(fields) {
    pm.test("Response has required fields", function () {
        var jsonData = pm.response.json();
        fields.forEach(function(field) {
            pm.expect(jsonData).to.have.property(field);
        });
    });
}

// Test for no sensitive data in response
function testNoSensitiveData() {
    pm.test("No sensitive data in response", function () {
        var responseText = pm.response.text();
        pm.expect(responseText).to.not.include('password');
        pm.expect(responseText).to.not.include('secret');
        pm.expect(responseText).to.not.include('token');
    });
}

// Test for proper error message
function testErrorMessage() {
    pm.test("Error message present", function () {
        var jsonData = pm.response.json();
        pm.expect(jsonData).to.have.property('detail');
    });
}

// Test for pagination headers
function testPaginationHeaders() {
    pm.test("Pagination headers present", function () {
        pm.expect(pm.response.headers).to.have.property('X-Total-Count');
        pm.expect(pm.response.headers).to.have.property('X-Page-Size');
    });
}

// Export functions for use in Postman
// Note: In Postman, these functions would be defined in a collection-level script
// and then called from individual request test scripts
