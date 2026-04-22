# Tengra Performance Optimization TODO

## Build-Time Optimizations
- [x] Configure Terser for production minification (2 passes, mangle toplevel)
- [x] Prune console logs and traces in production
- [x] Integrate SVGO-like minification for SVG's (Handled via Vite plugins if already present)

## Startup & Runtime Performance
- [x] Enable V8 Compile Cache for fast startup (Node 22+ switch)
- [x] Integrated lightweight CSS loading splash screen to index.html
- [x] Add app-ready class to dismiss splash after React hydration
- [x] Trigger memory cleanup on window blur for backgrounded instances
- [x] Add hardware acceleration toggle (TENGRA_LOW_RESOURCE_MODE)

## Architectural Offloading
- [x] Introduce `UtilityProcessService` for background worker management
- [x] Register UtilityProcessService in DI container and global services map
- [x] Migrate `AuditLogService` to UtilityProcess worker
- [x] Migrate `TelemetryService` to UtilityProcess worker
- [x] Prototype binary IPC transport for chat message payloads

## Workspace Explorer Modernization
- [x] Replace recursive workspace tree rendering with a flat visible-row explorer core
- [x] Move explorer selection/focus state into a dedicated external store
- [x] Add inline rename/create flows directly inside explorer rows
- [x] Add explorer search/filter with reveal-active-file support
- [x] Stop explorer render-loop/stale reveal reloads that caused scroll jumps and delayed file initialization
- [x] Decouple initial explorer row rendering from git decoration fetches

## Workspace Follow-up
- [x] Remove audit logging from hot-path workspace file reads/listing and stop duplicate watcher reinitialization causing explorer lag
- [x] Investigate missing in-editor code suggestion flow in workspace editors and restore suggestion provider wiring
- [x] Add file watcher patching for workspace trees to avoid full explorer refreshes
- [x] Add explorer diagnostics badges for TypeScript, lint, test, and agent issues
- [x] Add git-aware explorer decorations and actions for staged/unstaged/history workflows
- [x] Build workspace-wide fuzzy file, symbol, and content search with reveal-in-tree
- [x] Add Open Editors, Recent Files, and Pinned Files sections to workspace explorer
- [x] Add persisted per-workspace layout profiles for sidebar, terminal, and panel states
- [x] Add inline bulk actions for multi-rename, multi-delete, move, and copy workflows
- [x] Add smart exclude handling from .gitignore and custom workspace ignore rules
- [x] Add SSH/remote workspace metadata cache with lazy hydration for explorer performance
- [x] Add background indexing for semantic search, dependency graph, and code map generation
- [x] Add workspace health checks for runtimes, env issues, permissions, symlinks, and watch limits
- [x] Add collaboration primitives such as file locks, presence, and workspace change feed
- [x] Restore and extend editor intelligence bridge for suggestions, hover, references, and code actions
- [x] Add workspace session snapshot and restore for tabs, scroll state, and expanded tree state
- [x] Add task/run orchestration for per-workspace commands, dev servers, logs, and grouped processes
- [x] Add workspace security boundary checks for secrets, dangerous commands, writable paths, and remote trust levels
- [x] Reorganize workspace settings and add workspace-scoped Monaco editor controls
- [x] Add app/editor zoom controls via Ctrl/Cmd + plus, minus, and zero while removing appearance font controls 
- [x] Resolved application startup crash by removing duplicate Git IPC handler registrations for `git:getFileHistory` and `git:getLastCommit`
- [x] Enforce single-instance editor tabs, remove recent files explorer section, move terminal appearance controls into Settings > Appearance, add editor auto-save, and relocate workspace danger zone into settings
- [x] Fix workspace diagnostics/LSP integration regressions, stabilize Monaco file-model resolution, and restore the full Vitest suite to green
- [x] Respect `.gitignore` during workspace analysis, remove static/comment-based fake issues, and stop Monaco from surfacing false TS/JSX diagnostics
- [x] Route editor diagnostics through backend LSP sessions with project-root discovery so Monaco markers reflect real workspace TypeScript/JavaScript errors
- [x] Restore Monaco minimap visibility, surface unsaved-change markers in the overview/minimap, and add Ctrl+hover/Ctrl+click import navigation through backend definitions
- [x] Limit workspace storage breakdown to root-relative directories only and merge total-size plus largest-directories into a single dashboard section
- [x] Clarify workspace line-count labeling and extract website backend/frontend repos out of the main workspace after pushing pending frontend changes
- [x] Flatten settings UI chrome, reduce shadcn border/ring intensity, and make core settings tabs responsive across narrow widths
- [x] Make shared/custom modals responsive with fluid heights, lighter chrome, and restore the workspace wizard existing-folder picker so directory selection opens reliably
- [x] Implement UI for workspace agent permission-denied errors with actionable configuration links in the chat interface.
- [x] Fix workspace logo rendering by normalizing `safe-file` image URLs in the renderer and whitelisting workspace roots for protocol-backed logo previews.
- [x] Normalize workspace logo `safe-file` rendering so uploaded/generated logos display immediately on Windows instead of resolving to broken image URLs.
- [x] Standardize React hook imports and usage across components to resolve "Invalid hook call" runtime errors and achieve a clean build.
- [x] Hardened GPU initialization with ANGLE D3D11 for Windows (Resolves EGL context creation errors)
- [x] Fix Marketplace model recommendations to be hardware-aware (Prevents 70B models on low-VRAM hardware)
- [x] Fix Sidebar download progress tracking (Percentage and progress bar visibility)

