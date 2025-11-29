# Roadmap: Cloud Folder Storage Providers

**Date:** 2025-01-28  
**Status:** Roadmap Items

## Overview

Add support for storing encrypted session fragments in cloud folder storage services:
- Google Drive Folders
- OneDrive Folders  
- Dropbox Folders
- Box Folders

**Principle:** More cloud folders = more fragments = more vivid recall

## Implementation Priority

### High Priority

1. **Google Drive Folders**
   - Wide adoption
   - Free tier available
   - Cross-platform
   - Google Workspace integration

2. **OneDrive Folders**
   - Windows integration
   - Office 365 integration
   - Microsoft ecosystem
   - Native sync

### Medium Priority

3. **Dropbox Folders**
   - Simple API
   - Reliable sync
   - Cross-platform
   - Business features

4. **Box Folders**
   - Enterprise features
   - Compliance support
   - Admin controls
   - Security features

## Google Drive Implementation

### Requirements

- Google Drive API enabled
- OAuth2 credentials
- `googleapis` npm package

### Implementation

```javascript
const { google } = require('googleapis');

async function storeFragmentToGoogleDrive(seed, fragment, token) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  // Set credentials (from stored refresh token)
  oauth2Client.setCredentials({
    refresh_token: await getGoogleRefreshToken(token)
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  // Ensure folder exists
  const folderId = await ensureFolderExists(drive, 'MyKeys Sessions/Fragments');
  
  // Upload fragment
  const fileName = `${seed}-fragment-${fragment.index}.json`;
  await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/json',
      body: JSON.stringify(fragment),
    },
  });
}

async function retrieveFragmentFromGoogleDrive(seed, token) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    refresh_token: await getGoogleRefreshToken(token)
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const folderId = await ensureFolderExists(drive, 'MyKeys Sessions/Fragments');
  
  const fragments = [];
  for (let i = 0; i < FRAGMENT_CONFIG.totalFragments; i++) {
    try {
      const fileName = `${seed}-fragment-${i}.json`;
      const response = await drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents`,
        fields: 'files(id, name)',
      });
      
      if (response.data.files.length > 0) {
        const fileId = response.data.files[0].id;
        const fileContent = await drive.files.get({
          fileId,
          alt: 'media',
        }, { responseType: 'json' });
        
        fragments.push(JSON.parse(fileContent.data));
      }
    } catch (error) {
      // Fragment not found
    }
  }
  
  return fragments;
}
```

### OAuth2 Flow

1. User authorizes Google Drive access
2. Store refresh token securely (encrypted in mykeys.zip)
3. Use refresh token for API calls
4. Automatic token refresh

## OneDrive Implementation

### Requirements

- Microsoft Graph API access
- Azure AD app registration
- `@microsoft/microsoft-graph-client` npm package

### Implementation

```javascript
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

async function storeFragmentToOneDrive(seed, fragment, token) {
  const accessToken = await getOneDriveAccessToken(token);
  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken,
    },
  });
  
  // Ensure folder exists
  const folderPath = '/MyKeys Sessions/Fragments';
  const folderId = await ensureFolderExists(client, folderPath);
  
  // Upload fragment
  const fileName = `${seed}-fragment-${fragment.index}.json`;
  await client
    .api(`/me/drive/items/${folderId}:/${fileName}:/content`)
    .put(JSON.stringify(fragment));
}

async function retrieveFragmentFromOneDrive(seed, token) {
  const accessToken = await getOneDriveAccessToken(token);
  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken,
    },
  });
  
  const folderPath = '/MyKeys Sessions/Fragments';
  const fragments = [];
  
  for (let i = 0; i < FRAGMENT_CONFIG.totalFragments; i++) {
    try {
      const fileName = `${seed}-fragment-${i}.json`;
      const fileContent = await client
        .api(`/me/drive/root:/MyKeys Sessions/Fragments/${fileName}:/content`)
        .get();
      
      fragments.push(JSON.parse(fileContent));
    } catch (error) {
      // Fragment not found
    }
  }
  
  return fragments;
}
```

## Dropbox Implementation

### Requirements

- Dropbox API v2 access
- Dropbox app registration
- `dropbox` npm package

### Implementation

```javascript
const { Dropbox } = require('dropbox');

async function storeFragmentToDropbox(seed, fragment, token) {
  const accessToken = await getDropboxAccessToken(token);
  const dbx = new Dropbox({ accessToken });
  
  const folderPath = '/MyKeys Sessions/Fragments';
  const fileName = `${seed}-fragment-${fragment.index}.json`;
  const filePath = `${folderPath}/${fileName}`;
  
  await dbx.filesUpload({
    path: filePath,
    contents: JSON.stringify(fragment),
    mode: { '.tag': 'overwrite' },
  });
}

async function retrieveFragmentFromDropbox(seed, token) {
  const accessToken = await getDropboxAccessToken(token);
  const dbx = new Dropbox({ accessToken });
  
  const folderPath = '/MyKeys Sessions/Fragments';
  const fragments = [];
  
  for (let i = 0; i < FRAGMENT_CONFIG.totalFragments; i++) {
    try {
      const fileName = `${seed}-fragment-${i}.json`;
      const filePath = `${folderPath}/${fileName}`;
      const response = await dbx.filesDownload({ path: filePath });
      fragments.push(JSON.parse(response.result.fileBinary.toString()));
    } catch (error) {
      // Fragment not found
    }
  }
  
  return fragments;
}
```

## Box Implementation

### Requirements

- Box API v2 access
- Box app registration
- `box-node-sdk` npm package

### Implementation

```javascript
const BoxSDK = require('box-node-sdk');

