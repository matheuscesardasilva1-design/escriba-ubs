@echo off
chcp 65001 >nul
title Escriba Medico UBS - Servidor Local Seguro (localhost)
color 0B

echo ============================================================================
echo   ESCRIBA MEDICO UBS - SOAP ^& REGULACAO ESTADUAL
echo   Iniciando em localhost para manter permissao permanente de microfone...
echo ============================================================================
echo.
echo NAO FECHE ESTA JANELA ENQUANTO ESTIVER ATENDENDO.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = 8765; " ^
  "$root = Split-Path -Parent $MyInvocation.MyCommand.Path; " ^
  "if (-not $root) { $root = (Get-Location).Path }; " ^
  "$listener = New-Object System.Net.HttpListener; " ^
  "$listener.Prefixes.Add(\"http://localhost:$port/\"); " ^
  "try { $listener.Start() } catch { " ^
  "  Write-Host 'Servidor ja estava aberto ou porta em uso. Abrindo navegador...' -ForegroundColor Yellow; " ^
  "  Start-Process \"http://localhost:$port/index.html\"; exit " ^
  "}; " ^
  "Write-Host \"Servidor ativo em: http://localhost:$port/index.html\" -ForegroundColor Green; " ^
  "Start-Process \"http://localhost:$port/index.html\"; " ^
  "while ($listener.IsListening) { " ^
  "  $ctx = $listener.GetContext(); " ^
  "  $req = $ctx.Request; " ^
  "  $res = $ctx.Response; " ^
  "  $relPath = $req.Url.LocalPath.TrimStart('/'); " ^
  "  if ([string]::IsNullOrEmpty($relPath)) { $relPath = 'index.html' }; " ^
  "  $filePath = Join-Path $root $relPath; " ^
  "  if (Test-Path $filePath -PathType Leaf) { " ^
  "    $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); " ^
  "    $mime = switch ($ext) { " ^
  "      '.html' { 'text/html; charset=utf-8' } " ^
  "      '.js'   { 'application/javascript; charset=utf-8' } " ^
  "      '.css'  { 'text/css; charset=utf-8' } " ^
  "      '.json' { 'application/json; charset=utf-8' } " ^
  "      '.svg'  { 'image/svg+xml' } " ^
  "      '.png'  { 'image/png' } " ^
  "      '.ico'  { 'image/x-icon' } " ^
  "      default { 'application/octet-stream' } " ^
  "    }; " ^
  "    $bytes = [System.IO.File]::ReadAllBytes($filePath); " ^
  "    $res.ContentType = $mime; " ^
  "    $res.ContentLength64 = $bytes.Length; " ^
  "    $res.Headers.Add('Cache-Control', 'no-cache'); " ^
  "    $res.OutputStream.Write($bytes, 0, $bytes.Length); " ^
  "  } else { " ^
  "    $res.StatusCode = 404; " ^
  "  }; " ^
  "  $res.Close(); " ^
  "}"