## Provider Follow-up
- [ ] Research and prototype `groq` provider support, including OAuth flow validation and current API compatibility gaps
- [ ] Research `cursor` provider support, including reverse-engineering the auth flow and identifying implementation constraints
- [ ] Research `kimi` provider support, including reverse-engineering the auth flow and identifying implementation constraints 
- [x] Refined AI Assistant Sidebar UI: reduced composer height (h-11), implemented configurable message footers (timestamp and model only for sidebar), added dynamic context-aware header icons, and suppressed duplicate display of identical model variants.
- [x] Implemented robust XML tool call detection for Copilot/Codex models, enabling tool execution from `<function_calls>` tags and eliminating visual flickering during streaming.
- [x] Prevent duplicate agent tool executions by reusing prior same-signature tool results, tightening Windows path guidance around `%USERPROFILE%`, and removing forced repeat-loop finalization for simple file lookup flows.
- [x] Unify AI system prompt locale handling across renderer and main chat flows so marketplace-installed language packs drive response language, and switch tool-loop recovery to adaptive evidence-aware budgeting instead of stopping early on a brittle fixed limit.
- [x] Introduce a shared AI runtime contract for intent classification, tool-loop budgeting, normalized assistant presentation metadata, and provider-agnostic reasoning display in chat UI.
- [x] Split chat orchestration into dedicated runtime policy, tool execution, batch execution, and turn-management helpers while extending normalized AI presentation metadata to session conversation streams and workspace chat surfaces.
- [x] Decompose `MessageBubble` into shared message presentation modules, centralize permission/recovery cards, and feed main-process prompt injection with runtime locale-pack metadata so all chat surfaces follow the same AI runtime contract.
- [x] Add shared AI evidence extraction plus deterministic lookup answer composition so low-signal tool loops can fall back to structured evidence instead of generic failure text.
- [x] Extend session conversation complete/stream flows with shared assistant runtime metadata so main-process persistence, session registry envelopes, and non-stream complete results all use the same AI presentation contract.
- [x] Extract the renderer tool-turn loop into a dedicated orchestration utility and move session IPC prompt/RAG helpers into standalone main-process runtime modules so chat entrypoints stop accumulating provider/runtime policy logic inline.
- [x] Split session conversation input sanitization, reasoning-option parsing, and renderer-side session stream consumption into dedicated runtime utilities so session chat surfaces follow the same modular orchestration structure as the main chat flow.
- [x] Move session conversation streamed-assistant persistence, token accounting, and stream chunk transport into standalone runtime helpers so the IPC manager primarily orchestrates request flow instead of owning low-level side effects.
- [x] Stabilize AI runtime session state and IPC contracts: resolved SessionJsonValueSchema circularity, aligned assistant envelope creation with strict schemas, and standardized i18n t() signatures for interpolation.
- [x] Resolved renderer tool-turn loop execution type errors and addressed React hook cascading render warnings in useChatManager to achieve a clean, production-ready build.
- [x] Infinite Tool-Loop Resilience: Implemented stubborn agent detection in `evaluateLoopSafety`, expanded `composeDeterministicAnswer` for all intents, and ensured evidence-aware finalization (forced termination) across all orchestration paths.
- [x] Hardened AI tool execution after two-day log review: enabled local project/file requests to use tools outside Agent mode, allowed bounded multiline PowerShell commands, added structured tool result evidence, improved deterministic fallback answers, and normalized repeated command signatures to avoid blind retry loops.
- [x] Added core file/project tools (`resolve_path`, `write_files`, `patch_file`, `search_files`, `read_many_files`) and moved optional MCP categories toward external plugin installation while keeping Ollama and image generation internal.
- [x] Made optional MCP categories installable as runnable marketplace plugins with downloaded Node entrypoints, manifest-driven tool exposure, safe disabled-by-default registration, and registry entries for weather, web, network, Docker, Git, memory, screenshot, and SSH.
- [x] Added persistent agent terminal tools (`terminal_session_start`, `terminal_session_write`, `terminal_session_read`, `terminal_session_wait`, `terminal_session_signal`, `terminal_session_stop`, `terminal_session_list`, `terminal_session_snapshot`) on top of the existing TerminalService so multi-step shell work can preserve cwd/env/output state.
- [x] Optimized core tool execution by parallelizing bounded multi-file reads/writes, capping tool result cache growth, short-caching tool definitions, applying workspace path normalization to batch file arguments, and making file search stop as soon as the requested result limit is reached.
- [x] Hardened tengra-proxy lifecycle and OAuth refresh readiness by preserving background proxy processes across app shutdown, reusing existing healthy proxy daemons on startup, running token refresh immediately on proxy boot, retrying Antigravity chat requests after 401-triggered refresh, and redacting sensitive HTTP headers from debug logs.
- [x] Hardened chat reasoning/tool-loop rendering by segmenting streamed reasoning into persistent accordion blocks, rejecting empty `create_directory` path calls before filesystem access, treating failed tool calls as no-progress for loop safety, clamping oversized streamed/session content before IPC schema validation, and removing hot-path stream parser debug spam.
- [x] Fixed repeated planning-sentence loops by suppressing duplicate OpenCode `response.output_text.done` emissions without item IDs and expanding low-signal progress detection for "Desktop by default" fallback phrasing.
- [x] Reduced slow tool-loop recoveries by treating long low-signal planning text as non-progress, preventing accumulation of placeholder text across turns, and force-finalizing when deterministic evidence already exists.
- [x] Fixed reasoning accordion empty-state regressions by dropping whitespace-only reasoning from stream extraction/history and suppressing blank thought sections in message rendering.
- [x] Expanded chat debug instrumentation across stream parsing, tool-loop iterations, message-to-thought mapping, and thought section rendering to trace why accordion segments disappear or stall at "Thinking".
- [x] Fixed missing tool accordion while "Thinking" by preserving typeless `tool_calls` chunks in renderer stream normalization/parser and expanded per-tool execution timing logs across renderer + main IPC.
- [x] Refined thought accordion UX by removing duplicate thought text from main reply body, showing thought duration in accordion header, and enabling scrollable long-thought content (`overflow-y-auto`).
- [x] Fixed Antigravity reasoning stream duplication by separating provider cumulative buffers from the visible thought segment, swallowing replayed history after segment boundaries, and making streamed thought accordion updates idempotent when the latest segment grows.
- [x] Fixed session-stream accordion regressions by persisting streamed reasoning/tool-call chunks on the same assistant message and collapsing consecutive reasoning-only assistant entries into a single message bubble.
- [x] Normalized Windows absolute tool paths under mismatched `C:\Users\...` profiles to the active user home before directory creation to reduce false path-policy failures.
- [x] Restored session conversation tool-call continuation so provider turns that end with `tool_calls` now execute tools, append results to the same assistant message, and continue the bounded stream loop instead of stopping silently.
- [x] Added Antigravity AI Credits groundwork with multi-account-aware quota parsing, credit fallback visibility in model/settings surfaces, workspace routing support, simplified end-user tool call summaries, and restored live reasoning updates for collapsed assistant bubbles during streaming.
- [x] Compacted duplicate Antigravity tool-call cards in chat bubbles and live tool-loop updates so repeated `resolve_path` runs no longer flood the UI while reasoning-free tool turns are in progress.
- [x] Expanded chat renderer diagnostics so logs now show streaming-state apply, throttled chat-state writes, and collapsed display-entry counts for Antigravity tool-stream freeze investigations.
- [x] Removed the renderer-side streamed response safety clamp that surfaced `response exceeded Tengra safety limit`, and upgraded renderer log forwarding to preserve structured `renderer:<context>` entries in persisted session logs for proxy-vs-UI debugging.
- [x] Fixed Antigravity thought-request loss in `tengra-proxy` by preserving Gemini `thinking_level` / `thinking_budget` fields through proxy normalization, mapping planner-response `modifiedResponse` back to assistant content, and aligning stream/non-stream Antigravity thought extraction with the provider step contract.
- [x] Reduced Antigravity stream freeze symptoms by switching chat follow-output to non-animated scrolling, fast-pathing plain-text stream parsing, falling back to lightweight plain-text rendering for oversized live assistant replies, and routing `gemini-3-flash-agent` through the thought-capable Gemini 3 Flash compatibility path with restored thinking levels.

## AI Runtime Refactor Handoff Plan

Bu bölüm özellikle başka bir yapay zeka ajanının devralması için yazıldı. Amaç sadece "ne kaldı" demek değil, sıradaki işi güvenli ve mimari olarak doğru sırayla tarif etmek.

### Mevcut Durum Özeti

