const sectionData = {
    "title": "接続済みアカウント",
    "subtitle": "外部サービスとAPI接続を管理します。",
    "categories": {
        "aiProviders": "AIプロバイダー",
        "developerTools": "開発ツール",
        "localModels": "ローカルモデル"
    },
    "providers": {
        "github": {
            "name": "GitHub",
            "description": "ソースコードのホスティングとコラボレーション"
        },
        "copilot": {
            "name": "GitHub Copilot",
            "description": "AI支援によるコード補完"
        },
        "antigravity": {
            "name": "Antigravity",
            "description": "クラウドAIサービスとWebアクセス"
        },
        "codex": {
            "name": "OpenAI / ChatGPT",
            "description": "GPT-4および高度な言語モデル"
        },
        "claude": {
            "name": "Claude",
            "description": "Anthropic Claude 推論モデル"
        },
        "ollama": {
            "name": "Ollama",
            "description": "AIモデルをローカルで実行"
        },
        "nvidia": {
            "name": "エヌビディア",
            "description": "ローカル GPU アクセラレーションとモデル runtime"
        }
    },
    "connected": "接続済み",
    "disconnected": "未接続",
    "running": "実行中",
    "notRunning": "停止中",
    "active": "有効",
    "connect": "接続",
    "disconnect": "切断",
    "switchAccount": "アカウントを切り替え",
    "addAnotherAccount": "別のアカウントを追加",
    "setActive": "有効にする",
    "removeAccount": "削除",
    "accountCount": "{{count}} 個のアカウント",
    "accountCountPlural": "{{count}} 個のアカウント",
    "noAccounts": "リンクされたアカウントはありません",
    "serverAddress": "サーバーアドレス",
    "contextLimit": "コンテキスト制限",
    "check": "チェック",
    "start": "起動",
    "apiKey": "APIキー",
    "enterApiKey": "APIキーを入力...",
    "githubDesc": "GitHubプロファイルとリポジトリ。",
    "copilotDesc": "GitHub Copilot統合。",
    "antigravityDesc": "Antigravityクラウドサービス。",
    "codexDesc": "OpenAI Codex APIアクセス。",
    "claudeDesc": "Anthropic Claudeモデル。",
    "management": "アカウント管理",
    "refreshAccounts": "アカウントを更新する",
    "activeAccounts": "アクティブなアカウント",
    "addNewAccount": "新しいアカウントを追加",
    "accountNamePlaceholder": "アカウント名 (例: 仕事、個人)",
    "unnamed": "名前のないアカウント",
    "create": "作成する",
    "switch": "スイッチ",
    "loadFailed": "アカウントのロードに失敗しました",
    "createSuccess": "アカウント「{{name}}」が作成されました",
    "createFailed": "アカウントの作成に失敗しました",
    "switchSuccess": "「{{name}}」に切り替えました",
    "switchFailed": "アカウントの切り替えに失敗しました",
    "noEmail": "電子メールが提供されていません",
    "services": {
        "github": "GitHub プロフィール",
        "copilot": "GitHub Copilot",
        "antigravity": "Antigravity",
        "codex": "ChatGPT Codex",
        "claude": "Claude"
    }
};

export default sectionData;
