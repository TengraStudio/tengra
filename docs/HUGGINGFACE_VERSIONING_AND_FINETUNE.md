# HuggingFace Versioning and Fine-Tuning

This document explains the built-in HuggingFace versioning and fine-tuning flows in Model Explorer.

## Versioning

Features:
- Register model versions from local GGUF output paths
- List and compare saved versions
- Pin/unpin a preferred version
- Rollback by copying a selected version to a target path
- Notification hints (no pin, pin drift, large history)

Related IPC:
- `hf:versions:list`
- `hf:versions:register`
- `hf:versions:compare`
- `hf:versions:rollback`
- `hf:versions:pin`
- `hf:versions:notifications`

Persistence:
- Stored under app user data as `hf-model-versions.json`

## Fine-Tuning

Features:
- Dataset preparation (normalizes lines to JSONL)
- Start fine-tune jobs with epochs and learning rate
- Real-time progress updates via IPC event
- Job listing, cancellation, evaluation, and export

Related IPC:
- `hf:finetune:prepare-dataset`
- `hf:finetune:start`
- `hf:finetune:list`
- `hf:finetune:get`
- `hf:finetune:cancel`
- `hf:finetune:evaluate`
- `hf:finetune:export`
- Event: `hf:finetune-progress`

Persistence:
- Stored under app user data as `hf-finetune-jobs.json`

## Notes

- Fine-tuning job execution is orchestrated as an internal managed workflow.
- Conversion + versioning + fine-tuning are designed to work together from the same model detail panel.
