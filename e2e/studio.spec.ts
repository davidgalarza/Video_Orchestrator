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

async function reopenReady(page: Page, title = "Primera escena") {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const card = page.locator(".project-clip").filter({
    has: page.getByRole("button", {
      name: `Abrir clip: ${title}`,
      exact: true,
    }),
  });
  await expect(card.locator(".clip-title [role=status]")).toHaveText("Listo", {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: `Abrir clip: ${title}`, exact: true })
    .click();
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
  await page.locator(".reference-details summary").click();
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
  await reopenReady(page);
  await expect(page.locator(".preview-frame video")).toBeVisible();
  expect(bodies[0]).toMatchObject({ model: "gemini-omni-1.1-flash" });
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("¿Qué quieres cambiar?")
    .fill("Una iluminación más cálida.");
  await page.getByRole("button", { name: "Crear clip editado" }).click();
  await reopenReady(page, "Primera escena · Edición 1");
  await expect(page.locator(".preview-meta")).toContainText("Clip listo", {
    timeout: 15000,
  });
  expect(bodies[1]).toMatchObject({ previous_interaction_id: "op-1" });
  await page.getByRole("button", { name: "Extender", exact: true }).click();
  await page
    .getByLabel("¿Cómo continúa la escena?")
    .fill("La cámara retrocede lentamente.");
  await page
    .getByRole("button", { name: "Crear clip extendido", exact: true })
    .click();
  await reopenReady(page, "Primera escena · Edición 1 · Extensión 1");
  await expect(page.locator(".preview-meta")).toContainText("Clip listo", {
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
  await expect(page.locator(".versions")).toHaveCount(0);
  await expect(page.locator(".project-clip")).toHaveCount(3);
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
    page.getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => posts).toBe(1);
  await page
    .getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Recuperar resultado" }),
  ).toBeVisible();
  ready = true;
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Recuperar resultado" })
    .click();
  await reopenReady(page);
  await expect(page.locator(".preview-frame video")).toBeVisible();
  expect(posts).toBe(1);
});

test("queue stops on quota failure and preserves waiting scenes", async ({
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
    page.locator(".project-clip").filter({ hasText: "En cola" }),
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
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
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

test("settings returns to the draft, optional references stay compact and trash is recoverable", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, 2);
  await expect(page.locator(".reference-details")).not.toHaveAttribute(
    "open",
    "",
  );
  await page
    .getByRole("button", { name: "Conectar Google para generar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ajustes del estudio" }),
  ).toBeVisible();
  await page.getByLabel("Google API key", { exact: true }).fill("test-key");
  await page
    .getByRole("button", { name: "Guardar clave", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver al clip", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Nombre de la escena")).toHaveValue("Escena 2");
  await expect(page.getByLabel("¿Qué ocurre en esta toma?")).toContainText(
    "Plano 2",
  );
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page
    .getByLabel("Seleccionar clip: Primera escena", { exact: true })
    .check();
  await expect(
    page.getByLabel("Seleccionar clips visibles", { exact: true }),
  ).toHaveJSProperty("indeterminate", true);
  await page.getByLabel("Buscar clips", { exact: true }).fill("Escena 2");
  await expect(
    page.locator(".selection-note").filter({ hasText: "fuera de este filtro" }),
  ).toBeVisible();
  await page.getByLabel("Buscar clips", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Eliminar clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".project-clip")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Eliminar clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await page.reload();
  await page.getByLabel("Filtrar clips").selectOption("trash");
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La papelera está vacía" }),
  ).toBeVisible();
  await page.getByLabel("Filtrar clips").selectOption("all");
  await expect(page.locator(".project-clip")).toHaveCount(2);
});

