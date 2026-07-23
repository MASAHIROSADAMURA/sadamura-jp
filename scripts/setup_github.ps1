<#
.SYNOPSIS
  半自動で GitHub リポジトリを作成し、ローカル commit を push する。

.DESCRIPTION
  事前条件 (どれもユーザー手動):
    1. `gh auth login` 済（GitHub アカウントで認証済）
    2. 03_実装/ で `git init` 済 + 初回 commit 済（このセッションで完了済）

  本スクリプトが行うこと:
    - gh CLI 認証状況の確認
    - リモートリポジトリ作成 (gh repo create --<visibility> --source=.)
    - main ブランチを push
    - GitHub Pages の Source = "GitHub Actions" に設定
    - 推奨ラベル・トピック・description の登録

  失敗してもファイルは変更しないので安全。

.PARAMETER RepoName
  作成するリポジトリ名。Default: sadamura-jp.

.PARAMETER Visibility
  private / public / internal. Default: public.
  （GitHub Free の Pages は public リポジトリが必須。private のままだと Pages を有効化できない）

.PARAMETER Description
  リポジトリ説明文。Default: 個人 HP 用 Astro source.

.EXAMPLE
  ./setup_github.ps1
  ./setup_github.ps1 -RepoName sadamura-jp -Visibility public
#>
[CmdletBinding()]
param(
  [string]$RepoName    = 'sadamura-jp',
  [ValidateSet('private', 'public', 'internal')]
  [string]$Visibility  = 'public',
  [string]$Description = 'Personal academic website for Masahiro Sadamura (sadamura.jp). Astro 5.x.'
)

$ErrorActionPreference = 'Stop'

function Step($msg, $color = 'Cyan') { Write-Host "==> $msg" -ForegroundColor $color }
function Fail($msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 1 }

# --- 0. Working directory must contain a git repo with at least one commit
Step '1/6  precondition checks'
if (-not (Test-Path .git)) { Fail "Run this from 60_Website/03_実装 (no .git directory found)." }
$commitCount = (git rev-list --count HEAD 2>$null)
if (-not $commitCount -or [int]$commitCount -lt 1) { Fail 'No commits yet. Run git commit before pushing.' }
Write-Host "    ok: $commitCount commits on $(git branch --show-current)"

# --- 1. gh auth status
Step '2/6  gh auth status'
$null = gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Fail "gh CLI is not authenticated. Run: gh auth login"
}
$ghUser = (gh api user --jq .login 2>$null)
if (-not $ghUser) { Fail 'Could not read GitHub login. Aborting.' }
Write-Host "    ok: logged in as $ghUser"

# --- 2. Check if remote already exists (idempotent)
Step '3/6  check for existing remote'
$existingRepo = gh repo view "$ghUser/$RepoName" --json name 2>$null
if ($existingRepo) {
  Write-Host "    repo $ghUser/$RepoName already exists, will reuse" -ForegroundColor Yellow
  $createNeeded = $false
} else {
  $createNeeded = $true
}

# --- 3. Create remote repo
if ($createNeeded) {
  Step '4/6  gh repo create'
  # No --push here: the explicit `git push -u origin main` in step 5 does it.
  gh repo create "$RepoName" `
    --$Visibility `
    --description $Description `
    --source . `
    --remote origin
  if ($LASTEXITCODE -ne 0) { Fail 'gh repo create failed.' }
  Write-Host "    ok: created $ghUser/$RepoName ($Visibility)"
} else {
  $remoteExists = git remote get-url origin 2>$null
  if (-not $remoteExists) {
    git remote add origin "https://github.com/$ghUser/$RepoName.git"
    Write-Host "    added origin → $ghUser/$RepoName"
  }
}

# --- 4. Push main
Step '5/6  git push'
git push -u origin main
if ($LASTEXITCODE -ne 0) { Fail 'git push failed.' }
Write-Host "    ok: pushed main"

# --- 5. Configure repo metadata
Step '6/6  configure metadata (topics, Pages source)'
gh repo edit "$ghUser/$RepoName" `
  --add-topic 'astro' `
  --add-topic 'personal-website' `
  --add-topic 'academic' `
  --add-topic 'legal-psychology' `
  --add-topic 'japanese-researcher' `
  --homepage 'https://sadamura.jp' 2>&1 | Out-Null

# GitHub Pages: source = workflow (so our deploy.yml takes over).
# `gh api` is the supported way as of 2026; the Web UI step in the
# Day1-5 guide remains a manual fallback in case the API rejects.
$pagesBody = @{ build_type = 'workflow' } | ConvertTo-Json -Compress
# Pipe the JSON body to `gh api --input -` (PowerShell has no bash `<<<` here-string).
# Errors here are non-fatal — user can flip the toggle manually in Settings -> Pages.
try {
  $pagesBody | gh api `
    -X POST `
    -H 'Accept: application/vnd.github+json' `
    "/repos/$ghUser/$RepoName/pages" `
    --input - 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host '    ok: Pages source set to GitHub Actions'
  } else {
    Write-Host '    note: Pages API declined; set it manually in Settings -> Pages -> Source = GitHub Actions' -ForegroundColor Yellow
  }
} catch {
  Write-Host '    note: Pages API call failed; set it manually in Settings -> Pages -> Source = GitHub Actions' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '====================================================' -ForegroundColor Green
Write-Host "  ok: pushed to https://github.com/$ghUser/$RepoName" -ForegroundColor Green
Write-Host "  Actions → check that 'Deploy site' runs to completion" -ForegroundColor Green
Write-Host "  Settings → Pages → set custom domain 'sadamura.jp'" -ForegroundColor Green
Write-Host "  Then proceed to Day 3 (DNS) of the setup guide" -ForegroundColor Green
Write-Host '====================================================' -ForegroundColor Green
