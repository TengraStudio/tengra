const sectionData = {
    "searchPlaceholder": "設定を検索...",
    "searchResults": "{count} 件の設定が見つかりました",
    "noResults": "設定が見つかりません",
    "title": "設定",
    "subtitle": "アプリケーションの設定を構成します。",
    "general": "一般",
    "accounts": "アカウント",
    "models": "モデル",
    "usage-limits": "使用制限",
    "appearance": "外観",
    "speech": "音声",
    "advanced": "詳細設定",
    "developer": "開発者",
    "statistics": "統計",
    "gallery": "ギャラリー",
    "about": "詳細",
    "personas": "ペルソナ",
    "factoryResetConfirm": "すべてのデータを削除してもよろしいですか？",
    "language": "言語",
    "tabs": {
        "general": "一般的な",
        "appearance": "外観",
        "models": "モデル",
        "accounts": "接続されたアカウント",
        "personas": "ペルソナ",
        "speech": "スピーチ",
        "statistics": "統計",
        "advanced": "高度な",
        "developer": "開発者",
        "about": "について",
        "images": "画像",
        "mcpServers": "MCP サーバー",
        "accessibility": "アクセシビリティ",
        "mcpMarketplace": "MCP マーケットプレイス"
    },
    "accessibility": {
        "title": "アクセシビリティ",
        "description": "アクセシビリティを向上させるためにエクスペリエンスをカスタマイズする",
        "highContrast": "ハイコントラストモード",
        "highContrastDesc": "コントラストを高めて視認性を向上させます",
        "reducedMotion": "モーションの軽減",
        "reducedMotionDesc": "アニメーションとトランジションを最小限に抑える",
        "enhancedFocus": "強化されたフォーカスインジケーター",
        "enhancedFocusDesc": "フォーカス状態をより見やすくする",
        "screenReader": "スクリーン リーダーのお知らせ",
        "screenReaderDesc": "スクリーンリーダーのアナウンスを有効にする",
        "systemPrefs": "システム環境設定",
        "systemPrefsDesc": "一部の設定では、システム設定が自動的に検出されます。自動検出のために、オペレーティング システムで「Reduced Motion」または「High Contrast」を有効にします。",
        "shortcuts": "キーボードショートカット",
        "tabNav": "要素間を移動する",
        "tabNavBack": "後方に移動する",
        "activate": "フォーカスされた要素をアクティブにする",
        "escape": "モーダルを閉じるかキャンセルします",
        "arrowNav": "リスト内を移動する"
    },
    "theme": "テーマ",
    "mcpServers": "MCP サーバー",
    "factoryReset": "工場出荷時設定にリセット",
    "usageLimits": {
        "title": "モデルの使用制限",
        "enable": "有効にする",
        "maxPercentQuota": "残りのクォータの最大パーセンテージ (%)",
        "maxPercentPlaceholder": "50",
        "maxRequests": "最大リクエスト数",
        "maxPercentage": "最大パーセンテージ (%)",
        "maxRequestsPlaceholder": "5",
        "maxPercentagePlaceholder": "50",
        "typeLabel": "タイプ：",
        "limitLabel": "{{period}} 制限",
        "percentHint": "{{count}} リクエストに制限されます ({{remaining}} の {{percentage}}% が残っています)",
        "types": {
            "requests": "リクエスト",
            "percentage": "パーセンテージ"
        },
        "periods": {
            "hourly": "毎時",
            "daily": "毎日",
            "weekly": "毎週"
        },
        "copilot": {
            "title": "Copilot",
            "current": "現在: {{remaining}} / {{limit}} 残り"
        },
        "antigravity": {
            "title": "Antigravity モデル",
            "description": "各モデルの残りのクォータに基づいてパーセンテージ制限を設定します"
        },
        "codex": {
            "title": "Codex",
            "description": "日次/週次の残りのクォータに基づいてパーセンテージ制限を設定します"
        }
    },
    "browserClosure": {
        "title": "ブラウザを閉じる必要があります",
        "description": "{{provider}} で認証するには、Tengra は保護された Cookie を読み取る必要があります。",
        "warningPrefix": "私たちはしなければなりません",
        "warningEmphasis": "ブラウザを自動的に閉じます",
        "warningSuffix": "ファイルのロックを解除します。",
        "saveWork": "続行する前に、ブラウザで作業内容を保存してください。セッションキーを抽出するために、非表示に再度開きます。",
        "confirm": "ブラウザを閉じて接続する"
    },
    "hyperparameters": {
        "title": "ハイパーパラメータ",
        "temperature": {
            "label": "温度",
            "description": "創造性レベル (0: 決定的、2: 非常に創造的)"
        },
        "topP": {
            "label": "トップP",
            "description": "核のサンプリング確率のしきい値"
        },
        "topK": {
            "label": "トップK",
            "description": "考慮すべき最も可能性の高いトークンの数"
        },
        "repeatPenalty": {
            "label": "リピートペナルティ",
            "description": "繰り返しペナルティ (1: なし、2: 高い)"
        }
    },
    "mcp": {
        "title": "モデルコンテキストプロトコル",
        "subtitle": "MCP サーバーを管理し、新しいツールをインストールする",
        "tabs": {
            "servers": "サーバー",
            "marketplace": "市場"
        },
        "servers": {
            "title": "構成されたサーバー",
            "subtitle": "Model Context Protocol サーバー接続を管理する",
            "connect": "サーバーに接続する",
            "empty": "サーバーが接続されていません",
            "emptyHint": "「マーケットプレイス」タブからサーバーをインストールする",
            "enabled": "有効",
            "note": "注記",
            "noteText": "AI アシスタントは、有効なサーバーのみにアクセスできます。電源ボタンを切り替えて、各サーバーを有効または無効にします。",
            "internalAlwaysEnabled": "内部ツールは常に有効になっています"
        },
        "status": {
            "connected": "接続済み",
            "disconnected": "切断されました",
            "error": "エラー",
            "enabled": "有効",
            "disabled": "無効",
            "active": "アクティブ",
            "inactive": "非アクティブ"
        }
    },
    "images": {
        "reinstallConfirm": "このイメージを再インストールしてもよろしいですか?",
        "title": "画像設定",
        "description": "画像生成設定を管理する",
        "provider": "プロバイダー",
        "localRuntime": "ローカル Runtime",
        "remoteCloud": "リモートクラウド",
        "runtimeManagement": "Runtime 管理",
        "reinstall": "再インストール",
        "reinstallHelp": "runtime が破損している場合は再インストールします",
        "operationsTitle": "画像の操作",
        "refreshData": "画像データの更新",
        "historyTitle": "世代の歴史",
        "noHistory": "画像生成履歴はまだありません。",
        "regenerate": "再生する",
        "compareSelectionHint": "比較する履歴エントリを少なくとも 2 つ選択します。",
        "compareRun": "比較を実行する",
        "compareClear": "選択をクリア",
        "compareTitle": "比較の概要",
        "presetsTitle": "生成プリセット",
        "noPresets": "プリセットはまだ保存されていません。",
        "presetName": "プリセット名",
        "promptPrefix": "プロンプトプレフィックス",
        "savePreset": "プリセットの保存",
        "schedulesTitle": "スケジュールされた世代",
        "noSchedules": "スケジュールされた世代はありません。",
        "schedulePrompt": "スケジュールプロンプト",
        "scheduleAt": "実行時",
        "scheduleCreate": "スケジュールの作成",
        "scheduleCancel": "スケジュールをキャンセルする",
        "queueTitle": "生成キュー",
        "queueStatus": "キューのステータス",
        "queueRunning": "ランニング",
        "queueIdle": "アイドル状態",
        "batchTitle": "バッチ生成",
        "batchPrompts": "バッチプロンプト",
        "batchRun": "バッチの実行",
        "editTitle": "画像編集",
        "editSource": "ソース画像のパスまたは URL",
        "editPrompt": "プロンプトの編集",
        "editMode": "編集モード",
        "editRun": "編集を実行"
    }
};

export default sectionData;