test("edit instructions persist and mobile switches between configuration and the finished video", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) =>
    route.fulfill({
      json: {
        id: "saved-video",
        status: "completed",
        steps: [
          { type: "model_output", content: [{ type: "video", data: clip }] },
        ],
      },
    }),
  );
  await page.goto("/");
  await createProject(page);
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await reopenReady(page);
  await expect(page.locator(".preview-frame video")).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("¿Qué quieres cambiar?")
    .fill("Conservar el encuadre y cambiar la luz.");
  await page.getByRole("button", { name: "Extender", exact: true }).click();
  await page
    .getByLabel("¿Cómo continúa la escena?")
    .fill("La cámara se aleja despacio.");
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await expect(page.getByLabel("¿Qué quieres cambiar?")).toHaveValue(
    "Conservar el encuadre y cambiar la luz.",
  );
  await page.getByRole("button", { name: "Extender", exact: true }).click();
  await expect(page.getByLabel("¿Cómo continúa la escena?")).toHaveValue(
    "La cámara se aleja despacio.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".preview-frame video")).toBeVisible();
  await page.screenshot({ path: "artifacts/ux-mobile-preview.png" });
  await page.getByRole("button", { name: "Configurar", exact: true }).click();
  await expect(page.getByLabel("¿Cómo continúa la escena?")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Crear clip extendido", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "artifacts/ux-mobile-configure.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/ux-desktop-clip.png" });
});

test("background queue accepts more clips, preserves snapshots and creates independent clips and edits from the selected take", async ({
  page,
}) => {
  const bodies: Record<string, unknown>[] = [];
  let ready = false;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, async (route) => {
    if (route.request().method() === "POST") {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        json: { id: `batch-${bodies.length}`, status: "in_progress" },
      });
    } else
      await route.fulfill({
        json: ready
          ? {
              id: route.request().url().split("/").at(-1),
              status: "completed",
              steps: [
                {
                  type: "model_output",
                  content: [{ type: "video", data: clip }],
                },
              ],
            }
          : { status: "in_progress" },
      });
  });
  await page.goto("/");
  await createProject(page);
  await page.getByLabel("Cantidad de clips").fill("3");
  await page
    .getByRole("button", { name: "Generar 3 clips", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".clip-generation").first()).toContainText(
    "Clip 1 de 3",
  );
  await expect(page.locator(".job-bar")).toContainText("2 en espera");
  await page.getByRole("button", { name: "Nuevo clip", exact: true }).click();
  await page
    .getByLabel("¿Qué ocurre en esta toma?")
    .fill("Una montaña nevada.");
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".project-clip").last()).toContainText("En cola");
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page
    .getByLabel("¿Qué ocurre en esta toma?")
    .fill("Este borrador no modifica lo enviado.");
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/queue-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/queue-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  ready = true;
  await expect(page.locator(".job-bar")).toHaveCount(0, { timeout: 25000 });
  expect(bodies).toHaveLength(4);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[1]).toEqual(bodies[2]);
  await expect(page.locator(".project-clip")).toHaveCount(4);
  await expect(
    page.locator(".project-clip .clip-title [role=status]"),
  ).toHaveText(["Listo", "Listo", "Listo", "Listo"]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page.getByLabel("¿Qué quieres cambiar?").fill("Cambia la luz.");
  await page.getByLabel("Cantidad de clips").fill("2");
  await page
    .getByRole("button", { name: "Crear 2 clips editados", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".project-clip")).toHaveCount(6);
  await expect(
    page.locator(".project-clip").last().locator(".clip-title [role=status]"),
  ).toHaveText("Listo", { timeout: 20000 });
  expect(bodies[4]).toMatchObject({ previous_interaction_id: "batch-1" });
  expect(bodies[5]).toMatchObject({ previous_interaction_id: "batch-1" });
});

