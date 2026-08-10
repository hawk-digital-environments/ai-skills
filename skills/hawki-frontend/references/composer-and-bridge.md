# Composer & Legacy Bridge

## Table of Contents

1. [Composer](#composer)
2. [Legacy bridge](#legacy-bridge)

---

## Composer

The composer is the chat input area. All state lives in a single object: `ComposerContext`. Rather than one monolithic class, state is divided into focused _slice_ classes. Two derived-view slices hold no mutable state. A pluggable _mode_ system layers temporary overlays. A dedicated _send pipeline_ handles the transport lifecycle.

Source: `resources/js/plugins/core/modules/chat/components/composer/`

### Slices

| Property | Class | Owns |
|---|---|---|
| `context.model` | `ModelSlice` | selected AI model |
| `context.modelParameters` | `ModelParameterSlice` | temperature / top_p (resets on model switch unless user-modified) |
| `context.tools` | `ToolSlice` | user-enabled tools for the request |
| `context.attachments` | `AttachmentSlice` | staged file attachments |
| `context.modelUsage` | `ModelUsageSlice` | derived: is current model compatible with active tools/files? |
| `context.guard` | `GuardSlice` | derived: canSend, canChangeMode, disablesFeature() |
| `context.mode` | `ModeSlice` | active mode + transition lifecycle |

`ModelUsageSlice` and `GuardSlice` hold no mutable state — pure derived views, never checkpointed.

### Getting the context

```ts
import {useComposerContext} from '$plugins/core/modules/chat/components/composer/contexts/ComposerContext.svelte.js';
const context = useComposerContext();   // in any child composer component; throws if not found
```

`createComposerContext(app, type, toastContext)` — call once in the composer root. `type` is `'aiConv'` (dedicated AI conversation) or `'room'` (room chat where AI elements only appear when message contains `@handle` or regen mode active). Constructs all slices, wires `OldUiBridge` subscriptions, registers context via `setContext`. Cleanup via `onDestroy`.

### Key context properties

| Property | Type | Notes |
|---|---|---|
| `type` | `'aiConv' \| 'room'` | Readonly. Affects `guard.showsAiUiElements`. |
| `message` | `string` ($state) | Input text. Bind directly or set imperatively. |
| `messageWithoutHandles` | `string` (derived) | `message` with `@handle` tokens stripped. Used by `guard.canSend`. |
| `containsAiHandle` | `boolean` (derived) | `true` when any `@handle` in message. |
| `sendStatus` | `SendMessageStatus \| null` (derived) | Active send op or `null` when idle. Cleared once response body resolves. |
| `systemPrompt` | `string` (getter/setter) | Setting propagates to `OldUiBridge`. |
| `hasWriteAccess` | `boolean` ($state) | `false` for read-only conversations. |
| `forcedActive` | `boolean` ($state) | When `true`, disables composer UI (e.g. background upload). |

Methods: `send()` (returns `null` if `guard.canSend` is false), `clear()` (clears message preserving `@handle` tokens + attachments; does NOT reset model/params/tools/mode), `reset(withCheckpoint?)`, `addHandleToMessage(handle)`, `focusInput()`, `onFocusInput(handler)`.

### Modes

Always exactly one active mode. Default is `ChatDefaultMode` (active from construction, no checkpoint saved).

| Mode key | Class | Purpose |
|---|---|---|
| `default` | `ChatDefaultMode` | Normal compose; stays active after send |
| `edit` | `ChatEditMode` | Edit past user message; locks model/settings/tools UI; blocks send until message or attachments change |
| `thread` | `ChatInThreadMode` | Compose inside thread; allows nested edit/regen; stays after send |
| `regen` | `ChatRegenMode` | Regenerate assistant reply; pre-fills model+params from original; locks attachments/input/suggestions; exits after send |

Lifecycle: `enter(mode, data)` checks `guard.canChangeMode`, validates `canEnter()`, saves checkpoint, calls `mode.enter()`. `exit()` restores the checkpoint (all slices reset to pre-enter state).

`allowsNestedModes()` on thread returns `true`, permitting edit/regen to stack a second checkpoint on top of the thread's checkpoint without discarding it.

Writing a new mode: implement `ChatModeInterface` or extend `AbstractMode` (preferred — safe no-op defaults). Register in the factory switch in `createComposerContext()`. Add the key to `ComposerModeRegistry` in `ModeSlice.svelte.ts` for typing.

### Checkpointing

Every stateful slice implements `CheckpointingInterface` (`createCheckpoint()` / `restoreCheckpoint()`). `ContextCheckpointer` coordinates snapshotting all slices simultaneously. `ComposerContext` itself also registers handlers (for `message`, `systemPrompt`, `sendStatus`). The checkpointer maintains a stack; `allowsNested` flag on `createCheckpoint(allowsNested?)` controls whether a second call is permitted while a checkpoint is already on the stack.

### Send pipeline

```
context.send()
  └── guard.canSend?  → return null if false
      └── MessageSender.send(context)
            ├── Creates SendMessageStatus (+ response Promise)
            ├── Creates SendMessageResponse (write surface)
            └── transport.sendMessage(opt)
                  ├── opt.waitForResponse(handler)     ← streaming
                  │     handler receives SendMessageResponse
                  │     handler calls response.triggerBodyChunk(chunk) per chunk
                  │     handler calls response.triggerReceived() when done
                  │       or response.triggerError(msg) on failure
                  ├── opt.setResponse(body)             ← non-streaming
                  └── opt.setResponseFailed(error)      ← failed send
```

`SendMessageStatus` states: `sending`, `responding`, `received`, `failed`. Boolean shorthands: `active` (sending/responding — use to disable send button), `done`, `sending`, `responding`, `failed`, `received`.

`ResponseReader` (read-only subscriber view via `sendStatus.response`): `onBodyChunk`, `onReceived`, `onError`, `onDone`, `abort`, `body`, `received`, `aborted`, `done`, `canAbort`, `bodyIsStream`.

### Implementing a new transport

Implement `MessageSenderTransportInterface`:

```ts
interface MessageSenderTransportInterface {
    sendMessage(opt: MessageSenderTransportOptions): Promise<void>;
}
```

`opt` contains: `context`, `status` (report file progress/errors via `setFileProgress`, `setFileUuid`, `addFileIssue`, `addSendIssue`), `setResponse(body)`, `setResponseFailed(error)`, `waitForResponse(handler)` (for streaming; call `triggerBodyChunk`, finalize with `triggerReceived()`/`triggerError()`). Only one `waitForResponse` call per send.

Reference implementation: `OldUiBridgeTransport` (`contexts/sending/transport/OldUiBridgeTransport.ts`).

---

## Legacy bridge

Integration lives under `resources/js/legacy/` — all `@deprecated` on purpose. Exists only for as long as old Blade + vanilla-JS UI ships alongside the new Svelte app. **New Svelte code must never read from `window.*`** — import real modules and use hooks instead.

### Boot coordination

`EarlyFrontendBridge` Blade component injects inline `<script>` before the Svelte bundle, guaranteeing these exist on `window` from the first moment:

- `window.waitUntilBootstrap(cb)` — calls `cb(bootstrapper)` once `Bootstrapper` is ready (app assembled, `run()` not started). If called after, fires immediately with warning.
- `window.waitUntilReady(cb)` — calls `cb()` after full boot sequence completes. If called after, fires immediately with warning.

`window.hawkiBootstrap` no longer exists — use `waitUntilBootstrap()`.

### Window globals

`provideLegacyGlobals()` (top of `app.ts`) copies kernel functions/bridges/stores onto `window`. Every app-dependent global is a closure/getter resolving `getHawkiApp()` lazily. Key globals: `window.oldUiBridge`, `window.oldUiMessageHistory`, `window.getConfig()`, `window.getConnection()`, `window.getAuthenticatedConnection()`, `window.getConnectionWithUserInfo()`, `window.__`, `window.applyMigrations(runType)`, `window.userKeychain`, `window.hawkiDependencyLoader`, `window.buildStorageFileUrl(id)`, `window.getFileIconSvg(ext)`, `window.getAiModels()`, `window.getAiModel(id)`, `window.getSystemModel(type)`, `window.getSystemPrompt(type)`, `window.hawkiIsReady`.

`dependencyLoader(name)` loads heavy third-party libs (echo, cropperJs, jsPdf, pdfJsLib, docx, docxPreview) on demand — **legacy only**. New Svelte/TS code must use a normal `import` (or `await import()` for code-splitting).

### OldUiBridge

Primary typed event bus between new Svelte and legacy chat UI. Import the singleton — do not instantiate:

```ts
import {oldUiBridge} from '$lib/legacy/OldUiBridge.svelte.js';
```

The bridge is the **only** sanctioned way for new Svelte code to talk to legacy code within the component ecosystem. Don't call legacy functions directly from Svelte; don't reach into Svelte stores from legacy JS; don't bypass by importing legacy modules into Svelte or vice versa. For pure Svelte-to-Svelte communication, use stores or context — not the bridge.

Events (Legacy → Svelte): `onClearActiveConversation`, `onLoadSystemPrompt`, `onLoadInitialModel`, `onEnterMode`, `onExitThread`, `onSendToast`, `onExitMode`, `onActiveConversationSystemPromptUpdate`, `onCurrentChatModelIdUpdate`, `onContextReady`, `onSendMessage(contextType, handler)`, `onOpenChat`, `onNewChat`, `onRenameChat`, `onDeleteChat`, `onLeaveRoom`, `onExportTrigger`, `onOpenRoomControlPanel`, `onMarkRoomMessagesAsRead`, `onImproveMessage` (async, returns improved string), `onPreviewAttachment`, `onDownloadAttachment`, `onDeleteAttachment`. Each returns an unsubscribe function.

Calls (Svelte → Legacy): `triggerSendMessage(payload)`, `triggerContextReady()`, `triggerExitMode(oldState)`, `updateCurrentChatModelId(modelId)`, `updateActiveConversationSystemPrompt(prompt)`, `triggerEnterMode(mode, data)`, `triggerExport(exportType)`, `triggerOpenChat(slug)`, `triggerNewChat()`, `triggerRenameChat(slug, name)`, `triggerDeleteChat(slug)`, `triggerLeaveRoom(slug)`, `triggerImproveMessage(message, systemPrompt)`, `triggerSendToast(message, type)`, `triggerOpenRoomControlPanel(slug)`, `triggerMarkRoomMessagesAsRead(slug)`, `triggerPreviewAttachment(fileData)`, `triggerDownloadAttachment(fileData)`, `triggerDeleteAttachment(fileData)`, `bindAbortController(controller)`.

Most navigation triggers are suppressed while a send is in progress. `passkey` (`$state<string | null>`) holds the user's decrypted passkey for the session, populated by the legacy layer once the user unlocks.

### OldUiMessageHistory

Companion singleton holding read-state of the active conversation:

```ts
import {oldUiMessageHistory} from '$lib/legacy/OldUiMessageHistory.svelte.js';
```

Reactive (`$derived`) properties: `conversationName`, `conversationSlug`, `isInConversation`, `systemPrompt`, `canAdministrate` (`true` if admin role or `aiConv` context type), `canWrite` (`true` if user can send — admin/editor/owner of personal AI conv; `false` for viewer-only or archived). Check `canWrite` before enabling the composer's send button or system-prompt editor.

Methods: `onLoadConversation(handler)`, `loadConversation(type, conv)`, `updateConversation(partial)`, `clearConversation()`, `addMessageToConversation(msg)`, `updateMessageInConversation(msg)`, `removeMessageFromConversation(id)`, `removeFileByUuid(uuid)`, `findMessageById(id)`, `findMessageByAttachmentUuid(uuid)`.