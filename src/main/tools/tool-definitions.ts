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
            description: 'Belirtilen yoldaki dosyanŽñn iÇõeriŽYini okur. Metin dosyalarŽñ iÇõin kullanŽñn.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Okunacak dosyanŽñn yolu (Çôrn: C:/Users/kullanici/dosya.txt)'
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
            description: 'Belirtilen yola dosya yazar veya mevcut dosyayŽñ gÇ¬nceller.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'YazŽñlacak dosyanŽñn yolu'
                    },
                    content: {
                        type: 'string',
                        description: 'Dosyaya yazŽñlacak iÇõerik'
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
            description: 'Belirtilen klasÇôrdeki dosya ve alt klasÇôrleri listeler.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Listelenecek klasÇôrÇ¬n yolu'
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
            description: 'Yeni bir klasÇôr oluYturur.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'OluYturulacak klasÇôrÇ¬n yolu'
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
            description: 'Belirtilen dosyayŽñ siler.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Silinecek dosyanŽñn yolu'
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
            description: 'DosyanŽñn var olup olmadŽñŽYŽñnŽñ kontrol eder.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Kontrol edilecek dosyanŽñn yolu'
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
            description: 'PowerShell komutu ÇõalŽñYtŽñrŽñr. Sistem iYlemleri, dosya iYlemleri, aŽY iYlemleri vb. iÇõin kullanŽñn.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'ÇÅalŽñYtŽñrŽñlacak PowerShell komutu'
                    },
                    cwd: {
                        type: 'string',
                        description: 'Komutun ÇõalŽñYtŽñrŽñlacaŽYŽñ dizin (opsiyonel)'
                    }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_file_info',
            description: 'Dosya/klasÇôr bilgilerini (boyut, tarih vb.) dÇôndÇ¬rÇ¬r.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Bilgisi alŽñnacak yol'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'capture_screenshot',
            description: 'Ekran gÇôrÇ¬ntÇ¬sÇ¬ alŽñr.',
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
            name: 'capture_window',
            description: 'Belirtilen pencerenin ekran gÇôrÇ¬ntÇ¬sÇ¬nÇ¬ alŽñr (destekleniyorsa).',
            parameters: {
                type: 'object',
                properties: {
                    window_name: {
                        type: 'string',
                        description: 'Pencere adŽñ/baYlŽñYi'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_windows',
            description: 'ÇalŽñan pencereleri listeler (destekleniyorsa).',
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
            description: 'Belirtilen URL\'deki web sayfasŽñnŽñn iÇõeriŽYini Çõeker ve metin olarak dÇôndÇ¬rÇ¬r.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'ÇÅekilecek web sayfasŽñnŽñn URL\'i'
                    }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'fetch_json',
            description: 'Bir URL\'den JSON iÇõeriŽYi getirir.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'GET isteŽYi yapŽñlacak URL'
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
            description: 'Web\'de arama yapar ve sonuÇõlarŽñ dÇôndÇ¬rÇ¬r.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Arama sorgusu'
                    },
                    num_results: {
                        type: 'string',
                        description: 'DÇôndÇ¬rÇ¬lecek sonuÇõ sayŽñsŽñ (varsayŽñlan: 5)'
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
            description: 'Sistem bilgilerini dÇôndÇ¬rÇ¬r (hostname, kullanŽñcŽñ adŽñ, iYletim sistemi vb.)',
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
            description: 'DosyayŽñ bir konumdan baYka bir konuma kopyalar.',
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
            description: 'DosyayŽñ bir konumdan baYka bir konuma taYŽñr.',
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
