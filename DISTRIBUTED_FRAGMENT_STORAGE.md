# Distributed Encrypted Fragment Storage

**Date:** 2025-01-28  
**Status:** ✅ Complete

## Overview

Sessions are now split into **encrypted fragments** and distributed across **multiple cloud storage providers**. The more fragments you can access from different providers, the more **vivid and complete** the recall becomes.

## Legal Cloud Storage Usage

It is **legal** to use any cloud storage available to store encrypted fragments:
- ✅ GCP Secret Manager
- ✅ AWS S3
- ✅ Azure Blob Storage
- ✅ MyKeys Server
- ✅ Local backup
- ✅ Any other cloud storage provider

**Key Principle:** More access to more fragments = more vivid recall

## How It Works

### Fragment Creation

1. **Session Encryption:** Session data encrypted with AES-256-CBC
2. **Fragment Splitting:** Encrypted data split into multiple fragments
3. **Redundancy:** Each fragment contains overlapping data for resilience
4. **Distribution:** Fragments distributed across multiple cloud providers

### Fragment Reconstruction

1. **Retrieval:** Collect fragments from all available cloud providers
2. **Reconstruction:** Merge fragments to reconstruct session
3. **Completeness:** More fragments = more complete/vivid recall
4. **Verification:** Hash verification ensures data integrity

## Fragment Configuration

```javascript
{
  minFragments: 3,        // Minimum fragments needed to reconstruct
  totalFragments: 5,      // Total fragments created (redundancy)
  fragmentSize: 1024,     // Max size per fragment (bytes)
}
```

## Storage Providers

### Current Implementations

1. **MyKeys Server** (`/api/sessions/:seed/fragments/:index`)
   - Primary storage endpoint
   - Supports fragment storage/retrieval
   - Backed by GCP Secret Manager

2. **GCP Secret Manager**
   - Automatic backup for fragments
   - Persistent storage
   - Integrated with MyKeys Server

3. **Local Backup** (`~/.mykeys/sessions/fragments/`)
   - Local fragment storage
   - Fast access
   - Offline capability

### Extensible Providers

4. **AWS S3** (ready for implementation)
   - S3 bucket storage
   - Cross-region replication
   - High availability

5. **Azure Blob Storage** (ready for implementation)
   - Blob container storage
   - Geo-redundancy
   - Enterprise integration

6. **Google Drive Folders** (roadmap)
   - Store fragments in Google Drive folders
   - OAuth2 authentication
   - Automatic sync via Google Drive API
   - Cross-platform access

7. **OneDrive Folders** (roadmap)
   - Store fragments in OneDrive folders
   - Microsoft Graph API integration
   - Office 365 integration
   - Windows integration

8. **Dropbox Folders** (roadmap)
   - Store fragments in Dropbox folders
   - Dropbox API v2 integration
   - Automatic sync
   - Cross-platform support

9. **Box Folders** (roadmap)
   - Store fragments in Box folders
   - Box API v2 integration
   - Enterprise features
   - Compliance support

10. **Any Cloud Storage** (extensible)
    - Add custom provider implementations
    - Use any legal cloud storage service
    - More providers = more vivid recall

## Usage

### Automatic Fragment Distribution

Fragments are automatically distributed when saving a session:

```bash
node mykeys-cli.js admin
# Enter seed: my-project
# Session automatically split into fragments
# Fragments distributed across available cloud providers
```

**Output:**
```
✓ Stored 5 fragments across 3 cloud providers
  Sources: mykeys-server, gcp-secret-manager, local-backup
```

### Vivid Recall

When loading a session, fragments are retrieved from all available providers:

```bash
node mykeys-cli.js admin
# Enter seed: my-project
# Fragments retrieved from multiple providers
```

**Output:**
```
✓ Retrieved 5 fragments from 3 sources
  Sources: mykeys-server, gcp-secret-manager, local-backup
✓ Complete vivid recall achieved!
```

### Partial Recall

If fewer fragments are available:

```bash
# Only 2 fragments retrieved
⚠️  Only 2 fragments retrieved, need 3
   Access more cloud storage providers for complete recall
```

### Incomplete Reconstruction

If fragments are incomplete:

```bash
⚠️  Incomplete reconstruction: 4/5 chunks (80.0%)
   More fragments = more vivid recall. Try accessing more cloud storage providers.
```

## Fragment Storage Flow

