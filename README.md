# PlanejamentoFinanceiro
Projeto para a criacao do sistema Elo Financeiro.

Slogan: Conectando a sua empresa a eficiencia.

## Subir backend (Windows)

O erro `ModuleNotFoundError: No module named 'yfinance'` acontece quando o servidor e executado fora do ambiente virtual do projeto.

Use estes comandos:

```powershell
Set-Location "c:\Engenharia de Software\Planejamento Financeiro\fintech-saas"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Alternativa sem ativar ambiente (mais robusta para caminhos com espacos):

```powershell
Set-Location "c:\Engenharia de Software\Planejamento Financeiro\fintech-saas"
& "C:/Engenharia de Software/Planejamento Financeiro/fintech-saas/venv/Scripts/python.exe" -m pip install -r requirements.txt
& "C:/Engenharia de Software/Planejamento Financeiro/fintech-saas/venv/Scripts/python.exe" manage.py runserver
```

## Subir frontend

```powershell
Set-Location "c:\Engenharia de Software\Planejamento Financeiro\fintech-web"
npm install
npm run dev
```
