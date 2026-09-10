# Third-party notices

## Original project

Vidgen Studio derives from [Video_Orchestrator by Rajjit Laishram](https://github.com/rajjitlai/Video_Orchestrator). The original copyright and MIT license are preserved in [LICENSE](LICENSE). Development of this fork is recorded in its Git history and [CHANGELOG.md](CHANGELOG.md).

## Direct runtime and styling dependencies

The following declarations were checked against the installed packages resolved by this repository's lockfile. Consult each package's own license and update this inventory when changing dependencies; it is not an inventory of every transitive component.

| Package                            | Resolved version | Declared license |
| ---------------------------------- | ---------------- | ---------------- |
| `react`, `react-dom`               | 19.2.5           | MIT              |
| `idb`                              | 8.0.3            | ISC              |
| `lucide-react`                     | 0.468.0          | ISC              |
| `tailwindcss`, `@tailwindcss/vite` | 4.2.4            | MIT              |
| `@ffmpeg/ffmpeg`                   | 0.12.15          | MIT              |
| `@ffmpeg/util`                     | 0.12.2           | MIT              |
| `@ffmpeg/core`                     | 0.12.10          | GPL-2.0-or-later |

Development dependencies retain their own licenses. Exact dependency versions and integrity data are in `package-lock.json`; package contents include their license notices.

## FFmpeg distribution

The export feature distributes the unmodified JavaScript and WebAssembly artifacts from `@ffmpeg/core` 0.12.10. They are loaded from the deployment, not from an external runtime CDN. The [bundled GPL text](public/licenses/FFmpeg-GPL-2.0.txt) is copied into `dist/licenses` by Vite.

The wrapper and the core are separate components. The core includes FFmpeg and codec libraries with their own terms, including x264; the application's MIT license does not replace those licenses. This distinction is described in the [official ffmpeg.wasm FAQ](https://ffmpegwasm.netlify.app/docs/faq/).

Sources for reviewing the distributed component:

- [ffmpeg.wasm source and build recipes](https://github.com/ffmpegwasm/ffmpeg.wasm).
- [The specific core package version](https://www.npmjs.com/package/@ffmpeg/core/v/0.12.10).
- [FFmpeg source and licensing information](https://ffmpeg.org/legal.html).

Before redistributing a build, verify the obligations of its exact components, including corresponding source availability and build instructions. Do not treat a license label or an upstream link alone as certification of compliance. Preserve notices and record modifications if you build a different core. See the [release guide](docs/releasing.md).

## Provider names and generated media

Google and its model names identify the provider integrations. This independent project does not imply endorsement or provide ownership of provider trademarks. The repository license covers its code; it does not grant rights to user-uploaded references or determine the terms of generated media.

The small media files under `e2e/fixtures` are synthetic test inputs. Screenshots or media added to future documentation must be cleared for publication; do not substitute private user content.