test("waiting clips survive pause and reload and can be cancelled without new paid requests", async ({
  page,
}) => {
  let posts = 0;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    if (route.request().method() === "POST") posts++;
    return route.fulfill({
      json: { id: "waiting-batch", status: "in_progress" },
    });
  });
  await page.goto("/");
  await createProject(page);
  await page.getByLabel("Cantidad de clips").fill("3");
  await page
    .getByRole("button", { name: "Generar 3 clips", exact: true })
    .click();
  await expect.poll(() => posts).toBe(1);
  await expect(page.locator(".job-bar")).toContainText("2 en espera");
  await page
    .getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar cola", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".job-bar")).toContainText("2 en espera");
  await expect(page.locator(".job-bar")).toContainText("Cola pausada");
  expect(posts).toBe(1);
  await page
    .getByRole("button", { name: "Cancelar pendientes", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Cancelar pendientes", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Cancelar pendientes", exact: true })
    .click();
  await expect(page.locator(".clip-generation")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".job-bar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Recuperar resultado", exact: true }),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("recovering an interrupted batch resumes its remaining clips exactly once", async ({
  page,
}) => {
  let posts = 0,
    ready = false;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    if (route.request().method() === "POST") posts++;
    return route.fulfill({
      json: ready
        ? {
            id: `resume-${posts}`,
            status: "completed",
            steps: [
              {
                type: "model_output",
                content: [{ type: "video", data: clip }],
              },
            ],
          }
        : { id: "resume-1", status: "in_progress" },
    });
  });
  await page.goto("/");
  await createProject(page);
  await page.getByLabel("Cantidad de clips").fill("3");
  await page
    .getByRole("button", { name: "Generar 3 clips", exact: true })
    .click();
  await expect.poll(() => posts).toBe(1);
  await page
    .getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar cola", exact: true }),
  ).toBeVisible();
  await page.reload();
  ready = true;
  await page
    .getByRole("button", { name: "Recuperar resultado", exact: true })
    .click();
  await expect(
    page.locator(".project-clip .clip-title [role=status]"),
  ).toHaveText(["Listo", "Listo", "Listo"], { timeout: 15000 });
  await expect(page.locator(".job-bar")).toHaveCount(0);
  expect(posts).toBe(3);
});

test("failed edits retry into the same derived clip and keep their original input", async ({
  page,
}) => {
  const bodies: Record<string, unknown>[] = [];
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 2)
      return route.fulfill({
        status: 429,
        json: { error: { message: "Quota exceeded" } },
      });
    return route.fulfill({
      json: {
        id: `retry-${bodies.length}`,
        status: "completed",
        steps: [
          { type: "model_output", content: [{ type: "video", data: clip }] },
        ],
      },
    });
  });
  await page.goto("/");
  await createProject(page);
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await reopenReady(page);
  await page.getByLabel("¿Qué quieres cambiar?").fill("Luz más cálida.");
  await page
    .getByRole("button", { name: "Crear clip editado", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(2);
  await expect(page.locator(".project-clip").last()).toContainText("Revisar");
  await expect(page.locator(".project-clip").first()).toContainText("Listo");
  await page
    .getByRole("button", { name: "Reintentar clip", exact: true })
    .click();
  await expect(
    page.locator(".project-clip").last().locator(".clip-title [role=status]"),
  ).toHaveText("Listo");
  await expect(page.locator(".project-clip")).toHaveCount(2);
  expect(bodies[1]).toEqual(bodies[2]);
  expect(bodies[2]).toMatchObject({ previous_interaction_id: "retry-1" });
  await page
    .locator(".project-clip")
    .last()
    .getByRole("button", { name: "Ver origen", exact: true })
    .click();
  await expect(page.getByLabel("Nombre de la escena")).toHaveValue(
    "Primera escena",
  );
});

test("existing grouped results can be separated into independently downloadable clips", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page);
  await page.evaluate(async (data) => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("vid-gen-studio", 1);
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = database.transaction("scenes", "readwrite");
      const req = tx.objectStore("scenes").getAll();
      req.onsuccess = () => {
        const scene = req.result[0];
        const versions = ["old-1", "old-2"].map((id) => ({
          id,
          prompt: "Paisaje",
          settings: scene.settings,
          mode: "generate",
          duration: 8,
          created_at: "today",
          blob: new Blob(
            [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
            { type: "video/mp4" },
          ),
        }));
        tx.objectStore("scenes").put({
          ...scene,
          versions,
          active_version_id: "old-2",
          status: "completed",
        });
      };
      tx.oncomplete = () => resolve();
    });
    database.close();
  }, clip);
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page.locator(".versions summary").click();
  await page
    .getByRole("button", { name: "Separar en clips", exact: true })
    .click();
  await expect(page.locator(".versions")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(2);
  await expect(
    page.locator(".project-clip .clip-title [role=status]"),
  ).toHaveText(["Listo", "Listo"]);
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: /Descargar seleccionados/ }),
  ).toBeEnabled();
});