```
Session Data
    ↓
Encrypt (AES-256-CBC)
    ↓
Split into 5 Fragments
    ↓
Distribute Across Providers:
  • Fragment 0 → MyKeys Server
  • Fragment 1 → GCP Secret Manager
  • Fragment 2 → AWS S3 (if configured)
  • Fragment 3 → Azure Blob (if configured)
  • Fragment 4 → Local Backup
```

## Fragment Retrieval Flow

```
Request Session
    ↓
Retrieve from All Providers:
  • MyKeys Server → Fragment 0, 1
  • GCP Secret Manager → Fragment 1, 2
  • AWS S3 → Fragment 2 (if available)
  • Azure Blob → Fragment 3 (if available)
  • Local Backup → Fragment 4
    ↓
Merge Fragments
    ↓
Reconstruct Session
    ↓
Verify Hash
    ↓
Complete Vivid Recall!
```

## API Endpoints

### Store Fragment

```http
PUT /api/sessions/:seed/fragments/:index
Authorization: Bearer {token}
Content-Type: application/json

{
  "encrypted": "hex-encrypted-fragment-data",
  "iv": "hex-initialization-vector",
  "algorithm": "aes-256-cbc",
  "metadata": {
    "seed": "my-project",
    "totalFragments": 5,
    "minFragments": 3,
    "timestamp": "2025-01-28T16:00:00.000Z",
    "hash": "sha256-hash"
  }
}
```

### Retrieve Fragment

```http
GET /api/sessions/:seed/fragments/:index
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "index": 0,
  "encrypted": "hex-encrypted-fragment-data",
  "iv": "hex-initialization-vector",
  "algorithm": "aes-256-cbc",
  "metadata": {...},
  "updatedAt": "2025-01-28T16:00:00.000Z"
}
```

### List Fragments

```http
GET /api/sessions/:seed/fragments
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "seed": "my-project",
  "fragments": [
    {"index": 0, "updatedAt": "2025-01-28T16:00:00.000Z"},
    {"index": 1, "updatedAt": "2025-01-28T16:00:00.000Z"},
    {"index": 2, "updatedAt": "2025-01-28T16:00:00.000Z"}
  ],
  "count": 3
}
```

## Roadmap: Cloud Folder Storage Providers

### Google Drive Folders

**Status:** Roadmap  
**Priority:** High  
**Use Case:** Personal cloud storage, Google Workspace integration

**Implementation Plan:**
- OAuth2 authentication with Google Drive API
- Create dedicated folder: `MyKeys Sessions/Fragments/`
- Store fragments as JSON files
- Automatic sync on save/load
- Support for shared drives (Google Workspace)

**Benefits:**
- Free tier available
- Cross-platform access
- Google Workspace integration
- Mobile app access

### OneDrive Folders

**Status:** Roadmap  
**Priority:** High  
**Use Case:** Microsoft ecosystem, Windows integration

**Implementation Plan:**
- Microsoft Graph API authentication
- Create folder: `MyKeys Sessions/Fragments/`
- Store fragments as JSON files
- Leverage OneDrive sync client
- Office 365 integration

**Benefits:**
- Windows native integration
- Office 365 integration
- 5GB free tier
- Enterprise features

### Dropbox Folders

**Status:** Roadmap  
**Priority:** Medium  
**Use Case:** Cross-platform sync, simple API

**Implementation Plan:**
- Dropbox API v2 OAuth2
- Create folder: `/MyKeys Sessions/Fragments/`
- Store fragments as JSON files
- Use Dropbox sync client
- Support for Dropbox Business

**Benefits:**
- Simple API
- Cross-platform sync
- 2GB free tier
- Reliable sync

### Box Folders

**Status:** Roadmap  
**Priority:** Medium  
**Use Case:** Enterprise storage, compliance

**Implementation Plan:**
- Box API v2 OAuth2
- Create folder: `MyKeys Sessions/Fragments/`
- Store fragments as JSON files
- Enterprise compliance features
- Admin controls

**Benefits:**
- Enterprise features
- Compliance support
- Admin controls
- Security features

## Adding New Cloud Storage Providers

### Example: AWS S3

