# UI/UX Fixes Needed

Based on Playwright test results, here are the UI/UX issues that need to be fixed:

## Failed Tests Summary

### 1. MCP Config Generator - Path Auto-population
**Issue:** Path not auto-populating when "Download from mykeys.zip" is selected
- **Test:** `should auto-populate path when "Download from mykeys.zip" is selected`
- **Error:** Path value is empty when it should be populated
- **Files to check:** `public/mcp-config-generator.html`

### 2. MCP Config Generator - Config Generation
**Issue:** Config not generating with hosted option
- **Test:** `should generate config with hosted option`
- **Error:** Timeout waiting for `#configResult.show`
- **Files to check:** `public/mcp-config-generator.html`

### 3. MCP Config Generator - Download Instructions
**Issue:** Help text doesn't contain expected "Download Instructions" text
- **Test:** `should show download instructions for hosted option`
- **Error:** Expected "Download Instructions" but got different help text
- **Files to check:** `public/mcp-config-generator.html`

### 4. MCP Config Generator - Switching Between Hosted/Local
**Issue:** Path not updating when switching between hosted and local
- **Test:** `should allow switching between hosted and local`
- **Error:** Path remains empty when switching to hosted
- **Files to check:** `public/mcp-config-generator.html`

### 5. MCP Config Generator - Validation Alert
**Issue:** Alert not showing when submitting without path
- **Test:** `should show alert when submitting without path`
- **Error:** Alert message is null
- **Files to check:** `public/mcp-config-generator.html`

### 6. Token Generation - Partial Password Verification
**Issue:** Multiple elements with same text causing selector ambiguity
- **Test:** `should verify partial password and show step 2`
- **Error:** Locator resolved to 2 elements (strict mode violation)
- **Files to check:** `public/generate-token.html`
- **Fix:** Use more specific selector (e.g., `#resultTitle` or `h3`)

### 7. Token Generation - Token Generation Flow
**Issue:** Authentication failing in test (may be test data issue)
- **Test:** `should generate token with valid credentials`
- **Error:** "Authentication failed. Please verify your partial password again."
- **Files to check:** `public/generate-token.html`, `tests/e2e/token-generation.spec.js`
- **Note:** May need to update test with correct credentials

### 8. Token Generation - Back Button
**Issue:** Back button not found or not working
- **Test:** `should allow going back to step 1`
- **Error:** Timeout waiting for back button
- **Files to check:** `public/generate-token.html`
- **Fix:** Check if back button exists and has correct text/selector

### 9. Token Generation - Architect Code Expiration
**Issue:** Error message not showing for expired architect code
- **Test:** `should show error when architect code is missing or expired`
- **Error:** Timeout waiting for error message
- **Files to check:** `public/generate-token.html`
- **Fix:** Ensure error handling displays error messages correctly

## Priority Fixes

### High Priority (Core Functionality)
1. **Token Generation - Partial Password Verification** - Fix selector ambiguity
2. **Token Generation - Back Button** - Ensure back navigation works
3. **MCP Config Generator - Path Auto-population** - Critical for UX

### Medium Priority (UX Improvements)
4. **MCP Config Generator - Config Generation** - Should work smoothly
5. **MCP Config Generator - Validation Alerts** - Better user feedback
6. **Token Generation - Error Messages** - Clear error display

### Low Priority (Test Updates)
7. **Token Generation - Test Credentials** - May need test data updates
8. **MCP Config Generator - Help Text** - Update test expectations or help text

## Files to Review

- `public/mcp-config-generator.html` - MCP config generator UI
- `public/generate-token.html` - Token generation UI
- `tests/e2e/config-generator.spec.js` - Config generator tests
- `tests/e2e/token-generation.spec.js` - Token generation tests

## Next Steps

1. Review each failing test
2. Fix UI/UX issues in HTML files
3. Update test selectors if UI changed
4. Re-run tests: `npm test`
5. Verify fixes work in browser manually





