# Image Workflow Templates

This guide describes the ComfyUI workflow template support in `LocalImageService`.

## What Is Supported

- Template storage and lifecycle:
  - `listComfyWorkflowTemplates()`
  - `saveComfyWorkflowTemplate()`
  - `deleteComfyWorkflowTemplate()`
- Workflow share codes:
  - `exportComfyWorkflowTemplateShareCode()`
  - `importComfyWorkflowTemplateShareCode()`
- Runtime resolution:
  - Selected template via settings field `images.comfyUIWorkflowTemplateId`
  - Inline workflow JSON via `images.comfyUIWorkflowJson`
  - Automatic fallback to built-in default workflow

## Placeholder Tokens

Templates can include placeholder tokens in any string field:

- `{{prompt}}`
- `{{negative_prompt}}`
- `{{width}}`
- `{{height}}`
- `{{steps}}`
- `{{cfg_scale}}`
- `{{seed}}`
- `{{batch_size}}`

If a value is exactly one token (for example `{{steps}}`), it is replaced with the typed value (`number` or `string`). Mixed strings are replaced as text.

## UI Workflow Editor

The Settings Image tab includes a workflow editor card with:

- Template name input
- Raw JSON editor
- Save template action
- Existing template list (load, delete, share)
- Share-code import/export

## Fallback Strategy

ComfyUI generation resolves workflow in this order:

1. Saved template selected by `comfyUIWorkflowTemplateId`
2. Inline JSON from `comfyUIWorkflowJson`
3. Built-in workflow template

If WebSocket completion tracking fails, generation falls back to history polling automatically.
