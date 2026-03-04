const sectionData = {
    "title": "プロジェクトアイデア",
    "subtitle": "市場調査を伴うAI駆動のプロジェクトアイデア生成",
    "newSession": "新規セッション",
    "selectModel": "AIモデルを選択",
    "selectCategories": "カテゴリを選択",
    "maxIdeas": "最大アイデア数",
    "startResearch": "リサーチを開始",
    "startGeneration": "アイデアを生成",
    "cancel": "キャンセル",
    "categories": {
        "website": "ウェブサイト",
        "mobileApp": "モバイルアプリ",
        "game": "ゲーム",
        "cliTool": "CLIツール",
        "apiBackend": "API / バックエンド",
        "desktop": "デスクトップアプリ",
        "other": "その他"
    },
    "research": {
        "title": "リサーチパイプライン",
        "understanding": "カテゴリの理解",
        "sectorAnalysis": "セクター分析",
        "marketResearch": "市場調査",
        "competitorAnalysis": "競合分析",
        "complete": "リサーチ完了"
    },
    "generation": {
        "title": "アイデアを生成中",
        "progress": "アイデアを生成中 {{current}} / {{total}}",
        "enriching": "アイデアの詳細を充実させています...",
        "complete": "生成完了"
    },
    "idea": {
        "viewDetails": "詳細を表示",
        "approve": "承認してプロジェクトを作成",
        "reject": "却下",
        "nameSuggestions": "名前の提案",
        "valueProposition": "バリュー・プロポジション",
        "competitiveAdvantages": "競争優位性",
        "marketTrends": "市場動向",
        "competitors": "競合他社",
        "selectPath": "プロジェクトパスを選択",
        "creating": "プロジェクトを作成中...",
        "detailedDescription": "詳細な説明",
        "roadmap": "プロジェクトロードマップ",
        "techStack": "技術スタック",
        "competitorAnalysis": "競合分析",
        "archive": "アーカイブ",
        "archiving": "アーカイブ中...",
        "pathPlaceholder": "C:\\プロジェクト\\私のプロジェクト",
        "technicalDetails": "技術的な詳細",
        "impact": "インパクト",
        "impactHigh": "高い (推定)",
        "effort": "努力",
        "effortMedium": "中くらい",
        "openFullProject": "完全なプロジェクトを開く"
    },
    "techStack": {
        "frontend": "フロントエンド",
        "backend": "バックエンド",
        "database": "データベース",
        "infrastructure": "インフラ",
        "other": "その他のツール"
    },
    "competitor": {
        "strengths": "強み",
        "weaknesses": "弱み",
        "missingFeatures": "不足している機能",
        "opportunity": "差別化の機会"
    },
    "stages": {
        "seedGeneration": "初期コンセプトを生成中...",
        "ideaResearch": "このアイデアの市場をリサーチ中...",
        "naming": "名前の提案を作成中...",
        "longDescription": "詳細な説明を執筆中...",
        "roadmap": "プロジェクトロードマップを構築中...",
        "techStack": "技術スタックを選択中...",
        "competitorAnalysis": "競合を分析中...",
        "finalizing": "アイデアを最終調整中...",
        "complete": "アイデア完了"
    },
    "logo": {
        "title": "ロゴ生成",
        "generate": "ロゴを生成",
        "generating": "ロゴを生成中...",
        "requiresAntigravity": "ロゴ生成にはAntigravityの接続が必要です",
        "promptPlaceholder": "ロゴのコンセプトを説明してください..."
    },
    "status": {
        "active": "アクティブ",
        "researching": "リサーチ中",
        "generating": "生成中",
        "completed": "完了",
        "cancelled": "キャンセル済み",
        "pending": "待機中",
        "approved": "承認済み",
        "rejected": "却下済み",
        "archived": "アーカイブ済み"
    },
    "errors": {
        "modelRequired": "モデルを選択してください",
        "categoriesRequired": "少なくとも1つのカテゴリを選択してください",
        "researchFailed": "リサーチに失敗しました。もう一度お試しください。",
        "generationFailed": "アイデア生成に失敗しました。もう一度お試しください。",
        "approvalFailed": "プロジェクトの作成に失敗しました。もう一度お試しください。",
        "logoFailed": "ロゴ生成に失敗しました。もう一度お試しください。"
    },
    "empty": {
        "noSessions": "アイデアセッションはまだありません",
        "noSessionsDesc": "新しいセッションを開始してプロジェクトアイデアを生成しましょう",
        "noIdeas": "アイデアは生成されていません",
        "noIdeasDesc": "リサーチフェーズを完了してアイデアを生成してください"
    },
    "history": {
        "title": "アイデア履歴",
        "subtitle": "過去のすべてのアイデア生成セッションを閲覧",
        "view": "履歴を表示",
        "totalSessions": "総セッション数",
        "completed": "完了",
        "approvedIdeas": "承認済みアイデア",
        "pendingReview": "レビュー待ち",
        "viewDetails": "詳細を表示",
        "noIdeasYet": "アイデアはまだ生成されていません",
        "daysAgo": "{{count}} 日前",
        "ideasCount": "生み出されたアイデア",
        "ideasSelected": "{{count}} 個のアイデアが選択されました",
        "clearSelection": "選択をクリア",
        "deleteSelected": "選択したものを削除",
        "activeFilters": "アクティブフィルター:",
        "clearFilters": "すべてクリア",
        "ideasGenerated": "{{current}} / {{total}} のアイデア",
        "ideasGeneratedCount": "{{count}} 個のアイデアが生成されました",
        "filter": {
            "searchLabel": "検索",
            "statusLabel": "状態",
            "categoryLabel": "カテゴリ"
        }
    },
    "modelSelectorHint": "上部バーのモデルセレクターを使用してAIモデルを変更します。",
    "backToSetup": "セットアップに戻る",
    "search": {
        "placeholder": "タイトルまたは説明でアイデアを検索..."
    },
    "filter": {
        "allStatuses": "すべてのステータス",
        "allCategories": "すべてのカテゴリ",
        "pending": "保留中",
        "approved": "承認された",
        "rejected": "拒否されました"
    },
    "export": {
        "button": "輸出",
        "markdown": "Markdown としてエクスポート",
        "json": "JSON としてエクスポート"
    },
    "customPrompt": {
        "label": "カスタム要件",
        "optional": "オプション",
        "placeholder": "例: TypeScript を使用する必要がある、アクセシビリティに重点を置く、中小企業をターゲットにする...",
        "hint": "AI がアイデア生成中に考慮する特定の制約または要件を追加します。"
    },
    "previewMarket": "市場調査のプレビュー",
    "marketPreview": {
        "title": "市場調査プレビュー",
        "subtitle": "選択したカテゴリの市場概要を簡単に確認できます",
        "loading": "市況を分析中...",
        "keyTrends": "主要な傾向",
        "marketSize": "市場規模",
        "empty": "利用可能なプレビュー データがありません",
        "continue": "徹底的な研究を続ける"
    },
    "delete": {
        "title": "アイデアの削除",
        "bulkTitle": "複数のアイデアを削除する",
        "message": "このアイデアを削除してもよろしいですか?この操作は元に戻すことができません。",
        "bulkMessage": "{{count}} 個のアイデアを削除してもよろしいですか?この操作は元に戻すことができません。"
    },
    "details": {
        "tabs": {
            "overview": "概要",
            "market": "市場分析",
            "strategy": "戦略",
            "users": "ユーザープロフィール",
            "business": "ビジネスケース",
            "technology": "テクノロジー",
            "roadmap": "ロードマップ"
        },
        "statusLabel": "状態",
        "readyForPilot": "パイロットの準備完了",
        "projectCreated": "プロジェクトが作成されました",
        "projectNamePlaceholder": "プロジェクト名",
        "regenerateTitle": "このアイデアを再現する",
        "regenerate": "再生する",
        "regenerating": "再生中...",
        "deleteTitle": "アイデアの削除",
        "closeTitle": "閉じる (Esc)",
        "rejectTitle": "このアイデアを拒否しますか?",
        "rejectBody": "「{{title}}」を拒否してもよろしいですか?この操作は元に戻すことができません。",
        "rejectReasonLabel": "理由 (オプション)",
        "rejectReasonPlaceholder": "なぜこの考えを拒否するのですか？",
        "rejectAction": "アイデアを拒否する",
        "rejecting": "拒否しています...",
        "altLabel": "代替:",
        "targetPersonas": "対象人物",
        "painPoints": "問題点",
        "userJourney": "ユーザージャーニーマップ",
        "benefitLabel": "特典: {{benefit}}",
        "swot": {
            "title": "SWOT分析",
            "strengths": "強み",
            "weaknesses": "弱点",
            "opportunities": "機会",
            "threats": "脅威"
        },
        "revenueModel": "収益モデル",
        "breakEvenStrategy": "損益分岐点戦略",
        "costStructure": "コスト構造",
        "goToMarket": "市場開拓計画",
        "first100Users": "最初の 100 ユーザー戦略",
        "researchAssistant": "研究助手",
        "researchEmpty": "このアイデアに関する市場調査、競合、技術スタックについて何でも聞いてください。",
        "researchPlaceholder": "競合他社、ギャップ、ロジックについて質問してください...",
        "researchError": "申し訳ありませんが、今研究室に行くことができませんでした。",
        "coreConcept": "コアコンセプト",
        "visualIdentity": "ビジュアルアイデンティティ",
        "editDescriptionPlaceholder": "説明を編集...",
        "categoryAnalysis": "カテゴリ分析",
        "analysisPending": "詳細な分析が保留中です..."
    },
    "detailsTitlePlaceholder": "アイデアのタイトルを入力してください...",
    "detailsDescriptionPlaceholder": "アイデアの説明を入力してください..."
};

export default sectionData;
