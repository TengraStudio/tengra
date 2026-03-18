const sectionData = {
    "editor": "Editör",
    "council": "AI Konseyi",
    "logs": "Günlükler",
    "terminal": "Terminal",
    "files": "Dosyalar",
    "toggleAgentPanel": "Ajan panelini aç/kapat",
    "addMount": "Dizin Ekle",
    "addFirstMount": "Add the first mount",
    "addConnection": "Bağlantı Ekle",
    "noMounts": "Bağlı klasör yok",
    "removeMount": "Bağlantıyı Kaldır",
    "emptyFolder": "Bu klasör boş",
    "newFile": "Yeni Dosya",
    "newFolder": "Yeni Klasör",
    "rename": "Yeniden Adlandır",
    "currentBranch": "Mevcut Dal",
    "typeCommand": "Bir komut yazın...",
    "writeSomething": "Bir şeyler yaz...",
    "stopSpeaking": "Konuşmayı Durdur",
    "speakCode": "Kodu Oku",
    "improvePrompt": "İyileştir",
    "improvePromptWithAI": "AI ile prompt iyileştir",
    "uploadOriginal": "Manuel Görsel Yükle",
    "applyLogo": "Bu logoyu uygula",
    "uploadImage": "Kendi görselini yükle",
    "totalSize": "Toplam Boyut",
    "todoList": "Yaklaşan Görevler",
    "dangerZone": "Tehlikeli Bölge",
    "uploadManualImage": "Manuel Görsel Yükle",
    "crafting": "Oluşturuluyor...",
    "previewArea": "Önizleme Alanı",
    "encoding": "Kodlama",
    "language": "Dil",
    "fileLabels": {
        "plainText": "Plain Text",
        "encodingUtf8": "UTF-8",
        "encodingUtf8Bom": "UTF-8 BOM",
        "encodingUtf1632": "UTF-16/32",
        "encodingAscii": "ASCII"
    },
    "convertToCode": "Koda Çevir",
    "pinTab": "Sekmeyi Sabitle",
    "unpinTab": "Sekme Sabitlemesini Kaldır",
    "closeTab": "Sekmeyi Kapat",
    "closeAllTabs": "Tüm Sekmeleri Kapat",
    "closeTabsToRight": "Sağdaki Sekmeleri Kapat",
    "closeOtherTabs": "Diğer Sekmeleri Kapat",
    "copyPath": "Yolu Kopyala",
    "copyRelativePath": "Göreli Yolu Kopyala",
    "revealInExplorer": "Dosya Gezgininde Göster",
    "revealedInExplorer": "Dosya gezgini açıldı.",
    "revealInExplorerFailed": "Dosya gezgini açılamadı.",
    "pathCopied": "Yol panoya kopyalandı.",
    "relativePathCopied": "Göreli yol panoya kopyalandı.",
    "pathCopyFailed": "Yol kopyalanamadı.",
    "placeholders": {
        "rootPath": "Kök dizin",
        "name": "İsim..."
    },
    "run": "Çalışma Alanını Çalıştır",
    "toggleSidebar": "Kenar Çubuğunu Aç/Kapat",
    "aiAssistant": "AI Asistan",
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
        "todoFileChanged": "File content changed, please refresh",
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
        "sshConnectedAfterAttempts": "SSH connected after {{count}} attempts.",
        "sshConnectRetry": "SSH connect retry {{attempt}}/{{max}}...",
        "sshImagePreviewNotSupported": "SSH image preview not supported yet.",
        "fileCreated": "File created.",
        "folderCreated": "Folder created.",
        "entryRenamed": "Entry renamed.",
        "entryDeleted": "Entry deleted.",
        "entryMoved": "Entry moved.",
        "fileSaved": "File saved.",
        "saveFailed": "Save failed."
    },
    "listOps": {
        "updating": "Updating workspace...",
        "deleting": "Deleting workspace...",
        "archiving": "Archiving workspace...",
        "bulkDeleting": "Deleting {{count}} workspaces...",
        "bulkArchiving": "Archiving {{count}} workspaces...",
        "creating": "Creating workspace...",
        "updateFailed": "Failed to update workspace",
        "deleteFailed": "Failed to delete workspace",
        "archiveFailed": "Failed to archive workspace",
        "bulkDeleteFailed": "Failed to bulk delete workspaces",
        "bulkArchiveFailed": "Failed to bulk archive workspaces",
        "createFailed": "Failed to create workspace",
        "duplicateRemotePath": "A workspace already exists for this remote path.",
        "duplicateLocalDirectory": "A workspace already exists for this local directory.",
        "createMissingWorkspace": "Workspace creation did not return a saved workspace."
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
    "listPresetTitle": "List preset",
    "listPresetRecent": "Recent first",
    "listPresetOldest": "Oldest first",
    "listPresetNameAz": "Name A-Z",
    "listPresetNameZa": "Name Z-A",
    "openTitle": "Open",
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
    "terminalStatusReady": "ready",
    "terminalStatusUnavailable": "unavailable",
    "todoUndoTitle": "Undo (Ctrl/Cmd+Z)",
    "todoRedoTitle": "Redo (Ctrl/Cmd+Y)",
};

export default sectionData;