- [x] Ortak AI runtime intent sınıflandırması eklendi.
- [x] Ortak prompt/locale contract büyük ölçüde birleştirildi.
- [x] Renderer chat orchestration büyük ölçüde parçalara ayrıldı.
- [x] Session/workspace yüzeyleri ortak presentation metadata akışına bağlandı.
- [x] Main-process session conversation prompt, RAG, validation, persistence ve stream chunk transport yardımcıları ayrı modüllere taşındı.
- [x] Tool repeat koruması ve low-signal recovery mantığı ortak runtime politikasına bağlandı.

### Bu Bölümdeki En Önemli Kural

- [ ] Yeni işi devralan ajan `prompt` ile orkestrasyon düzeltmeye çalışmamalı.
- [ ] Yeni ajan renderer ve main tarafında yeni kopya orchestration mantığı oluşturmamalı.
- [ ] Yeni ajan `useChatGenerator.ts` veya `session-conversation.ts` içine tekrar büyük gövdeli inline yardımcılar taşımamalı.
- [ ] Yeni ajan mümkün olduğunca mevcut runtime util katmanlarını genişletmeli.

### Hâlâ Eksik Olan Ana Mimari Katman

- [ ] Gerçek shared `evidence store` hâlâ yok.
Detay:
Şu an evidence toplama ve presentation metadata var, fakat tool sonuçları uzun ömürlü, sorgulanabilir, intent-aware bir store içinde normalize edilip tutulmuyor. Bu eksik kalırsa sistem daha temiz olur ama tamamen dayanıklı hale gelmez.

- [ ] Deterministic answer composer hâlâ sınırlı.
Detay:
Şu an bazı `single_lookup` akışlarında deterministic answer üretilebiliyor ama bu dar kapsamlı. Hedef, modelin low-signal kaldığı veya gereksiz tekrar ettiği basit lookup akışlarını tamamen runtime tarafında güvenli şekilde sonlandırmak.

- [ ] Main-process orchestration ile renderer orchestration tam parity seviyesinde değil.
Detay:
Modüller ayrıldı, ancak decision making hâlâ kısmen farklı yüzeylerde gerçekleşiyor.

### 0. Önce Handoff Kalitesini Sertleştir

- [ ] Her büyük refactor başlığı için açık `bitti sayılması için` kabul kriterisi ekle.
Detay:
Bu TODO başka bir yapay zekaya verileceği için her ana başlık altında "bu iş tamamlandı sayılması için hangi gözle görülür sonuçlar olmalı" bölümü bulunmalı.
Örnek:
`evidence store tamamlandı` demek için renderer ve main tarafında normalize evidence snapshot üretilebilmeli, duplicate tool sonucu bu store üzerinden reuse edilebilmeli, deterministic composer bu store’dan okuyabilmeli.

- [ ] Her büyük başlık için `dokunulacak ana dosyalar` listesini ekle.
Detay:
Başka ajan hangi dosyalardan başlaması gerektiğini hızlı görmeli.
Her başlık altında 3-8 dosyalık hedef liste ver.

- [ ] Her büyük başlık için `dokunulmaması gereken / tekrar monolit hale getirilmemesi gereken alanlar` notu ekle.
Detay:
Örnek:
`useChatGenerator.ts` içine yeni büyük yardımcı bloklar geri taşınmamalı.
`session-conversation.ts` içine prompt/RAG/persistence helper’ları geri gömülmemeli.

- [ ] `önerilen uygulama sırası` başlığını ayrıca ekle.
Detay:
Başka ajan işi şu sırada yapmalı:
1. shared types
2. shared utils
3. renderer evidence
4. main evidence
5. deterministic composer
6. prompt cleanup
7. presentation parity
8. tests
9. final validation

- [ ] `riskli refactor noktaları` başlığını ayrıca ekle.
Detay:
Özellikle şunlar açık yazılmalı:
session stream chunk formatı,
tool result persistence formatı,
metadata.aiPresentation backward compatibility,
provider-specific streaming farkları,
workspace/session/chat yüzeyleri arasındaki ortak contract.

### 1. Öncelik: Shared Evidence Store Kur

- [ ] `src/shared/types/ai-runtime.ts` içine evidence store için yeni tipler ekle.
Detay:
Şunlar düşünülmeli:
`AiEvidenceRecord`, `AiEvidenceScope`, `AiEvidenceSatisfaction`, `AiEvidenceStoreSnapshot`, `AiEvidenceSourceSurface`.

- [ ] `src/shared/utils/ai-runtime.util.ts` içine evidence store yardımcıları ekle.
Detay:
En az şu yardımcılar olmalı:
`createEvidenceRecord(...)`
`mergeEvidenceRecords(...)`
`dedupeEvidenceRecords(...)`
`doesEvidenceSatisfyIntent(...)`
`summarizeEvidenceStore(...)`

- [ ] Renderer için geçici in-memory evidence state oluştur.
Detay:
Yeni dosya önerisi:
`src/renderer/features/chat/hooks/tool-evidence-store.util.ts` genişletilsin veya
`src/renderer/features/chat/hooks/chat-evidence-store.util.ts` diye yeni dosya açılsın.
Amaç:
tool call map, tool messages, cached signatures yanında artık normalize evidence kayıtları da burada yaşasın.

- [ ] Main-process session conversation için de evidence state üret.
Detay:
Yeni dosya önerisi:
`src/main/ipc/session-conversation-evidence.util.ts`
Bu modül stream ve complete akışlarında üretilen tool/source/content evidence’ı normalize etmeli.

- [ ] Evidence store sadece raw tool result saklamasın.
Detay:
Her kayıt mümkünse şu bilgileri taşımalı:
intent ile ilişkisi, reusable olup olmadığı, hangi tool’dan geldiği, hangi yüzeyde üretildiği, kullanıcıya gösterilebilir kısa özeti, deterministic answer üretmeye katkısı.

- [ ] Bu başlık için `bitti sayılması için` maddeleri ekle.
Detay:
Örnek kabul kriterileri:
renderer tarafında normalized evidence snapshot alınabiliyor olmalı,
main/session tarafında aynı evidence modeli üretilebilmeli,
tool tekrar koruması raw message array yerine evidence store üstünden de çalışabilmeli,
presentation katmanı evidence summary’yi aynı store’dan okuyabilmeli.

### 2. Öncelik: Deterministic Fast-Path Büyüt

- [ ] `single_lookup` intent’i için runtime fast-path matrisi çıkar.
Detay:
Şu tip işler modele bırakılmamalı veya en azından answer fallback’ı deterministic olmalı:
dosya sayısı, klasör sayısı, dosya var mı, yol var mı, basit directory listing summary, sistem kullanıcı adı, platform adı, basit metadata lookup.

- [ ] `composeDeterministicAnswer(...)` fonksiyonunu genişlet.
Detay:
Dosya:
`src/shared/utils/ai-runtime.util.ts`
Burada sadece `list_directory` ve `file_exists` değil, desteklenen lookup tool’ları için daha net cevap üretimi eklenmeli.