async function storeFragmentToBox(seed, fragment, token) {
  const accessToken = await getBoxAccessToken(token);
  const sdk = new BoxSDK({
    clientID: process.env.BOX_CLIENT_ID,
    clientSecret: process.env.BOX_CLIENT_SECRET,
  });
  
  const client = sdk.getBasicClient(accessToken);
  const folderPath = 'MyKeys Sessions/Fragments';
  const folderId = await ensureFolderExists(client, folderPath);
  
  const fileName = `${seed}-fragment-${fragment.index}.json`;
  const stream = require('stream');
  const bufferStream = new stream.PassThrough();
  bufferStream.end(Buffer.from(JSON.stringify(fragment)));
  
  await client.files.uploadFile(folderId, fileName, bufferStream);
}

async function retrieveFragmentFromBox(seed, token) {
  const accessToken = await getBoxAccessToken(token);
  const sdk = new BoxSDK({
    clientID: process.env.BOX_CLIENT_ID,
    clientSecret: process.env.BOX_CLIENT_SECRET,
  });
  
  const client = sdk.getBasicClient(accessToken);
  const folderPath = 'MyKeys Sessions/Fragments';
  const folderId = await ensureFolderExists(client, folderPath);
  
  const fragments = [];
  const folderItems = await client.folders.getItems(folderId);
  
  for (let i = 0; i < FRAGMENT_CONFIG.totalFragments; i++) {
    const fileName = `${seed}-fragment-${i}.json`;
    const file = folderItems.entries.find(f => f.name === fileName);
    
    if (file) {
      const fileContent = await client.files.getReadStream(file.id);
      const chunks = [];
      for await (const chunk of fileContent) {
        chunks.push(chunk);
      }
      fragments.push(JSON.parse(Buffer.concat(chunks).toString()));
    }
  }
  
  return fragments;
}
```

## Configuration

### Environment Variables

```bash
# Google Drive
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback

# OneDrive
ONEDRIVE_CLIENT_ID=your-client-id
ONEDRIVE_CLIENT_SECRET=your-client-secret
ONEDRIVE_REDIRECT_URI=http://localhost:3000/oauth2callback

# Dropbox
DROPBOX_CLIENT_ID=your-client-id
DROPBOX_CLIENT_SECRET=your-client-secret
DROPBOX_REDIRECT_URI=http://localhost:3000/oauth2callback

# Box
BOX_CLIENT_ID=your-client-id
BOX_CLIENT_SECRET=your-client-secret
BOX_REDIRECT_URI=http://localhost:3000/oauth2callback
```

### Token Storage

Store OAuth refresh tokens securely in mykeys.zip:

```javascript
// Store refresh token
await storeSecret('google-drive-refresh-token', refreshToken);

// Retrieve and refresh access token
const refreshToken = await getSecret('google-drive-refresh-token');
const accessToken = await refreshGoogleAccessToken(refreshToken);
```

## Benefits

### More Fragments = More Vivid Recall

- **Google Drive:** Personal cloud, Google Workspace
- **OneDrive:** Windows integration, Office 365
- **Dropbox:** Cross-platform sync
- **Box:** Enterprise compliance

### Redundancy

- Fragments distributed across multiple providers
- Failure of one provider doesn't lose session
- Automatic fallback to available providers

### Legal Cloud Storage

- All fragments encrypted
- Legal to use any cloud storage
- Compliant with data protection regulations

## Implementation Steps

1. **Phase 1: Google Drive** (High Priority)
   - OAuth2 setup
   - API integration
   - Testing

2. **Phase 2: OneDrive** (High Priority)
   - Microsoft Graph setup
   - API integration
   - Testing

3. **Phase 3: Dropbox** (Medium Priority)
   - Dropbox API setup
   - API integration
   - Testing

4. **Phase 4: Box** (Medium Priority)
   - Box API setup
   - API integration
   - Testing

## Testing

### Test Scenarios

1. **Fragment Storage**
   - Store fragments to each provider
   - Verify files created correctly
   - Check encryption maintained

2. **Fragment Retrieval**
   - Retrieve from single provider
   - Retrieve from multiple providers
   - Verify reconstruction works

3. **Provider Failure**
   - Simulate provider failure
   - Verify fallback works
   - Check partial reconstruction

4. **OAuth Flow**
   - Test authorization flow
   - Verify token refresh
   - Check error handling

## Security Considerations

### OAuth Tokens

- Store refresh tokens encrypted in mykeys.zip
- Never commit tokens to version control
- Rotate tokens periodically

### Fragment Encryption

- All fragments encrypted before storage
- Provider never sees plaintext
- Independent encryption per fragment

### Access Control

- Use provider-specific authentication
- Respect provider access controls
- Support enterprise policies

---

**Status:** Roadmap  
**Last Updated:** 2025-01-28  
**Next Steps:** Implement Google Drive support first




