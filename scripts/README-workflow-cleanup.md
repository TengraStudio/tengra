# GitHub Actions Workflow Cleanup Scripts

Bu scriptler GitHub Actions workflow run'larını temizlemek için kullanılır.

## Gereksinimler

GitHub Personal Access Token (PAT) gereklidir. Token'ı şu şekilde ayarlayın:

```bash
# Bash/Linux/macOS
export GH_TOKEN="github_pat_xxxxx"

# PowerShell
$env:GH_TOKEN = "github_pat_xxxxx"

# Windows CMD
set GH_TOKEN=github_pat_xxxxx
```

Token izinleri:
- `repo` (full control of private repositories)
- `workflow` (update GitHub Actions workflows)

## Kullanım

### Node.js Script (Cross-platform)

```bash
# Sadece başarısız run'ları sil (varsayılan)
npm run gh:cleanup

# Dry-run: Ne silineceğini göster ama silme
npm run gh:cleanup:dry
node scripts/cleanup-workflow-runs.js --dry-run

# Tüm run'ları sil (7 günden eski)
npm run gh:cleanup:all

# Sadece belirli bir workflow'un run'larını sil
node scripts/cleanup-workflow-runs.js --workflow="Release Build" --status=all

# Son 3 başarılı run'ı tut, gerisini sil
node scripts/cleanup-workflow-runs.js --keep-last=3 --status=completed

# 60 günden eski tüm başarısız run'ları sil
node scripts/cleanup-workflow-runs.js --status=failure --older-than=60
```

### PowerShell Script (Windows)

```powershell
# Sadece başarısız run'ları sil
.\scripts\cleanup-workflow-runs.ps1

# Dry-run
.\scripts\cleanup-workflow-runs.ps1 -DryRun

# Tüm run'ları sil (30 günden eski)
.\scripts\cleanup-workflow-runs.ps1 -Status all

# Belirli workflow
.\scripts\cleanup-workflow-runs.ps1 -Workflow "Release Build" -Status all

# Son 3 başarılı run'ı tut
.\scripts\cleanup-workflow-runs.ps1 -KeepLast 3 -Status completed

# 60 günden eski başarısız run'lar
.\scripts\cleanup-workflow-runs.ps1 -Status failure -OlderThan 60
```

## Parametreler

### Node.js Script

| Parametre | Varsayılan | Açıklama |
|-----------|------------|----------|
| `--status=<status>` | `failure` | Filtreleme durumu: `completed`, `failure`, `success`, `cancelled`, `all` |
| `--keep-last=<n>` | `5` | Son N başarılı run'ı tut |
| `--dry-run` | `false` | Sadece göster, silme |
| `--workflow=<name>` | `null` | Sadece belirli workflow |
| `--older-than=<days>` | `30` | N günden eski run'lar |

### PowerShell Script

| Parametre | Varsayılan | Açıklama |
|-----------|------------|----------|
| `-Status` | `failure` | Filtreleme durumu |
| `-KeepLast` | `5` | Son N başarılı run'ı tut |
| `-DryRun` | `$false` | Sadece göster, silme |
| `-Workflow` | `$null` | Sadece belirli workflow |
| `-OlderThan` | `30` | N günden eski run'lar |

## Örnekler

### Senaryo 1: Başarısız build'leri temizle

```bash
# 30 günden eski tüm başarısız run'ları sil
node scripts/cleanup-workflow-runs.js --status=failure

# veya PowerShell
.\scripts\cleanup-workflow-runs.ps1 -Status failure
```

### Senaryo 2: Eski başarılı run'ları temizle

```bash
# Son 5 başarılı run'ı tut, 60 günden eski tüm başarılıları sil
node scripts/cleanup-workflow-runs.js --status=success --keep-last=5 --older-than=60
```

### Senaryo 3: Tüm run'ları temizle

```bash
# 7 günden eski TÜM run'ları sil
node scripts/cleanup-workflow-runs.js --status=all --older-than=7
```

### Senaryo 4: Önce kontrol et

```bash
# Dry-run ile neyin silineceğini gör
node scripts/cleanup-workflow-runs.js --dry-run --status=all

# Eğer sonuç uygunsa, gerçekten sil
node scripts/cleanup-workflow-runs.js --status=all
```

## Güvenlik Notları

⚠️ **Dikkat:**
- `--dry-run` kullanarak önce neyin silineceğini kontrol edin
- Silinen run'lar **geri getirilemez**
- Token'ınızı asla commit etmeyin
- `.env` dosyasında veya environment variable olarak saklayın

## Troubleshooting

### "GitHub token not found" hatası

```bash
# Token'ı ayarlayın
export GH_TOKEN="github_pat_xxxxx"

# veya .env dosyasına ekleyin
echo "GH_TOKEN=github_pat_xxxxx" >> .env
```

### "403 Forbidden" hatası

Token izinlerini kontrol edin:
- Settings → Developer settings → Personal access tokens
- `repo` ve `workflow` izinlerinin seçili olduğundan emin olun

### Rate limiting hatası

Script her silme işlemi arasında 100ms bekler. Çok fazla run siliyorsanız:
- Daha küçük gruplar halinde silin
- `--older-than` parametresini kullanarak filtreleme yapın

## Otomatik Temizlik

GitHub Actions ile otomatik temizlik için bir workflow ekleyebilirsiniz:

```yaml
# .github/workflows/cleanup.yml
name: Cleanup Old Runs

on:
  schedule:
    - cron: '0 0 * * 0'  # Her Pazar gece yarısı
  workflow_dispatch:      # Manuel tetikleme

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Cleanup old workflow runs
        run: node scripts/cleanup-workflow-runs.js --status=failure --older-than=30
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Lisans

GPL-3.0
