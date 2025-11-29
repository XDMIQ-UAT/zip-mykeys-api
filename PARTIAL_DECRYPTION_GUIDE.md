# Partial Decryption with Key Chain Support

## Overview

This feature implements hierarchical encryption where related keys from the same key chain can decrypt partial information. This is similar to family history where more information is available about deceased/expired entities compared to living/active ones.

## How It Works

### Key Concepts

1. **Exact Key**: The original token/key that can decrypt everything (100% completeness)
2. **Related Keys**: Keys from the same key chain that can decrypt partial information:
   - **Expired/Deceased Data**: Can be decrypted with related keys (50% completeness)
   - **Living/Active Data**: Requires exact key (not decryptable with related keys)

### Key Chain Identification

Keys are considered "related" if they share the same key chain ID, which is derived from the first 16 bytes of the token hash. This allows keys generated from the same source or family to be identified as related.

## Usage

### Enabling Partial Encryption

Set the environment variable to enable partial encryption:

```bash
export MYKEYS_PARTIAL_DECRYPTION=true
```

Or set it when running commands:

```bash
MYKEYS_PARTIAL_DECRYPTION=true mykeys admin
```

### Managing Related Tokens

Related tokens are stored in `~/.mykeys/related-tokens.json` as a JSON array:

```json
[
  "token1",
  "token2",
  "token3"
]
```

You can manually edit this file or use the CLI commands (see below).

### Data Classification

The system automatically classifies data as expired/deceased or living/active based on:

- **Expired/Deceased**: 
  - `expiresAt`, `expiredAt`, `expirationDate` fields with past dates
  - `status === 'expired'`, `status === 'deceased'`, `status === 'inactive'`
  - `deceased === true`

- **Living/Active**:
  - `status === 'active'`, `status === 'living'`
  - `active === true`

- **Unknown**: Defaults to living/active (requires exact key)

### Custom Data Classifier

You can provide a custom classifier function when encrypting:

```javascript
const { encryptWithPartialSupport } = require('./partial-decryption');

const customClassifier = (item) => {
  if (item.type === 'historical') return 'expired';
  if (item.type === 'current') return 'living';
  return 'unknown';
};

const encrypted = encryptWithPartialSupport(data, token, customClassifier);
```

## Decryption Behavior

### With Exact Key

- Decrypts everything (100% completeness)
- All expired and living data accessible

### With Related Key

- Decrypts expired/deceased data (50% completeness)
- Cannot decrypt living/active data
- Shows warning: `⚠️  Partial decryption: 50% complete (expired/deceased)`

### Decryption Process

1. Try exact key first (full decryption)
2. If exact key fails, try partial decryption with current token
3. If still incomplete, try related tokens from `related-tokens.json`
4. Return best available result with completeness percentage

## Example Scenarios

### Scenario 1: Family History

```javascript
const familyData = {
  grandfather: {
    name: "John Doe",
    birthDate: "1920-01-01",
    deathDate: "1990-01-01",
    status: "deceased"
  },
  father: {
    name: "Jane Doe",
    birthDate: "1950-01-01",
    status: "living"
  }
};

// Encrypt with exact key
const encrypted = encryptWithPartialSupport(familyData, exactToken);

// Decrypt with related key (family member's key)
const result = decryptWithPartialSupport(encrypted, relatedToken);

// Result: Can access grandfather's info, but not father's
// result.data = { grandfather: {...} }
// result.completeness = 50
```

### Scenario 2: Expired vs Active Sessions

```javascript
const sessionData = {
  expiredSessions: [
    { id: 1, expiresAt: "2020-01-01", data: "..." },
    { id: 2, expiresAt: "2021-01-01", data: "..." }
  ],
  activeSessions: [
    { id: 3, expiresAt: "2025-12-31", data: "..." },
    { id: 4, expiresAt: "2026-01-01", data: "..." }
  ]
};

// With related key, can only decrypt expiredSessions
```

## API Reference

### `encryptWithPartialSupport(data, token, dataClassifier)`

Encrypts data with partial decryption support.

**Parameters:**
- `data` (object): Data to encrypt
- `token` (string): Encryption token
- `dataClassifier` (function, optional): Custom classifier function

**Returns:**
- Object with `encrypted`, `iv`, `partial.expired`, `partial.living`, `metadata`

### `decryptWithPartialSupport(encryptedData, token, relatedTokens)`

Decrypts data with partial decryption support.

**Parameters:**
- `encryptedData` (object): Encrypted data object
- `token` (string): Decryption token
- `relatedTokens` (array, optional): Array of related tokens to try

**Returns:**
- Object with `success`, `data`, `completeness`, `decryptedPortions`, `errors`

### `areKeysRelated(token1, token2)`

Checks if two tokens belong to the same key chain.

**Returns:** `boolean`

### `getKeyChainId(token)`

Gets the key chain identifier for a token.

**Returns:** `string` (16-character hex)

## Security Considerations

1. **Key Chain Identification**: Keys are considered related based on hash prefix, which provides reasonable security while allowing family relationships.

2. **Living Data Protection**: Living/active data always requires the exact key, providing strong protection for sensitive current information.

3. **Expired Data Access**: Expired/deceased data can be accessed with related keys, which is appropriate for historical information.

4. **Backward Compatibility**: Standard encryption (without partial support) remains fully supported for backward compatibility.

## Troubleshooting

### "Partial decryption: 50% complete"

This means you're using a related key instead of the exact key. You can:
- Use the exact key for full access
- Accept partial access (expired data only)

### "Failed to decrypt session data"

- Verify your token is correct
- Check if related tokens are properly configured
- Ensure the data was encrypted with partial encryption enabled

### Related tokens not working

- Verify tokens are in the same key chain using `areKeysRelated()`
- Check `~/.mykeys/related-tokens.json` format
- Ensure tokens haven't expired

## Future Enhancements

- CLI commands for managing related tokens
- Automatic key chain discovery
- Configurable classification rules
- Support for multiple key chain levels (grandparent, parent, child)




