import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const clip = readFileSync(
  new URL("./fixtures/clip.mp4", import.meta.url),
).toString("base64");
const silent = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
const google = "**/generativelanguage.googleapis.com/**";
async function createProject(page: Page, sceneCount = 1) {
  await page
    .locator(".home-page")
    .getByRole("button", { name: "Nuevo proyecto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  for (let i = 0; i < sceneCount; i++) {
    if (i) {
      await page
        .getByRole("button", { name: "Cerrar editor de clip", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Nuevo clip", exact: true })
        .click();
      await expect(page.locator(".project-clip")).toHaveCount(i + 1);
    }
    await page
      .getByLabel("¿Qué ocurre en esta toma?")
      .fill(`Plano ${i + 1}: la cámara recorre un paisaje al amanecer.`);
    await page.getByLabel("Nombre de la escena").click();
  }
}

test("editor workflow: key, blank project, references, versions, persistence and responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const bodies: Record<string, unknown>[] = [];
  await page.route(google, async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      bodies.push(req.postDataJSON());
      await route.fulfill({
        json: { id: `op-${bodies.length}`, status: "in_progress" },
      });
    } else if (req.url().includes("/interactions/"))
      await route.fulfill({
        json: {
          id: req.url().split("/").at(-1),
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "video", data: clip, mime_type: "video/mp4" }],
            },
          ],
        },
      });
    else await route.fulfill({ json: { models: [] } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Proyectos", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Añadir API key", exact: true })
    .click();
  await page
    .getByLabel("Google API key", { exact: true })
    .fill("testing-no-real-api-key");
  await page
    .getByRole("button", { name: "Guardar clave", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comprobar conexión", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Google acepta la clave",
  );
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await createProject(page);
  await expect(page.getByLabel("Nombre de la escena")).toHaveValue(
    "Primera escena",
  );
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.getByLabel("Nombre del proyecto").fill("Secuencia de prueba");
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page
    .getByLabel("Subir fotograma inicial", { exact: true })
    .setInputFiles("e2e/fixtures/reference.png");
  await expect(
    page.getByLabel("Fotograma inicial", { exact: true }),
  ).not.toHaveValue("");
  await page
    .getByLabel("Fotograma final", { exact: true })
    .selectOption({ label: "reference.png" });

  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect(page.locator(".preview-frame video")).toBeVisible({
    timeout: 15000,
  });
  expect(bodies[0]).toMatchObject({ model: "gemini-omni-1.1-flash" });
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("¿Qué quieres cambiar?")
    .fill("Una iluminación más cálida.");
  await page.getByRole("button", { name: "Crear versión editada" }).click();
  await expect(page.locator(".preview-meta")).toContainText("Versión 2", {
    timeout: 15000,
  });
  expect(bodies[1]).toMatchObject({ previous_interaction_id: "op-1" });
  await page.getByRole("button", { name: "Extender", exact: true }).click();
  await page
    .getByLabel("¿Cómo continúa la escena?")
    .fill("La cámara retrocede lentamente.");
  await page
    .getByRole("button", { name: "Extender 10 segundos", exact: true })
    .click();
  await expect(page.locator(".preview-meta")).toContainText("Versión 3", {
    timeout: 15000,
  });
  expect(bodies[2]).toMatchObject({
    previous_interaction_id: "op-2",
    input: expect.stringContaining("Extend this video"),
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".preview-frame video")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".preview-frame video")
        .evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThan(0);
  await expect(page.getByLabel("Nombre del proyecto")).toHaveValue(
    "Secuencia de prueba",
  );
  await page.locator(".versions summary").click();
  await page.getByRole("button", { name: /V1.*Generación/ }).click();
  await expect(page.locator(".preview-meta")).toContainText("Versión 1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".preview-frame video")
        .evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThan(1);
  await page.screenshot({
    path: "artifacts/editor-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(
    page.getByRole("heading", { name: "Proyectos", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("paused generations recover after reload without creating a second video", async ({
  page,
}) => {
  let posts = 0,
    ready = false;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await route.fulfill({
        json: { id: "recoverable", status: "in_progress" },
      });
    } else
      await route.fulfill({
        json: ready
          ? {
              id: "recoverable",
              status: "completed",
              steps: [
                {
                  type: "model_output",
                  content: [{ type: "video", data: clip }],
                },
              ],
            }
          : { id: "recoverable", status: "in_progress" },
      });
  });
  await page.goto("/");
  await createProject(page);
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pausar seguimiento", exact: true }),
  ).toBeVisible();
  await expect.poll(() => posts).toBe(1);
  await page
    .getByRole("button", { name: "Pausar seguimiento", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recuperar resultado" }),
  ).toBeVisible();
  ready = true;
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page.getByRole("button", { name: "Recuperar resultado" }).click();
  await expect(page.locator(".preview-frame video")).toBeVisible();
  expect(posts).toBe(1);
});

test("queue stops on quota failure and leaves remaining scenes as drafts", async ({
  page,
}) => {
  let posts = 0;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    posts++;
    return route.fulfill({
      status: 429,
      json: { error: { message: "Quota exceeded" } },
    });
  });
  await page.goto("/");
  await createProject(page, 3);
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.getByRole("button", { name: /Generar pendientes/ }).click();
  await expect(
    page.locator(".project-clip").filter({ hasText: "Revisar" }),
  ).toHaveCount(1);
  expect(posts).toBe(1);
  await expect(
    page.locator(".project-clip").filter({ hasText: "Borrador" }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".inline-error")).toContainText("cuota");
});

test("exports mixed silent/audio clips in a single playable MP4 using the local engine", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await createProject(page, 2);
  await page.evaluate(
    async ({ clip, silent }) => {
      // Seed two legacy-format records to cover migration and the actual export UI.
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("vid-gen-studio", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("scenes", "readwrite"),
          store = tx.objectStore("scenes");
        const request = store.getAll();
        request.onsuccess = () => {
          request.result
            .sort((a, b) => a.order - b.order)
            .forEach((scene, i) => {
              if (i > 1) store.delete(scene.id);
              else
                store.put({
                  ...scene,
                  status: "completed",
                  video_blob: new Blob(
                    [
                      Uint8Array.from(atob(i ? silent : clip), (c) =>
                        c.charCodeAt(0),
                      ),
                    ],
                    { type: "video/mp4" },
                  ),
                  video_url: "blob:expired-original-url",
                });
            });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { clip, silent },
  );
  await page.reload();
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await page
    .getByRole("button", { name: "Añadir a secuencia", exact: true })
    .click();
  await expect(page.locator(".preview-frame video")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar vídeo", exact: true })
    .click();
  const download = await downloaded;
  const outputPath = await download.path();
  expect(outputPath).toBeTruthy();
  const encodedOutput = readFileSync(outputPath!).toString("base64");
  const result = await page.evaluate(async (data) => {
    const output = new Blob(
      [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
      { type: "video/mp4" },
    );
    const video = document.createElement("video");
    video.src = URL.createObjectURL(output);
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("MP4 inválido"));
    });
    return {
      size: output.size,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  }, encodedOutput);
  expect(result.size).toBeGreaterThan(1000);
  expect(result.duration).toBeGreaterThan(1.8);
  expect(result.width).toBe(720);
  expect(result.height).toBe(1280);
});

test("clip library downloads originals in ZIP and keeps an optional sequence after reload", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, 3);
  await page.evaluate(
    async ({ clip, silent }) => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const req = indexedDB.open("vid-gen-studio", 1);
        req.onsuccess = () => resolve(req.result);
      });
      await new Promise<void>((resolve) => {
        const tx = database.transaction("scenes", "readwrite");
        const req = tx.objectStore("scenes").getAll();
        req.onsuccess = () =>
          req.result
            .sort((a, b) => a.order - b.order)
            .forEach((scene, i) => {
              if (i < 2)
                tx.objectStore("scenes").put({
                  ...scene,
                  status: "completed",
                  video_blob: new Blob(
                    [
                      Uint8Array.from(atob(i ? silent : clip), (c) =>
                        c.charCodeAt(0),
                      ),
                    ],
                    { type: "video/mp4" },
                  ),
                });
            });
        tx.oncomplete = () => resolve();
      });
      database.close();
    },
    { clip, silent },
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Clips del proyecto/ }),
  ).toBeVisible();
  await expect(page.locator(".project-clip")).toHaveCount(3);
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await expect(page.locator(".selection-note")).toContainText("2 clips");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Descargar seleccionados/ }).click();
  const zip = await downloaded;
  expect(zip.suggestedFilename()).toMatch(/-clips.zip$/);
  const bytes = readFileSync((await zip.path())!);
  const singleDownload = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Descargar clip: Primera escena",
      exact: true,
    })
    .click();
  const single = await singleDownload;
  expect(readFileSync((await single.path())!).toString("base64")).toBe(clip);

  // Verify stored ZIP local entries contain precisely the selected original media.
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18),
      nameSize = bytes.readUInt16LE(offset + 26),
      extra = bytes.readUInt16LE(offset + 28);
    const name = bytes
      .subarray(offset + 30, offset + 30 + nameSize)
      .toString("utf8");
    const start = offset + 30 + nameSize + extra;
    entries.set(name, bytes.subarray(start, start + size));
    offset = start + size;
  }
  expect(
    [...entries.keys()].filter((name) => name.endsWith(".mp4")),
  ).toHaveLength(2);
  expect(
    [...entries.values()].some((data) => data.toString("base64") === clip),
  ).toBe(true);
  expect(
    [...entries.values()].some((data) => data.toString("base64") === silent),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Deseleccionar", exact: true })
    .click();
  await page.getByLabel("Filtrar clips").selectOption("ready");
  await expect(page.locator(".project-clip")).toHaveCount(2);
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/clips-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/clips-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Añadir a secuencia", exact: true })
    .click();
  await expect(page.locator(".scene-card")).toHaveCount(2);
  await page.locator(".scene-card").last().click();
  await page
    .getByRole("button", { name: "Mover escena a la izquierda", exact: true })
    .click();
  await expect(page.locator(".scene-card").first()).toContainText("Escena 2");
  await page.reload();
  await expect(page.locator(".project-clip")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Secuencia · 2", exact: true })
    .click();
  await expect(page.locator(".scene-card").first()).toContainText("Escena 2");
  await page.screenshot({
    path: "artifacts/sequence-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({
    path: "artifacts/sequence-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page
    .getByRole("button", { name: "Quitar de secuencia", exact: true })
    .click();
  await expect(page.locator(".scene-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Todos los clips", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(3);
});

test("new clips open a focused modal, save drafts and return focus to the library", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page);
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.getByRole("button", { name: "Nuevo clip", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Generar y editar clip" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".storyboard")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Exportar vídeo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("¿Qué ocurre en esta toma?")
    .fill("Una nube cruza el cielo.");
  await page.getByLabel("Nombre de la escena").click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Nuevo clip", exact: true }),
  ).toBeFocused();
  await expect(
    page
      .locator(".project-clip")
      .filter({ hasText: "Una nube cruza el cielo." }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Abrir clip: Escena 2", exact: true })
    .click();
  await expect(page.getByLabel("¿Qué ocurre en esta toma?")).toHaveValue(
    "Una nube cruza el cielo.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    dialog.getByRole("button", { name: "Generar escena", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "artifacts/clip-dialog-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    dialog.getByRole("button", { name: "Generar escena", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "artifacts/clip-dialog-mobile.png",
    fullPage: true,
  });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await expect(
    page.getByRole("button", { name: "Cerrar editor de clip", exact: true }),
  ).toBeInViewport();
});
