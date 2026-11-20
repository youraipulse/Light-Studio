# Third-party components

## Rendering reference / attribution

Depth-gradient and height-field shadow techniques were adapted to this WebGL2 implementation from Dominik Fojcik / Codrops, https://github.com/DGFX/codrops-relightning-images . That repository declares MIT in its README (verified 2026-11-18), linking to the standard MIT license. A standalone LICENSE file was not present at verification. This package preserves the attribution and the declared MIT terms below; it does not include that repository's source snapshots or artwork.

Copyright holders / credits: Dominik Fojcik and Codrops.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Local inference

- Transformers.js 3.7.2, Hugging Face — Apache-2.0. Full license: licenses/Transformers-Apache-2.0.txt. Official source: https://github.com/huggingface/transformers.js/tree/3.7.2
- The browser bundle includes Hugging Face Jinja — MIT. Full license: licenses/Jinja-MIT.txt.
- ONNX Runtime Web / WASM, Microsoft Corporation — MIT. Its browser runtime is bundled with the Transformers.js distribution. Source and notices: https://github.com/microsoft/onnxruntime . See licenses/ONNX-Runtime-MIT.txt.
- Depth Anything V2 Small ONNX, onnx-community / Depth Anything — Apache-2.0 as declared in https://huggingface.co/onnx-community/depth-anything-v2-small . Exact downloaded revision and SHA-256 values are listed in dependencies.json. Apache-2.0 terms are included in licenses/Transformers-Apache-2.0.txt. Original model: https://huggingface.co/depth-anything/Depth-Anything-V2-Small .

The inference library, WASM runtime and model are downloaded automatically from pinned URLs on first launch and verified against the included SHA-256 manifest. No remote inference API is used.

## Font and launcher runtime

- Manrope — SIL Open Font License 1.1; see assets/OFL-Manrope.txt. This is the only bundled design asset.
- Node.js 24 LTS is downloaded only when a suitable Node.js 22+ runtime is unavailable. Official binaries and SHA-256 manifests come from https://nodejs.org/dist/latest-v24.x/ . Node.js licensing and third-party notices: https://github.com/nodejs/node/blob/main/LICENSE . The runtime is not bundled in this ZIP.

No user photos, generated pictures, third-party product logos, sample photos or upstream demo artwork are included.
