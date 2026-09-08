# Vidgen Studio — inherited interface, refined

## Direction

Operate mode. Retain the upstream's charcoal editing workspace, pale primary controls, Lucide icons and project navigation. Refine the existing world for general video editing: legible Spanish, a preview-led editor and a visible storyboard. Dark surroundings let video contrast be assessed without a bright UI competing with it.

## Foundations

System sans-serif. Body 14px; labels 12–13px; page headings 28–36px. Neutral charcoal surfaces (#101113, #17181b, #202226), pale text (#f3f3f5), secondary text (#a8abb3). Restrained warm-white primary actions. Sage marks successful saves; amber indicates unresolved tasks. No decorative gradients or glowing borders.

## Layout and states

Desktop: 224px navigation, flexible preview/storyboard, 344px scene inspector. Below 1100px, navigation collapses. The individual clip modal uses separate configuration and preview panels on mobile, with a persistent action footer and internal scrolling. Settings are a page with a return action to the current clip. Visible focus, labelled controls, reduced-motion support, meaningful empty states and inline recovery actions are required.

## Workflow

Start from a blank project. The home screen provides projects, search and creation directly, without templates or a marketing introduction. Projects open as a clip library with search, filters, selection and original ZIP downloads. Individual clip generation and editing open in a focused native modal with prompt, references, preview and versions; no storyboard or montage actions. Closing restores the clip library and preserves drafts. The optional sequence uses its own saved subset and order, with an explicit return to the library. Draft before generating. Keep generation, editing and extension distinct; preserve prior versions. A sequential queue stays at app level while changing views. Persist operation identifiers for explicit recovery after a reload. Save media as blobs and create fresh object URLs for playback.

Place the prompt and output settings before optional references. Preserve edit and extension instructions with the clip, and allow other clips to be prepared while generation runs. Selection actions explain hidden selections. Failed or interrupted clips can be filtered and recovered directly. Deletion moves clips into a persistent trash with Undo and Restore, including versions and their previous sequence position.

Submitting from the clip modal closes it after requests are saved to the queue. The footer offers a version count; output variants remain in the same clip. Library cards show the provider's actual phase, variant index and waiting count. A global queue control remains available across projects, with pause and explicit continuation after reload. Generation runs sequentially while drafting and queue submission stay available; no invented progress percentage.
