# Third-party notices

Vidgen Studio derives from Video_Orchestrator by Rajjit Laishram, distributed under the MIT license. The upstream copyright and license are preserved in LICENSE.

The browser export feature uses:

- `@ffmpeg/ffmpeg` and `@ffmpeg/util`, MIT, https://github.com/ffmpegwasm/ffmpeg.wasm
- `@ffmpeg/core` 0.12.10, GPL-2.0-or-later. The application distributes the unmodified JavaScript and WebAssembly artifacts from this package under their own terms. Upstream source/build recipes and release history: https://github.com/ffmpegwasm/ffmpeg.wasm . Package and license information for the exact distributed version: https://www.npmjs.com/package/@ffmpeg/core/v/0.12.10 . FFmpeg upstream: https://ffmpeg.org/legal.html .

The FFmpeg artifact includes codec libraries, including x264, that carry their own licenses. Review the upstream build and license notices when redistributing modified binaries. See public/licenses for the bundled license text.