- [ ] Tool executor çıktıları deterministic compose için daha uygun hale getirilmeli.
Detay:
Dosyalar:
`src/main/tools/tool-executor.ts`
`src/main/tools/tool-definitions.ts`
Tool sonuçları mümkün olduğunca şu alanları düzenli taşımalı:
`path`, `complete`, `entryCount`, `fileCount`, `directoryCount`, `pathExists`, `displaySummary`, `resultKind`

- [ ] Final fallback akışlarında önce deterministic answer denenmeli.
Detay:
Renderer tarafında:
`src/renderer/features/chat/hooks/tool-turn-management.util.ts`
Main/session tarafında:
`src/main/ipc/session-conversation.ts` veya yeni evidence/composer util’i
Amaç:
"Tool loop limit reached" benzeri generic cevapları mümkün olduğunca kaldırmak.

- [ ] `modele bırakılmayacak kesin lookup işleri` alt listesi ekle.
Detay:
Başka ajan aşağıdaki işleri ayrı ve net bir liste halinde TODO içinde görmeli:
dosya sayısı,
klasör sayısı,
path existence,
directory summary,
basit system info lookup,
basit tek-tool metadata lookup.

- [ ] Bu başlık için `bitti sayılması için` maddeleri ekle.
Detay:
Örnek kabul kriterileri:
aynı basit lookup için model low-signal kalsa bile deterministic answer üretilebilmeli,
generic fallback metni yerine structured answer dönmeli,
aynı davranış chat ve session surface’te korunmalı.

### 3. Öncelik: Main ve Renderer Orchestration Parity

- [ ] Renderer ve main akışlarındaki intent-to-budget eşleşmesini karşılaştır.
Detay:
Bakılacak dosyalar:
`src/shared/utils/ai-runtime.util.ts`
`src/renderer/features/chat/hooks/tool-turn-loop-execution.util.ts`
`src/main/ipc/session-conversation.ts`
Hedef:
aynı intent aynı budget mantığıyla ele alınmalı.

- [ ] Session conversation complete akışında da evidence-aware finalization yap.
Detay:
Şu an metadata düzgün, fakat deterministic final answer ve evidence-satisfaction kararı daha sistematik hale getirilmeli.

- [ ] Workspace surface ile main/session surface arasında tool davranışı farkı kalıp kalmadığını incele.
Detay:
Bakılacak dosyalar:
`src/renderer/features/workspace/hooks/useWorkspaceChatStream.ts`
`src/renderer/hooks/useSessionConversationStream.ts`
`src/renderer/lib/chat-stream.ts`
Amaç:
workspace chat’in "adapter" olma durumu korunmalı, ayrı davranış motoru oluşmamalı.

- [ ] `parity` kelimesini somut davranışlara çevir.
Detay:
TODO içinde açık yaz:
aynı intent -> aynı budget,
aynı evidence summary formatı,
aynı low-signal fallback politikası,
aynı repeated-tool recovery kararı,
aynı aiPresentation alanları.

- [ ] Bu başlık için `bitti sayılması için` maddeleri ekle.
Detay:
Başka ajan parity tamamlandı dediğinde yukarıdaki 5 davranışın gerçekten eşitlendiği net olmalı.

### 4. Öncelik: Prompt Katmanını Daha da Temizle

- [ ] `src/shared/instructions.ts` içindeki kuralları yeniden sınıflandır.
Detay:
Kurallar şu başlıklara net ayrılmalı:
core identity, locale rules, response contract, anti-loop reminders, provider compatibility.

- [ ] Runtime ile çözülen konuları prompt’tan azalt.
Detay:
Özellikle:
aynı tool’u tekrar çağırma,
tool sonucu varken "ihtiyacım var" deme,
low-signal final cevap üretme
gibi durumlar prompt değil runtime policy ile çözülmeli.

- [ ] Marketplace locale pack metadata akışını gözden geçir.
Detay:
Bakılacak dosyalar:
`src/shared/instructions.ts`
`src/renderer/lib/identity.ts`
`src/main/services/system/locale.service.ts`
`src/main/ipc/session-conversation-prompt.util.ts`
Amaç:
bütün yüzeylerde aynı locale metadata map’i kullanılıyor mu, tekrar kontrol et.

- [ ] Prompt bölümüne `runtime ile çözülmesi gerekenler` ve `promptta kalması gerekenler` ayrımı ekle.
Detay:
Başka ajan hangi problemi prompttan çözmeye çalışmaması gerektiğini tek bakışta anlamalı.

- [ ] Bu başlık için `bitti sayılması için` maddeleri ekle.
Detay:
Örnek:
prompt dosyası daha kısa ve sınıflandırılmış olmalı,
runtime ile çözülen anti-loop mantık prompttan çıkarılmış olmalı,
locale metadata akışı tek haritalama mantığına dayanmalı.

### 5. Öncelik: Presentation Contract Sertleştir

- [ ] `AiPresentationMetadata` şemasını daha güçlü hale getir.
Detay:
Dosya:
`src/shared/types/ai-runtime.ts`
Bugün yeterli ama ileride reasoning/evidence/answer-mode ayrımı için birkaç alan daha gerekebilir.
Örnek adaylar:
`surface`, `responseStyle`, `satisfiedByEvidence`, `deterministicAnswerAvailable`

- [ ] UI tarafında ham provider reasoning’in sızmadığını tekrar denetle.
Detay:
Bakılacak dosyalar:
`src/renderer/features/chat/components/MessageBubble.tsx`
`src/renderer/features/chat/components/message/message-presentation.util.ts`
`src/renderer/features/chat/components/message/AiPresentationPanel.tsx`

- [ ] Tüm assistant yüzeylerinde aynı status dili kullanılsın.
Detay:
Örnekler:
"Inceleniyor", "Kanit toplandi", "Yanit hazir" gibi status satırları ortak bir helper’dan üretilmeli.

- [ ] `hangi alanlar zorunlu / hangi alanlar opsiyonel` listesini TODO içine yaz.
Detay:
Özellikle `AiPresentationMetadata` için başka ajan şema genişletirken kararsız kalmamalı.

- [ ] Bu başlık için `bitti sayılması için` maddeleri ekle.
Detay:
Örnek:
aynı assistant cevabı farklı provider’dan gelse bile aynı presentation alanlarıyla render edilmeli,
ham hidden reasoning UI’ye sızmamalı,
status line helper’ı ortak bir noktadan beslenmeli.

### 6. Öncelik: `useChatGenerator` ve `session-conversation` Son Temizlik

- [ ] `useChatGenerator.ts` içinde kalan büyük karar bloklarını yeniden değerlendir.
Detay:
Bu dosya ciddi biçimde küçüldü ama hâlâ koordinasyon, temp message oluşturma, model seçimi, image-direct-flow ve multi-model kararlarını bir arada tutuyor.
Hedef:
dosya "runtime entry hook" olarak kalmalı.

- [ ] `session-conversation.ts` içindeki stream handler gövdelerini daha da küçült.
Detay:
`handleOpencodeStream` ve `handleProxyStream` artık evidence util kullanıyor ama ileride ortak bir stream orchestration katmanına taşınabilir.

- [ ] Session IPC manager içinde sadece şu tip sorumluluklar bırakılmalı:
Detay:
request kabul etme,
session başlatma,
doğru runtime helper’ı çağırma,
başarı/hata/abort session status güncelleme.

