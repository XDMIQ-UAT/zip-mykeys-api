# Fix Email Spam Issues for cosmiciq.org

## Quick Checklist

### 1. DNS Records (Run `verify-dns-records.ps1`)
- [ ] SPF record includes `amazonses.com`
- [ ] All 3 DKIM CNAME records are present
- [ ] DMARC record is configured

### 2. Amazon SES Configuration
- [ ] Domain is verified in SES Console
- [ ] Domain is out of sandbox mode (can send to any address)
- [ ] DKIM is enabled and verified in SES

### 3. Email Content Improvements
✅ Already implemented:
- Proper HTML structure
- Text alternative
- Clear sender information
- No spam trigger words

### 4. Additional Steps

#### Check Domain Reputation
```powershell
# Check if domain is on blocklists
# Visit: https://mxtoolbox.com/blacklists.aspx
# Enter: cosmiciq.org
```

#### Test Email Score
```powershell
# Send test email to: test@mail-tester.com
# Get spam score and recommendations
```

#### Verify SES Status
```powershell
aws sesv2 get-email-identity --email-identity cosmiciq.org
```

#### Check SPF Record
```powershell
nslookup -type=TXT cosmiciq.org
# Should show: v=spf1 include:amazonses.com ~all
```

#### Check DKIM Records
```powershell
nslookup -type=CNAME que2w5i26gtxqc6qauvbnazg3wovekub._domainkey.cosmiciq.org
nslookup -type=CNAME n7sfnenscywp5grxclbsp2a7euihbato._domainkey.cosmiciq.org
nslookup -type=CNAME vuetz7sosyhz33bl3gcmhqsojigmiztp._domainkey.cosmiciq.org
```

#### Check DMARC Record
```powershell
nslookup -type=TXT _dmarc.cosmiciq.org
# Should show: v=DMARC1; p=quarantine; rua=mailto:dmarc@cosmiciq.org
```

## Common Issues

### Issue: SPF Record Missing Amazon SES
**Fix:**
```
Add TXT record to cosmiciq.org:
v=spf1 include:amazonses.com ~all
```

### Issue: DKIM Records Not Found
**Fix:**
Run the DKIM setup script:
```powershell
.\add-dkim-cosmiciq.ps1
```

### Issue: DMARC Record Missing
**Fix:**
Add TXT record at `_dmarc.cosmiciq.org`:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@cosmiciq.org; pct=100
```

### Issue: Domain in Sandbox Mode
**Fix:**
1. Go to AWS SES Console
2. Request production access
3. Wait for approval (usually 24 hours)

### Issue: Domain Reputation
**Fix:**
- Check blocklists: https://mxtoolbox.com/blacklists.aspx
- Request delisting if found
- Build reputation gradually (start with low volume)

## Testing

### Test Email Deliverability
```powershell
# Send test email
node test-send-email.js test@mail-tester.com

# Check score at: https://www.mail-tester.com
```

### Verify DNS Propagation
```powershell
# Check DNS records from different locations
# Use: https://dnschecker.org
```

## Best Practices

1. **Warm up domain**: Start with low volume, gradually increase
2. **Consistent sending**: Avoid sudden spikes
3. **Monitor bounces**: Keep bounce rate < 5%
4. **Monitor complaints**: Keep complaint rate < 0.1%
5. **Clean lists**: Remove invalid emails regularly
6. **Authenticate**: SPF, DKIM, DMARC all configured
7. **Content**: Avoid spam trigger words, proper HTML

## Resources

- Mail Tester: https://www.mail-tester.com
- MX Toolbox: https://mxtoolbox.com
- DNS Checker: https://dnschecker.org
- AWS SES Best Practices: https://docs.aws.amazon.com/ses/latest/dg/best-practices.html



