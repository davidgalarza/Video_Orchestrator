# Vidgen Studio

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People creating and editing videos of any kind. The interface uses Spanish, with no templates or positioning around a specific use case.

## Product Purpose

Plan scenes, generate video through a personal Google API key, iterate on clips and download a finished sequence.

## Capabilities and Constraints

Fork of rajjitlai/Video_Orchestrator under MIT. React, TypeScript and Vite; browser-local IndexedDB; static deployment on Vercel. Integrate Gemini Omni 1.1 Flash directly through Google's Interactions API and retain Veo support. No credentials bundled into the deployment. Existing projects must remain readable.

## Operating Context

Primary workflow: project clip libraries, individual editing, reusable image references and multiple versions. Users can download selected original clips in ZIP for a local editor, or explicitly assemble an optional sequence with its own saved order. Users review prompts before requests that consume their Google quota. Downloads and local data are not synchronized across devices.

## Product Principles

- Make the next action and the current generation state visible.
- Preserve completed clips when a new attempt fails.
- Keep a predictable, familiar video editing workspace.
- Show actual status and usage; do not invent billing estimates.

## Evidence on Hand

Original source and Google's public API documentation. No user-provided reference media or API key has been supplied. Live generation remains to be validated with an authorized key.