- [ ] Bu başlık için `bitti sayılması için` maddeleri ekle.
Detay:
Örnek:
`useChatGenerator.ts` entry hook olarak kalmalı,
`session-conversation.ts` orchestration shell olarak kalmalı,
dosya içi yardımcı sınıf veya büyük inline utility geri gelmemeli.

### 7. Öncelik: Test Handoff Hazırlığı

- [ ] Yeni eklenen util’ler için test kapsamını artır.
Detay:
Özellikle şu dosyalar:
`src/main/ipc/session-conversation-prompt.util.ts`
`src/main/ipc/session-conversation-rag.util.ts`
`src/main/ipc/session-conversation-persistence.util.ts`
`src/main/ipc/session-conversation-stream-ipc.util.ts`
`src/renderer/features/chat/hooks/tool-turn-loop-execution.util.ts`
`src/renderer/hooks/session-conversation-stream-consumer.util.ts`

- [ ] Testlerde kullanıcı adı, masaüstü yolu veya makineye özgü sabit değer kullanma.
Detay:
`agnes`, gerçek user profile path, lokal masaüstü sabitleri kullanılmamalı.
Her test normalize edilmiş örnek data ile çalışmalı.

- [ ] Önce davranış testi yaz, sonra gerekirse implementation düzelt.
Detay:
Özellikle target senaryolar:
aynı tool tekrar çağrıldığında eski sonuç reuse edilmeli,
low-signal final içerik varsa evidence tabanlı answer üretilmeli,
session stream metadata ve chat metadata aynı contract’a oturmalı.

- [ ] `validation komutlarını hangi sırayla çalıştıracağı` alt listesi ekle.
Detay:
Başka ajan mimari iş bittikten sonra şu sırayı izlemeli:
önce hedefli testler,
sonra type-check,
sonra build,
sonra lint,
en son tam test.

- [ ] Repo sürecine özel final adımları da ekle.
Detay:
Örnek:
gerekirse changelog/TODO/docs senkronizasyonu,
repo kurallarında istenen final bakım adımları,
ama bunlar validation tamamlandıktan sonra yazılsın.

### 8. En Son Yapılacaklar

- [ ] Bütün runtime modülleri tamamlandıktan sonra `docs/ai-runtime-architecture.md` yeniden gözden geçir.
Detay:
Belge kodu tarif etmeli, geride kalmamalı.

- [ ] Bu refactor bitmeden yeni provider-specific hack ekleme.
Detay:
Özellikle tool loop veya response style için provider bazlı yeni istisna eklenirse bu mimari tekrar dağılır.

- [ ] Refactor tamamlanınca ancak o zaman validation komutlarına geç.
Detay:
Bu aşamada build/lint/type-check/test henüz özellikle çalıştırılmadı. Sonraki ajan önce mimari işi bitirsin, sonra doğrulama turuna geçsin.