```javascript
async function storeFragmentToAWS(seed, fragment, token) {
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3();
  
  await s3.putObject({
    Bucket: 'mykeys-sessions',
    Key: `fragments/${seed}-${fragment.index}.json`,
    Body: JSON.stringify(fragment),
    ServerSideEncryption: 'AES256',
  }).promise();
}

async function retrieveFragmentFromAWS(seed, token) {
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3();
  const fragments = [];
  
  for (let i = 0; i < FRAGMENT_CONFIG.totalFragments; i++) {
    try {
      const data = await s3.getObject({
        Bucket: 'mykeys-sessions',
        Key: `fragments/${seed}-${i}.json`,
      }).promise();
      
      fragments.push(JSON.parse(data.Body.toString()));
    } catch (error) {
      // Fragment not found
    }
  }
  
  return fragments;
}
```

### Example: Azure Blob Storage

```javascript
async function storeFragmentToAzure(seed, fragment, token) {
  const { BlobServiceClient } = require('@azure/storage-blob');
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient('sessions');
  const blockBlobClient = containerClient.getBlockBlobClient(`fragments/${seed}-${fragment.index}.json`);
  
  await blockBlobClient.upload(JSON.stringify(fragment), JSON.stringify(fragment).length);
}

async function retrieveFragmentFromAzure(seed, token) {
  const { BlobServiceClient } = require('@azure/storage-blob');
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient('sessions');
  const fragments = [];
  
  for (let i = 0; i < FRAGMENT_CONFIG.totalFragments; i++) {
    try {
      const blockBlobClient = containerClient.getBlockBlobClient(`fragments/${seed}-${i}.json`);
      const downloadResponse = await blockBlobClient.download();
      const fragment = JSON.parse(await streamToString(downloadResponse.readableStreamBody));
      fragments.push(fragment);
    } catch (error) {
      // Fragment not found
    }
  }
  
  return fragments;
}
```

## Benefits

### 1. **Vivid Recall**
- More fragments = more complete session reconstruction
- Access multiple providers for maximum recall
- Partial fragments still provide partial recall

### 2. **Resilience**
- Redundancy across multiple providers
- Failure of one provider doesn't lose session
- Automatic fallback to available providers

### 3. **Legal Compliance**
- Encrypted fragments stored legally
- No plaintext data in cloud storage
- Compliant with data protection regulations

### 4. **Scalability**
- Add new providers easily
- Distribute load across providers
- Scale storage capacity independently

### 5. **Privacy**
- Fragments encrypted independently
- No single provider has complete data
- Distributed trust model

## Security Considerations

### Encryption

- **Per-Fragment Encryption:** Each fragment encrypted independently
- **Key Derivation:** Fragment-specific keys derived from token
- **No Plaintext:** Cloud providers never see unencrypted data

### Fragment Security

- **Independent Encryption:** Each fragment uses unique IV
- **Hash Verification:** Reconstructed data verified with hash
- **Minimum Fragments:** Need minimum fragments to reconstruct

### Provider Security

- **Distributed Trust:** No single provider has complete data
- **Encrypted Transport:** All fragments encrypted in transit
- **Access Control:** Provider-specific authentication

## Roadmap: Cloud Folder Providers

See **[ROADMAP_CLOUD_FOLDERS.md](ROADMAP_CLOUD_FOLDERS.md)** for implementation plans:

- **Google Drive Folders** (High Priority)
- **OneDrive Folders** (High Priority)
- **Dropbox Folders** (Medium Priority)
- **Box Folders** (Medium Priority)

These will enable storing fragments in cloud folder storage services, providing even more distribution options for vivid recall.

## Best Practices

1. **Enable Multiple Providers:** More providers = more vivid recall
2. **Monitor Fragment Count:** Ensure minimum fragments available
3. **Regular Backups:** Use local backup as fallback
4. **Provider Diversity:** Use different provider types
5. **Fragment Verification:** Verify hash after reconstruction
6. **Cloud Folders:** Use cloud folder providers when available (roadmap)

## Troubleshooting

### Insufficient Fragments

**Error:** "Need at least 3 fragments, got 2"

**Solution:**
- Enable more cloud storage providers
- Check provider connectivity
- Verify authentication credentials

### Incomplete Reconstruction

**Warning:** "Incomplete reconstruction: 80%"

**Solution:**
- Access more cloud storage providers
- Retrieve additional fragments
- Check fragment integrity

### Provider Failure

**Error:** "Failed to retrieve from aws-s3"

**Solution:**
- Provider failures are handled gracefully
- System falls back to available providers
- Check provider configuration

---

**Last Updated:** 2025-01-28  
**Version:** 1.0.0

**Legal Note:** It is legal to use any cloud storage available to store encrypted fragments. More access to more fragments = more vivid recall.

