$ErrorActionPreference = "Stop"
$env:AWS_PAGER = ""

$aws = "C:\Progra~1\Amazon\AWSCLIV2\aws.exe"
$distId = "E28OOTJ7FE6YAQ"
$functionName = "market-analysis-basic-auth"
$username = "Datatransform"
$password = "Srikanth09@"

$expected = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$username`:$password"))

$fnCode = @"
function handler(event) {
    var request = event.request;
    var headers = request.headers;
    var auth = headers.authorization ? headers.authorization.value : "";
    var expected = "Basic $expected";

    if (auth === expected) {
        return request;
    }

    return {
        statusCode: 401,
        statusDescription: "Unauthorized",
        headers: {
            "www-authenticate": { value: 'Basic realm="Restricted", charset="UTF-8"' },
            "cache-control": { value: "no-store" }
        }
    };
}
"@

$codePath = Join-Path $env:TEMP "cf-basic-auth.js"
Set-Content -Path $codePath -Value $fnCode -NoNewline

$exists = $false
$prevErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $aws cloudfront describe-function --name $functionName --stage DEVELOPMENT --no-cli-pager 1>$null 2>$null
if ($LASTEXITCODE -eq 0) {
    $exists = $true
}
$ErrorActionPreference = $prevErrorAction

if ($exists) {
    $devEtag = (& $aws cloudfront describe-function --name $functionName --stage DEVELOPMENT --query ETag --output text --no-cli-pager).Trim()
    & $aws cloudfront update-function --name $functionName --if-match $devEtag --function-config Comment="Basic auth for app",Runtime=cloudfront-js-1.0 --function-code fileb://$codePath --no-cli-pager | Out-Null
}
else {
    & $aws cloudfront create-function --name $functionName --function-config Comment="Basic auth for app",Runtime=cloudfront-js-1.0 --function-code fileb://$codePath --no-cli-pager | Out-Null
}

$publishEtag = (& $aws cloudfront describe-function --name $functionName --stage DEVELOPMENT --query ETag --output text --no-cli-pager).Trim()
& $aws cloudfront publish-function --name $functionName --if-match $publishEtag --no-cli-pager | Out-Null
$fnArn = (& $aws cloudfront describe-function --name $functionName --stage LIVE --query FunctionSummary.FunctionMetadata.FunctionARN --output text --no-cli-pager).Trim()

$cfgObj = & $aws cloudfront get-distribution-config --id $distId --output json --no-cli-pager | ConvertFrom-Json
$etag = $cfgObj.ETag
$cfg = $cfgObj.DistributionConfig

$cfg.DefaultCacheBehavior.FunctionAssociations = [PSCustomObject]@{
    Quantity = 1
    Items = @(
        [PSCustomObject]@{
            EventType = "viewer-request"
            FunctionARN = $fnArn
        }
    )
}

$cfgFile = Join-Path $env:TEMP "cf-dist-update-auth.json"
$cfg | ConvertTo-Json -Depth 100 | Set-Content -Path $cfgFile -NoNewline

& $aws cloudfront update-distribution --id $distId --if-match $etag --distribution-config file://$cfgFile --no-cli-pager | Out-Null

Write-Output ("FUNCTION_ARN=" + $fnArn)
Write-Output "UPDATED_DISTRIBUTION=E28OOTJ7FE6YAQ"
Write-Output "NOTE=CloudFront deploy may take a few minutes"