## Tengra Proxy Future TODO (Service Roadmap)
- [x] Add Tengra Proxy routing/middleware engine using standard axum/hyper routers
- [x] Implement proxy request interception and SSE streaming for `claude.ai` and `chatgpt.com` APIs
- [x] Implement quota exhaustion check before rewriting proxy requests (`429 Too Many Requests`)
- [x] Implement GitHub Copilot OAuth support (Device Flow + Session Token swap) in Rust proxy.
- [x] Stop launching native token/quota/model helper services and route token sync, quota, and model catalog reads through `tengra-proxy`
- [x] Consolidate native token/quota/model responsibilities into `tengra-proxy`, preserve linked-account metadata, and remove legacy helper binaries from native build output
- [x] Align `linked_accounts` proxy upserts with the real DB primary key and namespace provider default account IDs to avoid `ON CONFLICT` sync failures
- [x] Restore local Ollama model visibility in the unified model registry even when no remote account is linked
- [x] Restore browser auth reliability by moving Codex off the missing proxy URL endpoint and preventing stale provider auth locks in the settings UI
- [x] Harden linked-account timestamp handling so legacy text timestamps do not break encryption upgrades or token refresh sync jobs
- [x] Bring Copilot token lifecycle parity into `tengra-proxy`, including session persistence, plan metadata, v1 fallback, and invalid-token invalidation
- [x] Route Copilot chat and stream IPC traffic through the generic `tengra-proxy` LLM path so native proxy rate limits and token refresh logic are always applied
- [x] Remove the legacy main-process `CopilotRateLimitManager` and direct Copilot request stack once all Copilot chat/rate-limit enforcement lives in `tengra-proxy`
- [x] Remove remaining main-process Antigravity quota-triggered token refresh loop so quota/token authority stays with `tengra-proxy`
- [x] Remove the final JS-side token refresh/retry paths so 401 handling no longer performs proactive refresh outside `tengra-proxy`
- [x] Secure `db-service` localhost API routes with local bearer-token authentication shared through `TENGRA_DB_SERVICE_TOKEN` / `%APPDATA%/Tengra/services/db-service.token`; keep `/health` public for readiness probes.
- [x] Restrict `db-service` raw SQL `/api/v1/query` with a statement policy that blocks multi-statement SQL, `ATTACH`/`DETACH`, dangerous `PRAGMA`, and schema mutation unless an explicit internal migration marker is present.
- [ ] Convert `db-service` handlers from always-200 `{ success: false }` responses to typed HTTP statuses for validation, not-found, auth, and database failures.
- [ ] Move blocking SQLite work in `db-service` behind `spawn_blocking`, a write queue, or a read/write connection pool so long queries do not block the async runtime.
- [ ] Add sqlite vector-search acceleration or an indexed approximate-search strategy for semantic/code searches; cap embedding dimensions and request limits before scanning.
- [ ] Add request body limits, response/output caps, and per-route timeouts to both native services, especially file download/unzip, raw query, chat proxying, and tool dispatch routes.
- [ ] Add `db-service` migration hardening: per-migration transaction wrapper, checksum/version validation, startup integrity checks, and fixture tests for legacy schema repair.
- [ ] Split oversized native service modules (`db-service/src/database.rs`, `tengra-proxy/src/db/mod.rs`, `tengra-proxy/src/proxy/model_service.rs`) into focused repository/provider/migration modules.
- [ ] Add Rust tests for `db-service` CRUD, migration, raw query auth, query policy, vector search, and error-status behavior; current db-service test suite has no functional tests.
- [x] Research how the existing Electron workspace-agent/MCP permission systems should map onto native `tengra-proxy` `/v0/tools/dispatch` before adding or changing per-tool enforcement there. Current finding: native proxy tools are registered as internal MCP plugins in Electron; Rust proxy has API-key auth middleware only, while MCP action permission state lives in `mcpActionPermissions` / `mcpPermissionRequests`.
- [x] Route native proxy tool calls through the existing main-process MCP action permission engine before `NativeMcpPlugin` forwards them to `tengra-proxy` `/v0/tools/dispatch`.
- [x] Add settings UI controls for per-action permissions on internal/native MCP tools instead of showing them as immutable full-access entries.
- [x] Replace production `unwrap()` calls in native proxy filesystem extraction/unzip handlers with structured `ToolDispatchResponse` errors.
- [x] Replace production `unwrap()`/`expect()` calls in native proxy git tool handlers with structured `ToolDispatchResponse` errors.
- [ ] Add workspace-root/path policy enforcement for native filesystem and terminal handlers now that action-level permission ownership is in the main-process MCP dispatcher.
- [x] Migrate `token_data` storage in DB from plaintext to AES/Keychain encrypted blobs
- [x] Optimize sequential `reqwest` DB calls in the proxy auth handlers (lazy caching)
- [x] Add OpenAI bridge readiness endpoint (`/api/auth/oauth/bridge/readiness`) reporting bind status and target route health.
- [x] Add startup integration test that asserts failure when fixed bridge port `1455` is occupied.
- [ ] Add callback bridge telemetry (redirect count, error count, p50/p95 latency) and expose via `/health` diagnostics payload.
- [ ] Add authenticated provider info enrichment for OpenAI/Anthropic accounts (avatar/organization metadata where available).
- [x] Add provider-level OAuth timeout configuration (currently static) with strict bounds validation.
- [x] Add resilient DB retry policy for callback completion write path with explicit failure reporting.
- [x] Add one-click auth verification endpoint that runs provider readiness + callback route sanity checks.
- [ ] Add per-provider benchmark harness in CI for auth start/callback local latency baselines. 
- [ ] Add migration helper to normalize existing OpenAI linked-account metadata generated before bridge rollout.
- [x] Add cliproxy-style compatibility aliases and native handlers for `/responses`, Claude `/messages`, and `/messages/count_tokens` in `tengra-proxy`
- [x] Add management compatibility wrappers for auth URL generation and linked-account auth status in `tengra-proxy`
- [x] Move OAuth callback/session ownership into `tengra-proxy` so auth URL generation, callback completion, and auth-status polling stay in native proxy state
- [x] Stop browser-account linking from using the legacy `LocalAuthServer` callback listeners so retrying OAuth does not leave the UI stuck in connecting or fixed callback ports occupied
- [x] Make browser OAuth completion resilient to stale proxy session state by falling back to linked-account DB detection in both native auth-status and main/renderer polling
- [x] Stop repeated `proxy_key_default` encryption-upgrade churn from blocking auth/settings loads and surface real loading state in Settings > Accounts instead of a false "no results" empty state
- [x] Refresh public linked-account reads from DB after proxy-side OAuth writes so newly linked browser accounts appear immediately in the UI instead of staying hidden behind stale AuthService cache
- [x] Restore native proxy-to-main auth synchronization so browser OAuth writes emit structured auth updates, refresh renderer account state immediately, and keep linked-account timestamps numeric
- [x] Normalize native proxy auth-update payloads and emit completion signals on OAuth DB writes so Codex/Claude browser-linked accounts surface in UI immediately after callback completion
- [x] Unblock browser OAuth UI completion by dropping `authBusy` before renderer refresh work and grouping aliased providers (`openai/codex`, `anthropic/claude`, `google/antigravity`) under the correct account cards
- [x] Convert proxy `/responses` streaming into OpenAI-style `response.*` SSE events and improve Claude/Gemini response fidelity
- [x] Remove obsolete native `token-service`, `quota-service`, and `model-service` source crates from `src/native`
- [x] Replace browser OAuth `default` slots with proxy-owned request/account IDs, scope auth-status polling to `{provider,state,accountId}`, and keep Settings > Accounts buttons provider-local instead of globally disabled
- [x] Remove remaining `cliproxyapi`/`cliproxy-runtime`/`cliproxy-embed` build and test ties outside `vendor/`, including the legacy Go runtime sources and managed-runtime fixtures
- [x] Reconcile browser OAuth completion against request/account ID drift, trust exact request-scoped `ok` auth-status responses, and purge stale `cliproxy` runtime binaries/manifests on startup/build
- [x] Centralize AppData logs under `AppData/Roaming/Tengra/logs` and add startup cleanup for Electron cache folders, stale terminal logs, and legacy token artifacts
- [x] Stabilize browser OAuth completion in Settings by tracking the live pending auth request outside render state so auth events cannot leave providers stuck in `Connecting`
- [x] Emit renderer auth updates directly from proxy-side auth sync and accept recently created provider accounts as browser-auth completion signals when request/account IDs drift
- [x] Bound browser OAuth startup with explicit renderer/proxy timeouts and log `proxy:*` auth IPC entrypoints so stalled `Connecting...` states fail fast instead of hanging silently
- [x] Restore legacy native model-service fetch semantics inside `tengra-proxy` so Copilot/Antigravity/NVIDIA model lists are served from provider fetches instead of the old static proxy catalog alone
- [x] Expand NVIDIA proxy model serving beyond the narrow live `/v1/models` response by merging it with the official NVIDIA NIM language-model catalog in `tengra-proxy`
- [x] Parse `db-service` query responses from `data.rows` in `tengra-proxy` so linked-account-aware remote model fetching works instead of silently falling back to the static proxy catalog
- [x] Refresh the model registry again after `tengra-proxy` becomes ready and retry renderer model loading when expected remote providers are still missing from the first startup snapshot
- [x] Serve NVIDIA models from the live NVIDIA `/v1/models` API only and recover app startup caches when the first snapshot incorrectly collapses to a single NVIDIA model
- [x] Unwrap malformed `{ success, data }` persisted settings envelopes so provider API keys load into startup sync and `tengra-proxy` no longer falls back to the static 17-model catalog
- [x] Serve NVIDIA model discovery in `tengra-proxy` directly from the live public `/v1/models` API without docs scraping or token-gated fallback
- [x] Flatten Antigravity OAuth token persistence in `tengra-proxy`, support legacy nested token payloads, and refresh on 401 before falling back to the static Gemini catalog
- [x] Hydrate Copilot session tokens on demand inside `tengra-proxy` model discovery and stop serving the static 3-model Copilot fallback
- [x] Add the missing current Claude Code models (`claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) to the proxy-served Claude catalog and metadata registry
- [x] Stop `RuntimeBootstrapService` from deleting locked Chromium `Shared Dictionary`/`DIPS*` artifacts on startup and make initial remote model cache hydration non-blocking while avoiding duplicate proxy model fetches
- [x] Skip redundant Rust native rebuilds in `scripts/compile-native.js` when `src/native` inputs have not changed, while still syncing the managed runtime binaries
- [x] Switch renderer production minification to esbuild, make bundle visualizer/compressed-size reporting opt-in, and remove the static Ollama startup import from `RuntimeBootstrapService`
- [x] Defer `modelRegistryService` initialization until after the window is shown so remote model hydration stops competing with first-window startup
- [x] Defer `localImageService` initialization to post-window startup and make its initialize path idempotent so deferred startup no longer double-initializes image state
- [x] Limit proxy background token refresh to genuinely refreshable providers/credentials and invalidate stale Copilot GitHub tokens on 401/404 instead of retry-looping forever
- [x] Preserve Copilot device-flow session token, expiry, and plan metadata from `tengra-proxy` poll responses through main-process account linking so fresh Copilot auth no longer lands in DB as access-token-only
- [x] Stop freshly linked Copilot sessions from being invalidated immediately by using a tighter Copilot refresh threshold and refusing to clear still-valid Copilot session tokens on refresh exchange failures
- [x] Decrypt stored OAuth refresh/access/session tokens inside `tengra-proxy` before background refresh so Codex/Claude/Antigravity/Copilot refresh requests stop sending encrypted `Tengra:v1:` blobs upstream
- [x] Provide `tengra-proxy` the live decrypted master key from Electron startup so native token/model paths no longer depend on incompatible `safeStorage` key decryption
- [x] Source model-registry proxy discovery from the raw `tengra-proxy` `/v1/models` catalog so Copilot live models are preserved, and demote step-by-step auth/model refresh chatter to debug logs
- [x] Wrap Antigravity chat requests for `cloudcode-pa` with `{ model, project, request }` and unwrap wrapped non-stream/stream Gemini responses so Gemini models stop failing with `Unknown name "contents"` payload errors
- [x] Resolve real Antigravity `project_id` from `loadCodeAssist` instead of persisting/sending `auto`, and map Codex system prompts into the required `/responses` `instructions` field
- [x] Align Antigravity model aliasing, request shaping, and base-url fallback order with `vendor/cliproxyapi` so fetched model IDs and chat upstream IDs stay in exact parity
- [x] Reassemble streamed `/responses` function-call deltas into stable tool calls so Codex/Copilot tool execution preserves real `call_id` and function names
- [x] Make Copilot proxy model discovery retry expired session tokens and fall back across linked accounts so startup refresh races do not hide the Copilot category

- [x] Resolved Antigravity Gemini authentication issues by correcting provider settings key and hiding problematic/unsupported model versions (Gemini 2.5/3.1).

- [x] Refined internationalization (i18n) system: Removed all unsupported language files and directories (ar, de, es, fr, ja, zh), updated types and schemas to strictly support English and Turkish, and added missing translations for agent characteristics and workspace states.

- [x] Removed browser extension install modal and associated translations (Turkish and English) to simplify the core application interface and reduce unnecessary dependencies.

- [x] Streamlined MCP architecture by removing 19 redundant server modules, merging monitoring into the system core, and modernizing the Marketplace UI with accessible font scaling, enhanced status indicators, and full i18n support for all module descriptions.
- [x] Reworked i18n around runtime locale packs by making English the single built-in JSON locale pack, removing per-key fallback behavior, deleting legacy `en`/`tr` source trees, and aligning translation export/runtime loading with marketplace-installed languages.
- [x] Fixed runtime theme restoration for marketplace-installed themes by loading the theme registry eagerly at startup and reapplying theme variables when the runtime registry updates; also hardened utility workers to handle Electron message channels reliably without timing out into local fallbacks.

---
- [x] Removed the automated onboarding system and "Start Tour" functionality from the application core and settings, while preserving translation keys for weekend-only updates.

- [x] Removed unused optional environment variables (Sentry, OAuth redirects, and secrets) from .env.example to eliminate redundant EnvValidator warnings.

- [x] Fixed an infinite update loop in the `useVoice` hook that caused "Maximum update depth exceeded" errors in General Settings by splitting voice synthesis and recognition initialization and stabilizing callback dependencies.
- [x] Resolved build-time TypeScript errors in `session-conversation.ts` and `protocols.ts` related to protocol registration and chatId metadata access.

## UI Modernization & Design System
- [x] Initialize Shadcn/ui with standard configuration and @/renderer aliases
- [x] Create core Shadcn/ui components (Input, Checkbox, Label, Textarea) with HSL theme support
- [x] Migrate Workspace Settings fields to Shadcn/ui (General, Editor, Advanced, Dev Server)
- [ ] Continue migrating inputs and checkboxes across other features (SSH, SFTP, Chat, Terminal)
- [x] Consolidate renderer styles into a single `src/renderer/index.css`, remove per-component CSS imports, and standardize shared `:root` design tokens

## Remote Interaction (Günün Hedefi: Discord & Telegram)
- [x] Define `RemoteAccountsSettings` schema and update `AppSettings` interface
- [x] Create `SocialMediaService` in Main process with platform-agnostic provider architecture
- [x] Implement Discord bot provider (Token based) with message routing
- [x] Implement Telegram bot provider (BotFather token based) with message routing
- [x] Develop Whitelist security layer (User ID verification)
- [x] Create IPC handlers for remote account management (handled via generic settings update)
- [x] Build "Social Media" Tab in Settings using Shadcn/ui (Card-based UI)
- [ ] Implement proactive notifications (finished task alerts via bot)
- [ ] WhatsApp Integration (QR or API - Next Priority)

## AI Chat Interface & Reasoning Update
- [x] Modernize AI chat interface with per-message collapsible reasoning blocks.
- [x] Support multiple reasoning segments per message by transitioning to an array-based reasoning structure.
- [x] Decouple tool execution displays, rendering each tool individually for improved transparency and consistent styling.
- [x] Clean up AI runtime orchestration by removing hardcoded `isTurkish` checks and transitioning to a locale-agnostic i18n system.
- [x] Standardize tool result summarization using i18n keys and unified presentation metadata.
- [x] Transition to reasoning-first feedback by removing redundant tool result summaries and evidence-based text generation.
- [x] Update chat streaming and persistence layers to handle accumulated reasoning segments.
- [x] Clean up AI runtime orchestration and resolved type-check/lint regressions after refactor.

- [x] Eliminate AI message duplication during session re-hydration by implementing database-level `UPSERT` and enforcing consistent `assistantId` propagation from renderer to main process across all chat flows (Standard, Multi-Model, and Tool-Loop).
- [x] Optimized code rendering by migrating `CodeBlock` to `MonacoBlock` in the chat interface, resolving and standardizing TypeScript interfaces for better components and props.
- [x] Resolved word and sentence merging in AI messages by disabling default whitespace trimming in the sanitization layer, preserving intentional spaces in multi-part content while maintaining strict trimming for system identifiers (chatId, model, provider).
- [x] Optimized Ollama model context window by implementing dynamic `numCtx` resolution (supporting Model Registry defaults and per-model overrides in Settings), while stabilizing real-time reasoning extraction from `<think>` tags during streaming and ensuring unclosed tags are correctly stripped from the display content.
- [x] Added Antigravity account-level AI Credits controls in Settings by surfacing per-account credit balances in connected accounts, persisting `auto` / `ask-every-time` credit usage preferences per linked account, and aligning settings validation with the new multi-account credit mode map.
- [x] Documented Antigravity reverse-engineering findings, sourced AI Credits from `loadCodeAssist`, and scrubbed plaintext token fields from linked-account metadata on write/startup cleanup.
- [x] Wired Antigravity account-scoped AI Credits confirmation into chat generation and tool-loop follow-up turns, and fixed native proxy account selection to prefer requested/active accounts deterministically for multi-account setups.

- [x] Enhanced Marketplace model metadata extraction (pull counts, READMEs, submodels), integrated 9,000+ models into the unified `registry.json`, and implemented advanced filtering/sorting by author, category, and popularity.
- [x] Decoupled Marketplace model tabs (Ollama, Hugging Face, Community), implemented full localization for tab labels and popularity metrics, and unified the type system to achieve a stable, production-ready build.

- [x] Modernized the Marketplace model management: implemented pagination for Ollama model versions (10 per page), refined installation logic to prioritize direct background downloads by bypassing redundant metadata file creation, and updated "installed" status tracking to be inclusive of sub-models and accurate for Hugging Face repositories.
- [x] Enhanced model detail presentation in the Marketplace: integrated the information panel into a responsive side-panel, added secure HTML/Markdown rendering for READMEs (XSS protected), and synchronized the "Installed" filter with the live runtime state for real-time accuracy.

- [x] Marketplace Hardening: Implemented hardware-aware model recommendations (VRAM-optimized heuristics), fixed sidebar download progress tracking (state sync from history + percentage visibility), and enabled automatic local model list refresh upon successful marketplace installations.
- [x] Hardened GPU initialization for Windows with --disable-gpu-sandbox and --disable-gpu-driver-bug-workarounds to resolve persistent EGL context errors.
- [x] Corrected VRAM unit mismatches (MB vs Bytes) and parameter count normalization, fixing unrealistic (7000+) vs degraded (6) TPS estimates.
- [x] Marketplace Metadata Stabilization: Resolved Hugging Face model size discrepancies (fixed "0 KB" issue), implemented robust name-based parameter extraction (regex-hardened), added explicit storage/RAM requirements to model cards, and restored the `convertModelToGGUF` service method to satisfy IPC contracts.

## Job Finder Plugin Integration
- [x] Create dedicated repository for `job-finder-plugin`
- [x] Implement manifest-driven UI expansion in Tengra core
- [x] Build `ExtensionViewHost` for dynamic non-core view rendering
- [x] Integrate `ExtensionViewHost` into `ViewManager` routing
- [x] Create Job Finder UI component in plugin folder (High-quality React)
- [x] Implement Extension Development Bridge for renderer-side component registration (via `safe-file://` dynamic bundle loading)
- [x] Register Job Finder commands in plugin Main process (`job-finder.search`, `job-finder.analyze-cv`)
- [x] Decentralize UI registration: No hardcoded imports in Tengra core; extensions register via `window.Tengra.registerExtensionComponent`
- [x] Implement Git-based extension installation in `MarketplaceService` (cloning from repository URL)
- [ ] Implement browser scraping engine for job sites (LinkedIn, Indeed, etc.)
- [ ] Implement AI-driven CV analysis and ATS scoring logic
- [ ] Implement ZIP extraction for extension installation (fallback)
- [x] Finalize end-to-end marketplace activation flow (Install -> Extract -> Activate -> Render), including post-install auto-activation, renderer live refresh via `extension:state-changed`, and settings-side MCP + Extension unified management.

- [x] Fixed extension configuration IPC crash (`window.electron.invoke` missing) and refactored `ExtensionPluginsTab` to use the typed domain bridge for improved safety.

- [x] Implemented and stabilized automated extension update notification system: added `marketplace:get-update-count` IPC bridge, integrated startup update checks into `useAppInitialization`, implemented a visual update badge in `AppHeader`, and added auto-navigation to the extensions tab on startup. Hardened store selectors and effects to prevent infinite render loops.
- [x] Harden extension marketplace updates by deactivating active extensions before disk replacement and reloading extension UI bundles with versioned cache keys.
- [x] Make extension UI bundle cache-busting depend on the actual UI file stamp (mtime + size) so marketplace updates with unchanged package versions still refresh the renderer.
- [x] Finalized the extension management interface: added dynamic README fetching from GitHub for marketplace items, implemented a Shadcn-based VS Code-inspired two-pane manager in Settings, and stabilized the extension uninstallation flow with state synchronization.

- [x] Redesigned marketplace expansion cards (extensions/MCP) with a premium VS Code-inspired UI, fixed double-versioning display conflicts, and resolved "Installed" status desync for uninstalled extensions.

- [x] Internationalized the `job-finder-plugin` by implementing a standalone i18n utility with support for English and Turkish locales, refactored `JobFinderView.tsx` to handle dynamic translations and parameter interpolation. 
- [x] Performed a safe, systematic cleanup of `en.locale.json` by removing 666 reliably identified orphaned keys while preserving dynamic marketplace and model-registry strings.
- [x] Validated that critical marketplace alerts (e.g., `uninstallSuccess`) remain intact to prevent N/A notification issues in the UI.



## Managed Runtime & Documentation Stabilization
- [x] Decommissioned legacy resources/bin directory and centralized all native binaries in the managed runtime (%APPDATA%/Tengra/runtime/bin).
- [x] Consolidated project documentation: gathered scattered Markdown files into a central docs/ directory.
- [x] Hardened documentation links: updated relative paths in all core rule files (MASTER_COMMANDMENTS.md, AI_RULES.md, AGENTS.md, etc.) to reflect the unified docs/ structure.
- [x] Updated scripts/build-env-setup.js to align with the single-runtime-root architecture.

## Open Source Release (15-Day) Remaining
- [x] Migrate remaining `tengra-*` CSS class usage to Tailwind utilities in renderer components.
- [x] Remove unused CSS files/imports after each migration batch and keep `index.css` minimal.
- [x] Normalize remaining CSS filenames to kebab-case and remove legacy naming.
- [x] Audit and remove dead i18n keys related to removed Command Palette UI.
- [x] Replace or clean up any stale "command palette" user-facing copy in workspace/help overlays.
- [x] Run full regression pass on layout surfaces (sidebar, header, panel, status/title bars, workspace shell).
- [x] Execute full lint/type-check/test pipeline and resolve all remaining warnings before open-source release.
- [ ] Prepare a final OSS readiness checklist (build reproducibility, docs, contribution flow, license headers).

## Long-Term MCP Marketplace & Sidecar Evolution (Roadmap)
- [ ] **Native MCP Orchestrator**: Migrate `ExternalMcpPlugin` lifecycle management from Node.js `child_process` to `tengra-proxy` (Rust).
- [ ] **WASM Plugin Runtime**: Integrate a WASM/WASI runtime (e.g., Wasmtime) into the sidecar for secure, sandboxed marketplace plugins.
- [ ] **Capability-Based Security**: Implement a request/grant system in the sidecar where plugins must request specific resource handles (VFS, Network).
- [ ] **Unified Tool Hub**: Use `tengra-proxy` as the single gateway for all tool calls (internal, external, WASM), eliminating Node.js IPC hops for 3rd-party tools.
- [ ] **Tengra Native SDK**: Develop a Rust crate for plugin authors to build safe, high-performance MCP servers.
- [ ] **Process Isolation 2.0**: Use Rust's `sysinfo` to precisely monitor and throttle CPU/Memory of legacy (executable) MCP plugins.
- [ ] **TPP (Tengra Plugin Protocol)**: Extend standard MCP with high-speed shared memory IPC for deep integration between plugins and Tengra core (AST, Code Graph).
