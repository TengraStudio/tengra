const sectionData = {
    "editor": "Editör",
    "council": "YZ Konseyi",
    "logs": "Günlükler",
    "terminal": "Terminal",
    "files": "Dosyalar",
    "toggleAgentPanel": "Ajan panelini aç/kapat",
    "addMount": "Dizin ekle",
    "addFirstMount": "İlk bağlantıyı ekle",
    "addConnection": "Bağlantı ekle",
    "noMounts": "Bağlı klasör yok",
    "removeMount": "Bağlantıyı kaldır",
    "emptyFolder": "Bu klasör boş",
    "newFile": "Yeni dosya",
    "newFolder": "Yeni klasör",
    "rename": "Yeniden adlandır",
    "currentBranch": "Geçerli dal",
    "typeCommand": "Bir komut yazın...",
    "writeSomething": "Bir şeyler yaz...",
    "stopSpeaking": "Konuşmayı durdur",
    "speakCode": "Kodu oku",
    "improvePrompt": "İyileştir",
    "improvePromptWithAI": "YZ ile istemi iyileştir",
    "uploadOriginal": "Orijinal görseli yükle",
    "applyLogo": "Bu logoyu uygula",
    "uploadImage": "Kendi görselini yükle",
    "totalSize": "Toplam boyut",
    "todoList": "Yaklaşan görevler",
    "dangerZone": "Tehlikeli bölge",
    "uploadManualImage": "Manuel görsel yükle",
    "crafting": "Oluşturuluyor...",
    "previewArea": "Önizleme alanı",
    "encoding": "Kodlama",
    "language": "Dil",
    "fileLabels": {
        "plainText": "Düz metin",
        "encodingUtf8": "UTF-8",
        "encodingUtf8Bom": "UTF-8 BOM",
        "encodingUtf1632": "UTF-16/32",
        "encodingAscii": "ASCII"
    },
    "convertToCode": "Koda dönüştür",
    "pinTab": "Sekmeyi sabitle",
    "unpinTab": "Sekme sabitlemesini kaldır",
    "closeTab": "Sekmeyi kapat",
    "closeAllTabs": "Tüm sekmeleri kapat",
    "closeTabsToRight": "Sağdaki sekmeleri kapat",
    "closeOtherTabs": "Diğer sekmeleri kapat",
    "copyPath": "Yolu kopyala",
    "copyRelativePath": "Göreli yolu kopyala",
    "revealInExplorer": "Dosya gezgininde göster",
    "revealedInExplorer": "Dosya gezgini açıldı.",
    "revealInExplorerFailed": "Dosya gezgini açılamadı.",
    "pathCopied": "Yol panoya kopyalandı.",
    "relativePathCopied": "Göreli yol panoya kopyalandı.",
    "pathCopyFailed": "Yol kopyalanamadı.",
    "placeholders": {
        "rootPath": "Kök dizin",
        "name": "İsim..."
    },
    "run": "Çalışma alanını çalıştır",
    "toggleSidebar": "Kenar çubuğunu aç/kapat",
    "aiAssistant": "YZ Asistanı",
    "aiLabel": "YZ",
    "online": "Çevrimiçi",
    "dev": "GELİŞTİRME",
    "loadingBranches": "Dallar yükleniyor...",
    "noBranchesFound": "Dal bulunamadı",
    "switchingBranch": "Dal değiştiriliyor...",
    "branchSwitched": "{{branch}} dalına geçildi.",
    "branchSwitchFailed": "Dal değiştirilemedi.",
    "errors": {
        "emptyName": "Çalışma alanı adı boş olamaz",
        "todoFileChanged": "Dosya içeriği değişti, lütfen yenileyin.",
        "explorer": {
            "invalidMountSelected": "Geçersiz bağlama noktası seçildi. Lütfen yenileyip tekrar deneyin.",
            "invalidFilePath": "Geçersiz dosya yolu. Lütfen yolu kontrol edip tekrar deneyin.",
            "mountNotFound": "Bağlama noktası bulunamadı. Kaldırılmış olabilir.",
            "entryNotFound": "Dosya veya klasör bulunamadı. Silinmiş olabilir.",
            "invalidPath": "Geçersiz yol. Yol izin verilmeyen karakterler içeriyor.",
            "permissionDenied": "Erişim reddedildi. Bu kaynağa erişim izniniz yok.",
            "validationError": "Doğrulama hatası. Lütfen girdinizi kontrol edin.",
        "unsupportedOperation": "Bu işlem desteklenmiyor.",
            "unexpected": "Beklenmeyen bir hata oluştu."
        },
        "fileOps": {
            "read": "Dosya okunamadı",
            "write": "Dosya yazılamadı",
            "delete": "Dosya silinemedi",
            "rename": "Dosya yeniden adlandırılamadı",
            "create": "Dosya oluşturulamadı",
            "move": "Dosya taşınamadı",
            "copy": "Dosya kopyalanamadı",
            "list": "Dizin listelenemedi"
        },
        "wizard": {
            "invalidInput": "Geçersiz girdi",
            "connectionFailed": "Bağlantı başarısız",
            "connectFailed": "Bağlanılamadı",
            "createWorkspaceFailed": "Çalışma alanı oluşturulamadı",
            "selectDirectoryFailed": "Dizin seçilemedi"
        },
        "todoCanvas": {
            "exportTitle": "Tuval TODO Dışa Aktarımı",
            "dependenciesHeading": "Bağımlılıklar",
            "untitledTask": "Başlıksız Görev",
            "untitled": "Başlıksız",
            "defaultCategory": "Genel"
        },
        "logoGenerator": {
            "generatedResults": "Üretilen Sonuçlar",
            "pickLogo": "Hemen uygulamak için bir logo seçin.",
            "resultsCount": "{{count}} sonuç",
            "singleResultCount": "1 sonuç",
            "noLogosYet": "Henüz logo üretilmedi",
            "configureAndGenerate": "Ayarları yapılandırın ve Üret'e tıklayın"
        }
    },
    "notifications": {
        "sshConnectedAfterAttempts": "{{count}} denemeden sonra SSH bağlantısı kuruldu.",
        "sshConnectRetry": "SSH bağlantısı tekrar deneniyor {{attempt}}/{{max}}...",
        "sshImagePreviewNotSupported": "SSH görsel önizleme henüz desteklenmiyor.",
        "fileCreated": "Dosya oluşturuldu.",
        "folderCreated": "Klasör oluşturuldu.",
        "entryRenamed": "Öğe yeniden adlandırıldı.",
        "entryDeleted": "Öğe silindi.",
        "entryMoved": "Öğe taşındı.",
        "fileSaved": "Dosya kaydedildi.",
        "saveFailed": "Kaydetme başarısız oldu."
    },
    "listOps": {
        "updating": "Çalışma alanı güncelleniyor...",
        "deleting": "Çalışma alanı siliniyor...",
        "archiving": "Çalışma alanı arşivleniyor...",
        "bulkDeleting": "{{count}} çalışma alanı siliniyor...",
        "bulkArchiving": "{{count}} çalışma alanı arşivleniyor...",
        "creating": "Çalışma alanı oluşturuluyor...",
        "updateFailed": "Çalışma alanı güncellenemedi",
        "deleteFailed": "Çalışma alanı silinemedi",
        "archiveFailed": "Çalışma alanı arşivlenemedi",
        "bulkDeleteFailed": "Toplu çalışma alanı silme başarısız oldu",
        "bulkArchiveFailed": "Toplu çalışma alanı arşivleme başarısız oldu",
        "createFailed": "Çalışma alanı oluşturulamadı",
        "duplicateRemotePath": "Bu uzak yol için zaten bir çalışma alanı var.",
        "duplicateLocalDirectory": "Bu yerel dizin için zaten bir çalışma alanı var.",
        "createMissingWorkspace": "Çalışma alanı oluşturma işlemi kayıtlı bir çalışma alanı döndürmedi."
    },
    "issueBanner": {
        "workspaceFallback": "çalışma alanı",
        "startupChecks": "{{workspace}} için başlangıç kontrolleri ({{mode}} modu)",
        "openingMode": {
            "fast": "hızlı",
            "full": "tam"
        },
        "securityPosture": "Güvenlik duruşu: {{risk}} risk",
        "maxConcurrentOps": "maksimum eşzamanlı işlem: {{count}}",
        "fixPrefix": "Düzeltme:",
        "runbooks": "Runbook'lar",
        "running": "Çalışıyor…",
        "runLabel": "{{label}} çalıştır",
        "runbookTimeline": "Runbook zaman çizelgesi",
        "preparingRunbook": "{{label}} hazırlanıyor...",
        "rollbackHint": "Geri alma ipucu: {{hint}}",
        "runbookStatus": {
            "success": "Başarılı",
            "failed": "Başarısız"
        },
        "runbookLabels": {
            "setup": "Kurulum",
            "build": "Derleme",
            "test": "Test",
            "release": "Sürüm Hazırlığı"
        },
        "runbookRollbackHints": {
            "setup": "Kurulum gerilemeye neden olduysa oluşturulan bağımlılıkları ve kilit dosyası güncellemelerini silin.",
            "build": "Derleme yapılandırmasını veya oluşturulan dosyaları son bilinen sağlıklı commit'e geri döndürün.",
            "test": "Testleri bozan son kaynak/yapılandırma değişikliklerini geri alın.",
            "release": "Sürüm akışını durdurun, önceki dağıtım yapılandırmasını geri yükleyin ve doğrulama kontrollerini yeniden çalıştırın."
        },
        "securityFindings": {
            "envFilesDetected": "Ortam dosyaları tespit edildi. Hassas anahtarların VCS dışında tutulduğundan emin olun.",
            "lockFileMissing": "Bağımlılık kilit dosyası yok; bağımlılık tedarik zinciri riski daha yüksek.",
            "evaluationUnavailable": "Güvenlik duruşu tam olarak değerlendirilemedi."
        },
        "runbookTimelineMessages": {
            "queued": "Runbook kuyruğa alındı",
            "failedBeforeExecution": "Çalıştırmadan önce başarısız oldu",
            "invalidPathOrCommand": "Geçersiz çalışma alanı yolu veya runbook komutu.",
            "startedCommand": "Komut başlatıldı: {{command}}",
            "completedSuccessfully": "Başarıyla tamamlandı",
            "failedWithCode": "{{code}} koduyla başarısız oldu"
        },
        "preflightIssues": {
            "mount": {
                "missingPath": {
                    "message": "Çalışma alanı yolu eksik.",
                    "fixAction": "Çalışma alanı ayarlarını güncelleyin ve açmadan önce geçerli bir kök yol belirleyin."
                },
                "pathNotFound": {
                    "message": "Çalışma alanı yolu bulunamadı: {{path}}",
                    "fixAction": "Sürücüyü yeniden bağlayın veya çalışma alanı ayarlarından yolu güncelleyin."
                },
                "multiRootLabelMissing": {
                    "message": "Bir veya daha fazla bağlama noktasının etiketi eksik.",
                    "fixAction": "Çoklu kök gezgin etiketlerini net tutmak için her bağlama noktasına farklı bir ad verin."
                }
            },
            "terminal": {
                "unavailable": {
                    "message": "Kullanılabilir bir terminal arka ucu yok.",
                    "fixAction": "Bir terminal arka ucunu (PowerShell, cmd veya desteklenen başka bir kabuk) yükleyin ya da etkinleştirin."
                }
            },
            "analysis": {
                "indexingDisabled": {
                    "message": "Arka plan indeksleme devre dışı.",
                    "fixAction": "Çalışma alanı zekâsı ve gezinme için çalışma alanı ayarlarından indekslemeyi etkinleştirin."
                }
            },
            "git": {
                "repositoryMissing": {
                    "message": "Bu klasör bir Git deposu değil.",
                    "fixAction": "Çalışma alanı akışlarını açmadan önce \"git init\" çalıştırın veya depoyu klonlayın."
                }
            },
            "policy": {
                "mainDirty": {
                    "message": "Politika uyarısı: korumalı {{branch}} dalında çalışma ağacı kirli.",
                    "fixAction": "Bir özellik dalına commit atın, ardından inceleme ile birleştirin."
                }
            },
            "toolchain": {
                "nodeMissing": {
                    "message": "Bu çalışma alanı için Node.js gerekli.",
                    "fixAction": "Node.js yükleyin ve terminalde \"node --version\" komutunun çalıştığını doğrulayın."
                },
                "npmMissing": {
                    "message": "Bu çalışma alanı için npm gerekli.",
                    "fixAction": "npm'i (genellikle Node.js ile birlikte) yükleyin ve \"npm --version\" komutunun çalıştığını doğrulayın."
                },
                "pythonMissing": {
                    "message": "Bu çalışma alanı için Python gerekli.",
                    "fixAction": "Python yükleyin ve terminalde \"python --version\" komutunun çalıştığını doğrulayın."
                },
                "goMissing": {
                    "message": "Bu çalışma alanı için Go gerekli.",
                    "fixAction": "Go yükleyin ve terminalde \"go version\" komutunun çalıştığını doğrulayın."
                },
                "nodeUnpinned": {
                    "message": "Node çalışma zamanı bu çalışma alanında sabitlenmemiş.",
                    "fixAction": "Çalışma alanı bazında Node sürümünü sabitlemek için .nvmrc veya .tool-versions ekleyin."
                },
                "pythonUnpinned": {
                    "message": "Python çalışma zamanı bu çalışma alanında sabitlenmemiş.",
                    "fixAction": "Ortam kaymasını önlemek için .python-version veya .tool-versions ekleyin."
                }
            }
        },
        "filters": {
            "severity": {
                "all": "Tüm önem düzeyleri",
                "error": "Hatalar",
                "warning": "Uyarılar",
                "info": "Bilgi"
            },
            "source": {
                "all": "Tüm kaynaklar",
                "mount": "Bağlama",
                "git": "Git",
                "task": "Görev",
                "analysis": "Analiz",
                "terminal": "Terminal",
                "policy": "Politika",
                "security": "Güvenlik",
                "toolchain": "Araç zinciri"
            }
        }
    },
    "listPresetTitle": "Liste ön ayarı",
    "listPresetRecent": "En yeni önce",
    "listPresetOldest": "En eski önce",
    "listPresetNameAz": "Ada göre A-Z",
    "listPresetNameZa": "Ada göre Z-A",
    "openTitle": "Aç",
    "shortcuts": "Kısayollar",
    "quickSwitch": "Sekmeleri hızlı değiştir",
    "toggleTerminal": "Terminali aç/kapat",
    "todoLinePrefix": "Satır",
    "shortcutHelpTitle": "Çalışma Alanı Kısayolları",
    "shortcutCombos": {
        "commandPalette": "Ctrl/Cmd + K",
        "quickSwitch": "Ctrl/Cmd + P",
        "closeTab": "Ctrl/Cmd + W",
        "toggleHelp": "Ctrl/Cmd + /",
        "toggleTerminal": "`"
    },
    "terminalStatusTerm": "TERM",
    "terminalStatusSsh": "SSH",
    "terminalStatusDocker": "Docker",
    "terminalStatusReady": "hazır",
    "terminalStatusUnavailable": "kullanılamıyor",
    "todoUndoTitle": "Geri al (Ctrl/Cmd+Z)",
    "todoRedoTitle": "Yinele (Ctrl/Cmd+Y)",
};

export default sectionData;





