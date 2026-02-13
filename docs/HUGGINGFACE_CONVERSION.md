# HuggingFace Model Conversion (GGUF)

This document describes the built-in conversion flow for HuggingFace models in the Model Explorer.

## What Is Implemented

- Conversion presets: `balanced`, `quality`, `speed`, `tiny`
- Quantization options: `F16`, `Q8_0`, `Q6_K`, `Q5_K_M`, `Q4_K_M`
- Conversion request validation before run
- Real-time conversion progress events in UI
- Optimization suggestions based on selected options
- Post-conversion status with warnings/errors

## How To Use

1. Open Model Explorer and select a HuggingFace model.
2. In the details panel, open the `Conversion Tools` section.
3. Set:
   - `Preset`
   - `Quantization`
   - `Source Path` (local model/checkpoint path)
   - `Output GGUF Path` (must end with `.gguf`)
4. Click `Convert to GGUF`.
5. Track progress in the conversion progress box.

## Backend Behavior

- If source is already a `.gguf`, the system copies it to output and applies profile metadata flow.
- If source is not `.gguf`, conversion tries to locate llama.cpp converter script.
- Quantization step is attempted when backend binary is available.
- Missing backend produces a clear error or warning instead of silent failure.

## Expected Local Dependencies For Full Conversion

- Python available in PATH (`python` / `python3` / `py`)
- llama.cpp conversion script available in one of:
  - `resources/llama.cpp/convert_hf_to_gguf.py`
  - `vendor/llama.cpp/convert_hf_to_gguf.py`
  - `scripts/convert_hf_to_gguf.py`
- Optional quantizer binary:
  - `resources/llama.cpp/llama-quantize(.exe)`
  - `vendor/llama.cpp/llama-quantize(.exe)`

## Notes

- Output validation checks include required paths and `.gguf` extension.
- Progress events are emitted over IPC channel: `hf:conversion-progress`.
