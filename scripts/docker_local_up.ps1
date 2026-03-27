$ErrorActionPreference = 'Stop'

param(
    [ValidateSet('local','release')]
    [string]$Profile = 'local'
)

Set-Location "c:\Engenharia de Software\Planejamento Financeiro"

Write-Host "Profile selecionado: $Profile"

if ($Profile -eq 'release') {
    # Garantir arquivo .env.docker.release
    if (-not (Test-Path "fintech-saas/.env.docker.release")) {
        if (Test-Path "fintech-saas/.env.docker.production.example") {
            Copy-Item "fintech-saas/.env.docker.production.example" "fintech-saas/.env.docker.release"
            Write-Host "Arquivo fintech-saas/.env.docker.release criado a partir do exemplo de produção."
        } else {
            Write-Host "Aviso: fintech-saas/.env.docker.release não existe e não há exemplo de produção disponível."
        }
    }

    # Fazer backup do .env.docker.local atual (se existir)
    if (Test-Path "fintech-saas/.env.docker.local") {
        $bak = "fintech-saas/.env.docker.local.bak.$((Get-Date).ToString('yyyyMMddHHmmss'))"
        Copy-Item "fintech-saas/.env.docker.local" $bak
        Write-Host "Backup do .env.docker.local criado em: $bak"
    }

    if (Test-Path "fintech-saas/.env.docker.release") {
        Copy-Item "fintech-saas/.env.docker.release" "fintech-saas/.env.docker.local" -Force
        Write-Host "Arquivo fintech-saas/.env.docker.local substituído pelo perfil 'release'."
    }
} else {
    if (-not (Test-Path "fintech-saas/.env.docker.local")) {
        Copy-Item "fintech-saas/.env.docker.local.example" "fintech-saas/.env.docker.local"
        Write-Host "Arquivo fintech-saas/.env.docker.local criado a partir do exemplo."
    }

    if (-not (Test-Path "fintech-saas/.env.docker.production")) {
        Copy-Item "fintech-saas/.env.docker.production.example" "fintech-saas/.env.docker.production"
        Write-Host "Arquivo fintech-saas/.env.docker.production criado a partir do exemplo."
    }
}

Write-Host "Subindo stack local Docker..."
docker compose -f docker-compose.local.yml up -d --build

Write-Host "Status dos serviços:"
docker compose -f docker-compose.local.yml ps

Write-Host "Concluído. Acesse: http://localhost:8080"
