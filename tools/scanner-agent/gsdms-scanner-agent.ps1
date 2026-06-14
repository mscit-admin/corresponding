# ============================================================================
#  GSDMS Scanner Agent
#  جسر محلي بين متصفح النظام والماسحة الضوئية (WIA) على ويندوز.
#  يعمل بدون أي تثبيت إضافي — يكفي PowerShell المدمج في ويندوز.
#
#  التشغيل: شغّل ملف  start-scanner-agent.bat  (كمسؤول).
#  ثم اضغط زر "مسح المستند عن طريق السكانر" داخل النظام.
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
    Write-Host "تعذّر بدء الخادم على المنفذ $port. شغّل الملف كمسؤول، أو تأكد أن المنفذ غير مستخدم." -ForegroundColor Red
    Read-Host "اضغط Enter للخروج"
    exit 1
}

Write-Host "==============================================" -ForegroundColor Green
Write-Host " GSDMS Scanner Agent يعمل الآن" -ForegroundColor Green
Write-Host " العنوان: http://localhost:$port" -ForegroundColor Green
Write-Host " اترك هذه النافذة مفتوحة أثناء العمل." -ForegroundColor Green
Write-Host " للإيقاف: أغلق النافذة." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch {
        break
    }

    $req = $ctx.Request
    $res = $ctx.Response

    # CORS — يسمح للنظام (على أي عنوان) بالاتصال بالوكيل المحلي
    $res.Headers.Add("Access-Control-Allow-Origin", "*")
    $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $res.Headers.Add("Access-Control-Allow-Headers", "*")

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

        if ($path -eq "/scan") {
            Write-Host "» طلب مسح جديد — تابع نافذة الماسحة على الشاشة..." -ForegroundColor Cyan

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
            Write-Host "✓ تم المسح بنجاح ($([math]::Round($bytes.Length/1024)) كيلوبايت)." -ForegroundColor Green
            continue
        }

        $res.StatusCode = 404
        $res.Close()
    } catch {
        $msg = $_.Exception.Message
        Write-Host "× خطأ: $msg" -ForegroundColor Yellow
        try {
            $res.StatusCode = 500
            $payload = ConvertTo-Json @{ error = $msg }
            $err = [Text.Encoding]::UTF8.GetBytes($payload)
            $res.ContentType = "application/json"
            $res.OutputStream.Write($err, 0, $err.Length)
            $res.Close()
        } catch {}
    }
}
