# Verify DNS Records for cosmiciq.org Email Deliverability
# Checks SPF, DKIM, and DMARC records

param(
    [string]$Domain = "cosmiciq.org"
)

Write-Host "`n=== DNS Records Verification for $Domain ===" -ForegroundColor Cyan
Write-Host ""

# Check SPF Record
Write-Host "1. Checking SPF Record..." -ForegroundColor Yellow
try {
    $spfRecord = Resolve-DnsName -Name $Domain -Type TXT -ErrorAction Stop | 
        Where-Object { $_.Strings -like "*v=spf1*" }
    
    if ($spfRecord) {
        Write-Host "   ✓ SPF Record Found:" -ForegroundColor Green
        foreach ($string in $spfRecord.Strings) {
            Write-Host "     $string" -ForegroundColor Gray
            if ($string -like "*include:amazonses.com*") {
                Write-Host "     ✓ Amazon SES included" -ForegroundColor Green
            } else {
                Write-Host "     ⚠️  Amazon SES not found in SPF" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ❌ SPF Record NOT FOUND" -ForegroundColor Red
        Write-Host "   Add TXT record: v=spf1 include:amazonses.com ~all" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ❌ Error checking SPF: $_" -ForegroundColor Red
}

Write-Host ""

# Check DKIM Records
Write-Host "2. Checking DKIM Records..." -ForegroundColor Yellow
$dkimRecords = @(
    "que2w5i26gtxqc6qauvbnazg3wovekub._domainkey",
    "n7sfnenscywp5grxclbsp2a7euihbato._domainkey",
    "vuetz7sosyhz33bl3gcmhqsojigmiztp._domainkey"
)

$dkimFound = 0
foreach ($dkimName in $dkimRecords) {
    try {
        $dkimRecord = Resolve-DnsName -Name "${dkimName}.${Domain}" -Type CNAME -ErrorAction Stop
        if ($dkimRecord) {
            Write-Host "   ✓ $dkimName" -ForegroundColor Green
            Write-Host "     → $($dkimRecord.NameHost)" -ForegroundColor Gray
            $dkimFound++
        }
    } catch {
        Write-Host "   ❌ $dkimName - NOT FOUND" -ForegroundColor Red
    }
}

if ($dkimFound -eq 3) {
    Write-Host "   ✓ All 3 DKIM records found" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Only $dkimFound/3 DKIM records found" -ForegroundColor Yellow
}

Write-Host ""

# Check DMARC Record
Write-Host "3. Checking DMARC Record..." -ForegroundColor Yellow
try {
    $dmarcRecord = Resolve-DnsName -Name "_dmarc.${Domain}" -Type TXT -ErrorAction Stop |
        Where-Object { $_.Strings -like "*v=DMARC1*" }
    
    if ($dmarcRecord) {
        Write-Host "   ✓ DMARC Record Found:" -ForegroundColor Green
        foreach ($string in $dmarcRecord.Strings) {
            Write-Host "     $string" -ForegroundColor Gray
            if ($string -like "*p=quarantine*" -or $string -like "*p=reject*") {
                Write-Host "     ✓ Policy is set (quarantine/reject)" -ForegroundColor Green
            } elseif ($string -like "*p=none*") {
                Write-Host "     ⚠️  Policy is 'none' (monitoring only)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ❌ DMARC Record NOT FOUND" -ForegroundColor Red
        Write-Host "   Add TXT record at _dmarc.$Domain:" -ForegroundColor Cyan
        Write-Host "     v=DMARC1; p=quarantine; rua=mailto:dmarc@$Domain" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error checking DMARC: $_" -ForegroundColor Red
}

Write-Host ""

# Check MX Records (should exist for domain)
Write-Host "4. Checking MX Records..." -ForegroundColor Yellow
try {
    $mxRecords = Resolve-DnsName -Name $Domain -Type MX -ErrorAction Stop
    if ($mxRecords) {
        Write-Host "   ✓ MX Records Found:" -ForegroundColor Green
        foreach ($mx in $mxRecords) {
            Write-Host "     $($mx.NameExchange) (Priority: $($mx.Preference))" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️  No MX records (not required for sending-only)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  No MX records (not required for sending-only)" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
$issues = @()

if (-not $spfRecord -or ($spfRecord.Strings -notlike "*include:amazonses.com*")) {
    $issues += "SPF record missing or incomplete"
}
if ($dkimFound -lt 3) {
    $issues += "DKIM records incomplete ($dkimFound/3)"
}
if (-not $dmarcRecord) {
    $issues += "DMARC record missing"
}

if ($issues.Count -eq 0) {
    Write-Host "✓ All DNS records are properly configured!" -ForegroundColor Green
    Write-Host ""
    Write-Host "If emails still go to spam, check:" -ForegroundColor Yellow
    Write-Host "  1. Domain age (should be >30 days)" -ForegroundColor Gray
    Write-Host "  2. Domain reputation (check blocklists)" -ForegroundColor Gray
    Write-Host "  3. Email content (use mail-tester.com)" -ForegroundColor Gray
    Write-Host "  4. Sending volume (avoid sudden spikes)" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Issues found:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "  • $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Fix these issues to improve email deliverability." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Test your email at: https://www.mail-tester.com" -ForegroundColor Cyan
Write-Host ""



