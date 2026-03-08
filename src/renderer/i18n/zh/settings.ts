const sectionData = {
    "searchPlaceholder": "搜索设置...",
    "searchResults": "找到 {count} 个匹配项",
    "noResults": "未找到设置",
    "title": "设置",
    "subtitle": "配置应用程序偏好。",
    "general": "常规",
    "accounts": "帐户",
    "models": "模型",
    "usage-limits": "使用限制",
    "appearance": "外观",
    "speech": "语音",
    "advanced": "高级",
    "developer": "开发者",
    "statistics": "统计",
    "gallery": "图库",
    "about": "关于",
    "personas": "角色",
    "factoryResetConfirm": "您确定要删除所有数据吗？",
    "language": "语言",
    "tabs": {
        "general": "一般的",
        "appearance": "外貌",
        "models": "型号",
        "accounts": "关联账户",
        "personas": "角色",
        "speech": "演讲",
        "statistics": "统计数据",
        "advanced": "先进的",
        "developer": "开发商",
        "about": "关于",
        "images": "图片",
        "mcpServers": "MCP 服务器",
        "accessibility": "无障碍",
        "mcpMarketplace": "MCP 市场"
    },
    "accessibility": {
        "title": "无障碍",
        "description": "定制您的体验以获得更好的可访问性",
        "highContrast": "高对比度模式",
        "highContrastDesc": "增加对比度以获得更好的可视性",
        "reducedMotion": "减少运动",
        "reducedMotionDesc": "最小化动画和过渡",
        "enhancedFocus": "增强的焦点指示器",
        "enhancedFocusDesc": "使焦点状态更加明显",
        "screenReader": "屏幕阅读器公告",
        "screenReaderDesc": "启用屏幕阅读器的公告",
        "systemPrefs": "系统偏好设置",
        "systemPrefsDesc": "某些设置会自动检测您的系统首选项。在操作系统中启用“减少运动”或“高对比度”以进行自动检测。",
        "shortcuts": "键盘快捷键",
        "tabNav": "在元素之间导航",
        "tabNavBack": "向后导航",
        "activate": "激活聚焦元素",
        "escape": "关闭模态或取消",
        "arrowNav": "在列表内导航"
    },
    "theme": "主题",
    "mcpServers": "MCP 服务器",
    "factoryReset": "恢复出厂设置",
    "usageLimits": {
        "title": "模型使用限制",
        "enable": "使能够",
        "maxPercentQuota": "剩余配额最大百分比(%)",
        "maxPercentPlaceholder": "50",
        "maxRequests": "最大请求数",
        "maxPercentage": "最大百分比 (%)",
        "maxRequestsPlaceholder": "5",
        "maxPercentagePlaceholder": "50",
        "typeLabel": "类型：",
        "limitLabel": "{{period}} 限额",
        "percentHint": "将限制为 {{count}} 请求（剩余 {{remaining}} 的 {{percentage}}%）",
        "types": {
            "requests": "要求",
            "percentage": "百分比"
        },
        "periods": {
            "hourly": "每小时",
            "daily": "日常的",
            "weekly": "每周"
        },
        "copilot": {
            "title": "Copilot",
            "current": "当前：剩余 {{remaining}} / {{limit}}"
        },
        "antigravity": {
            "title": "Antigravity 模型",
            "description": "根据每个型号的剩余配额设置百分比限制"
        },
        "codex": {
            "title": "Codex",
            "description": "根据每日/每周剩余配额设置百分比限制"
        }
    },
    "browserClosure": {
        "title": "需要关闭浏览器",
        "description": "要使用 {{provider}} 进行身份验证，Tengra 需要读取受保护的 cookie。",
        "warningPrefix": "我们必须",
        "warningEmphasis": "自动关闭您的浏览器",
        "warningSuffix": "释放文件锁。",
        "saveWork": "请先在浏览器中保存您的工作，然后再继续。我们将在不可见的情况下重新打开它以提取会话密钥。",
        "confirm": "关闭浏览器并连接"
    },
    "hyperparameters": {
        "title": "超参数",
        "temperature": {
            "label": "温度",
            "description": "创造力水平（0：确定性，2：非常有创造力）"
        },
        "topP": {
            "label": "顶P",
            "description": "核采样概率阈值"
        },
        "topK": {
            "label": "前K",
            "description": "最有可能考虑的代币数量"
        },
        "repeatPenalty": {
            "label": "重复处罚",
            "description": "重复惩罚（1：无，2：高）"
        }
    },
    "mcp": {
        "title": "模型上下文协议",
        "subtitle": "管理您的 MCP 服务器并安装新工具",
        "tabs": {
            "servers": "服务器",
            "marketplace": "市场"
        },
        "servers": {
            "title": "配置的服务器",
            "subtitle": "管理您的模型上下文协议服务器连接",
            "connect": "连接服务器",
            "empty": "没有连接服务器",
            "emptyHint": "从 Marketplace 选项卡安装服务器",
            "enabled": "已启用",
            "note": "笔记",
            "noteText": "AI 助手只能访问已启用的服务器。切换电源按钮以启用/禁用每个服务器。",
            "internalAlwaysEnabled": "内部工具始终启用"
        },
        "status": {
            "connected": "已连接",
            "disconnected": "已断开连接",
            "error": "错误",
            "enabled": "启用",
            "disabled": "残疾人",
            "active": "积极的",
            "inactive": "不活跃"
        }
    },
    "images": {
        "reinstallConfirm": "您确定要重新安装此映像吗？",
        "title": "图像设置",
        "description": "管理图像生成设置",
        "provider": "提供者",
        "localRuntime": "本地 Runtime",
        "remoteCloud": "远程云",
        "runtimeManagement": "Runtime 管理",
        "reinstall": "重新安装",
        "reinstallHelp": "如果损坏，请重新安装 runtime",
        "operationsTitle": "图像操作",
        "refreshData": "刷新图像数据",
        "historyTitle": "世代历史",
        "noHistory": "还没有图像生成历史。",
        "regenerate": "再生",
        "compareSelectionHint": "至少选择两个历史条目进行比较。",
        "compareRun": "运行比较",
        "compareClear": "清除选择",
        "compareTitle": "比较总结",
        "presetsTitle": "生成预设",
        "noPresets": "尚未保存预设。",
        "presetName": "预设名称",
        "promptPrefix": "提示符前缀",
        "savePreset": "保存预设",
        "schedulesTitle": "预定世代",
        "noSchedules": "没有预定的世代。",
        "schedulePrompt": "安排提示",
        "scheduleAt": "运行于",
        "scheduleCreate": "创建时间表",
        "scheduleCancel": "取消日程",
        "queueTitle": "生成队列",
        "queueStatus": "队列状态",
        "queueRunning": "跑步",
        "queueIdle": "闲置的",
        "batchTitle": "批量生成",
        "batchPrompts": "批量提示",
        "batchRun": "运行批次",
        "editTitle": "图像编辑",
        "editSource": "源图像路径或 URL",
        "editPrompt": "编辑提示",
        "editMode": "编辑模式",
        "editRun": "运行编辑"
    },
    "storageDashboard": {
        "title": "存储仪表板",
        "subtitle": "跟踪数据库使用情况和应用记录总数。",
        "loadError": "无法加载存储统计信息。",
        "dbSize": "数据库",
        "totalChats": "聊天",
        "totalMessages": "消息",
        "totalWorkspaces": "工作区"
    },
    "databaseSizeDashboard": {
        "title": "数据库大小",
        "subtitle": "按记录类型查看存储使用情况。",
        "loadError": "无法加载数据库统计信息。",
        "dbSize": "数据库",
        "chats": "聊天",
        "messages": "消息",
        "workspaces": "工作区",
        "folders": "文件夹",
        "prompts": "提示词"
    }
};

export default sectionData;
