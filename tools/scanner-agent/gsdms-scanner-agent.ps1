# ============================================================================
#  GSDMS Scanner Agent
#  Local bridge between the system's browser and a WIA scanner on Windows.
#  No installation required - uses built-in Windows PowerShell.
#
#  Run: right-click  start-scanner-agent.bat  -> Run as administrator.
#  Then click "Scan via scanner" inside the system.
#
#  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 as the
#  system ANSI codepage unless the file has a UTF-8 BOM, so non-ASCII text
#  (e.g. Arabic) here would corrupt the script.
# ============================================================================

$ErrorActionPreference = 'Stop'
$port = 8723

# wiaFormatJPEG
$JPEG = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
} catch {
    Write-Host "Could not start the server on port $port. Run as administrator, or free the port." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "==============================================" -ForegroundColor Green
Write-Host " GSDMS Scanner Agent is running" -ForegroundColor Green
Write-Host " Address: http://localhost:$port" -ForegroundColor Green
Write-Host " Keep this window open while working." -ForegroundColor Green
Write-Host " To stop: close this window." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch {
        break
    }

    $req = $ctx.Request
    $res = $ctx.Response

    # CORS - allow the system (on any address) to reach the local agent.
    # Access-Control-Allow-Private-Network is required when the site is served
    # from a public IP/domain and calls localhost (Chrome Private Network Access).
    $res.Headers.Add("Access-Control-Allow-Origin", "*")
    $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $res.Headers.Add("Access-Control-Allow-Headers", "*")
    $res.Headers.Add("Access-Control-Allow-Private-Network", "true")

    try {
        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        $path = $req.Url.AbsolutePath.ToLower()

        if ($path -eq "/ping") {
            $body = [Text.Encoding]::UTF8.GetBytes('{"status":"ok","agent":"gsdms-scanner"}')
            $res.ContentType = "application/json"
            $res.OutputStream.Write($body, 0, $body.Length)
            $res.Close()
            continue
        }

        if ($path -eq "/device") {
            # Return the machine's primary MAC address, local IP and hostname.
            $mac = ""
            $localIp = ""
            try {
                $cfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" |
                       Where-Object { $_.MACAddress } | Select-Object -First 1
                if ($cfg) {
                    $mac = $cfg.MACAddress
                    $localIp = ($cfg.IPAddress | Where-Object { $_ -match '^\d+\.' } | Select-Object -First 1)
                }
            } catch {}
            $payload = @{ mac = $mac; localIp = $localIp; hostname = $env:COMPUTERNAME } | ConvertTo-Json
            $body = [Text.Encoding]::UTF8.GetBytes($payload)
            $res.ContentType = "application/json"
            $res.OutputStream.Write($body, 0, $body.Length)
            $res.Close()
            continue
        }

        if ($path -eq "/scan") {
            Write-Host "> Scan request - follow the scanner dialog on screen..." -ForegroundColor Cyan

            $cd = New-Object -ComObject WIA.CommonDialog
            # (DeviceType=Scanner, Intent=Unspecified, Bias=0, Format=JPEG,
            #  AlwaysSelectDevice=$false, UseCommonUI=$true, CancelError=$true)
            $image = $cd.ShowAcquireImage(1, 0, 0, $JPEG, $false, $true, $true)

            $tmp = [IO.Path]::Combine($env:TEMP, "gsdms-scan-$([Guid]::NewGuid().ToString()).jpg")
            $image.SaveFile($tmp)
            $bytes = [IO.File]::ReadAllBytes($tmp)
            Remove-Item $tmp -Force -ErrorAction SilentlyContinue

            $res.ContentType = "image/jpeg"
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
            Write-Host ("OK - scanned " + [math]::Round($bytes.Length / 1024) + " KB") -ForegroundColor Green
            continue
        }

        $res.StatusCode = 404
        $res.Close()
    } catch {
        $msg = $_.Exception.Message
        Write-Host ("x Error: " + $msg) -ForegroundColor Yellow
        try {
            $res.StatusCode = 500
            $err = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json @{ error = $msg }))
            $res.ContentType = "application/json"
            $res.OutputStream.Write($err, 0, $err.Length)
            $res.Close()
        } catch {}
    }
}
