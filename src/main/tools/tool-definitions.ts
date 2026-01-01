export interface ToolDefinition {
    type: 'function'
    function: {
        name: string
        description: string
        parameters: {
            type: 'object'
            properties: Record<string, {
                type: string
                description: string
                enum?: string[]
            }>
            required?: string[]
        }
    }
}

export const toolDefinitions: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Belirtilen yoldaki dosyanın içeriğini okur. Metin dosyaları için kullanın.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Okunacak dosyanın yolu (örn: C:/Users/kullanici/dosya.txt)'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'write_file',
            description: 'Belirtilen yola dosya yazar veya mevcut dosyayı günceller.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Yazılacak dosyanın yolu'
                    },
                    content: {
                        type: 'string',
                        description: 'Dosyaya yazılacak içerik'
                    }
                },
                required: ['path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_directory',
            description: 'Belirtilen klasördeki dosya ve alt klasörleri listeler.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Listelenecek klasörün yolu'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_directory',
            description: 'Yeni bir klasör oluşturur.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Oluşturulacak klasörün yolu'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_file',
            description: 'Belirtilen dosyayı siler.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Silinecek dosyanın yolu'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'file_exists',
            description: 'Dosyanın var olup olmadığını kontrol eder.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Kontrol edilecek dosyanın yolu'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'execute_command',
            description: 'PowerShell komutu çalıştırır. Sistem işlemleri, dosya işlemleri, ağ işlemleri vb. için kullanın.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'Çalıştırılacak PowerShell komutu'
                    },
                    cwd: {
                        type: 'string',
                        description: 'Komutun çalıştırılacağı dizin (opsiyonel)'
                    }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'capture_screenshot',
            description: 'Ekran görüntüsü alır.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'fetch_webpage',
            description: 'Belirtilen URL\'deki web sayfasının içeriğini çeker ve metin olarak döndürür.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'Çekilecek web sayfasının URL\'i'
                    }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_web',
            description: 'Web\'de arama yapar ve sonuçları döndürür.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Arama sorgusu'
                    },
                    num_results: {
                        type: 'string',
                        description: 'Döndürülecek sonuç sayısı (varsayılan: 5)'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_system_info',
            description: 'Sistem bilgilerini döndürür (hostname, kullanıcı adı, işletim sistemi vb.)',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'copy_file',
            description: 'Dosyayı bir konumdan başka bir konuma kopyalar.',
            parameters: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        description: 'Kaynak dosya yolu'
                    },
                    destination: {
                        type: 'string',
                        description: 'Hedef dosya yolu'
                    }
                },
                required: ['source', 'destination']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'move_file',
            description: 'Dosyayı bir konumdan başka bir konuma taşır.',
            parameters: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        description: 'Kaynak dosya yolu'
                    },
                    destination: {
                        type: 'string',
                        description: 'Hedef dosya yolu'
                    }
                },
                required: ['source', 'destination']
            }
        }
    }
]
