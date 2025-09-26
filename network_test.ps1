# ESP32 Network Test Script
# Test apakah ESP32 dapat mencapai server dashboard

Write-Host "======================================================"
Write-Host "ESP32 NETWORK CONNECTIVITY TEST"
Write-Host "======================================================"
Write-Host ""

$serverIP = "10.86.58.211"
$serverPort = 3003

Write-Host "🔍 Testing connectivity to server: $serverIP`:$serverPort"
Write-Host ""

# Test 1: Ping server IP
Write-Host "Test 1: Ping server IP"
Write-Host "------------------------"
try {
    $pingResult = Test-Connection -ComputerName $serverIP -Count 4 -Quiet
    if ($pingResult) {
        Write-Host "✅ Ping successful - Server is reachable" -ForegroundColor Green
    } else {
        Write-Host "❌ Ping failed - Server not reachable" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Ping error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Test port connectivity
Write-Host "Test 2: Port connectivity"
Write-Host "-------------------------"
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.ReceiveTimeout = 3000
    $tcpClient.SendTimeout = 3000
    
    $connection = $tcpClient.BeginConnect($serverIP, $serverPort, $null, $null)
    $wait = $connection.AsyncWaitHandle.WaitOne(3000, $false)
    
    if ($wait -and $tcpClient.Connected) {
        Write-Host "✅ Port $serverPort is open and accessible" -ForegroundColor Green
        $tcpClient.Close()
    } else {
        Write-Host "❌ Port $serverPort is not accessible" -ForegroundColor Red
        $tcpClient.Close()
    }
} catch {
    Write-Host "❌ Port test error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: HTTP GET request to dashboard
Write-Host "Test 3: HTTP GET to dashboard"
Write-Host "------------------------------"
try {
    $url = "http://$serverIP`:$serverPort/"
    Write-Host "Testing URL: $url"
    
    $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ Dashboard accessible - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response length: $($response.Content.Length) bytes"
} catch {
    Write-Host "❌ Dashboard not accessible: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: HTTP GET to telemetry API
Write-Host "Test 4: HTTP GET to telemetry API"
Write-Host "----------------------------------"
try {
    $apiUrl = "http://$serverIP`:$serverPort/api/telemetry"
    Write-Host "Testing API URL: $apiUrl"
    
    $response = Invoke-WebRequest -Uri $apiUrl -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ Telemetry API accessible - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response length: $($response.Content.Length) bytes"
} catch {
    Write-Host "❌ Telemetry API not accessible: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: HTTP POST test data to telemetry API
Write-Host "Test 5: HTTP POST test data"
Write-Host "----------------------------"
try {
    $testData = @{
        battery_voltage = 12.5
        battery_current = 1500
        battery_power = 18.75
        gps_latitude = -5.358400
        gps_longitude = 105.311700
        temperature = 28.5
        humidity = 65.0
        signal_strength = -45
        connection_status = "test"
        connection_type = "PowerShell"
        packet_number = 999
        timestamp = [int64](Get-Date -UFormat %s)
    } | ConvertTo-Json
    
    $apiUrl = "http://$serverIP`:$serverPort/api/telemetry"
    $response = Invoke-WebRequest -Uri $apiUrl -Method POST -Body $testData -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing
    
    Write-Host "✅ POST request successful - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Server response: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))"
} catch {
    Write-Host "❌ POST request failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 6: Check Windows Firewall
Write-Host "Test 6: Windows Firewall Check"
Write-Host "-------------------------------"
try {
    $firewallRules = Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Node*" -or $_.DisplayName -like "*3003*"}
    if ($firewallRules) {
        Write-Host "✅ Found potential firewall rules for Node.js/port 3003" -ForegroundColor Green
        $firewallRules | ForEach-Object {
            Write-Host "   Rule: $($_.DisplayName) - $($_.Action) - $($_.Enabled)"
        }
    } else {
        Write-Host "⚠️  No specific firewall rules found - may need to add exception" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Firewall check error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "======================================================"
Write-Host "NETWORK TEST COMPLETED"
Write-Host "======================================================"
Write-Host ""
Write-Host "🔧 If tests fail, check:"
Write-Host "   1. Server is running (node server.js)"
Write-Host "   2. Windows Firewall allows port 3003"
Write-Host "   3. ESP32 and computer on same WiFi network"
Write-Host "   4. WiFi allows device-to-device communication"
Write-Host ""
Write-Host "📋 Next Steps:"
Write-Host "   1. Upload updated ESP32 code"
Write-Host "   2. Monitor ESP32 Serial output"
Write-Host "   3. Check for detailed error messages"
